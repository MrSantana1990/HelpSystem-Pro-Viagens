import {
  searchSchema,
  type SearchInput,
  type CostBreakdown,
  type Scenario,
  type SearchResult,
} from '../../contracts/src/index.js';
import type { TravelProviders, Quote } from '../../providers/src/index.js';

export function calendarDates(month: string): string[] {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error('Invalid month');
  const [year, mon] = month.split('-').map(Number) as [number, number];
  return Array.from(
    { length: new Date(Date.UTC(year, mon, 0)).getUTCDate() },
    (_, i) => month + '-' + String(i + 1).padStart(2, '0'),
  );
}
export function addDays(date: string, days: number): string {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function travelCost(
  input: SearchInput,
  flights: number,
  hotels: number,
): CostBreakdown {
  const days = input.nights + 1;
  const parts = {
    flights,
    hotels,
    food: input.foodPerPersonDayCents * days * input.travelers,
    transport: input.transportPerDayCents * days,
    activities: input.activitiesPerPersonCents * input.travelers,
    doorToDoor: input.doorToDoorCents,
  };
  if (Object.values(parts).some((n) => !Number.isSafeInteger(n) || n < 0))
    throw new Error('Invalid cost');
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Cost overflow');
  return { ...parts, total };
}
// V0: budget-only feasibility score. It makes no claim about weather or comfort.
export function travelScore(total: number, budget: number): number {
  if (
    !Number.isFinite(total) ||
    total < 0 ||
    !Number.isFinite(budget) ||
    budget <= 0
  )
    throw new Error('Invalid score input');
  return Math.round(Math.max(0, Math.min(100, 100 - (total / budget) * 50)));
}
export function rankScenarios(scenarios: Scenario[]): Scenario[] {
  return [...scenarios]
    .sort(
      (a, b) =>
        Number(b.withinBudget) - Number(a.withinBudget) ||
        b.score - a.score ||
        a.costs.total - b.costs.total ||
        a.departure.localeCompare(b.departure),
    )
    .slice(0, 5);
}
function validateDemoQuote(quote: Quote): number {
  if (
    quote.currency !== 'BRL' ||
    !quote.simulated ||
    !Number.isSafeInteger(quote.amountCents) ||
    quote.amountCents < 0
  )
    throw new Error('Invalid demo quote');
  return quote.amountCents;
}
export async function analyzeMonth(
  raw: SearchInput,
  providers: TravelProviders,
  now = new Date(),
): Promise<SearchResult> {
  const input = searchSchema.parse(raw);
  const calendar: Scenario[] = [];
  const signal = AbortSignal.timeout(5000);
  // Sequential dates bound concurrency to two provider requests at a time.
  for (const departure of calendarDates(input.month)) {
    const returnDate = addDays(departure, input.nights);
    const quotes = await Promise.all([
      providers.flights.quote(input, departure, returnDate, signal),
      providers.hotels.quote(input, departure, returnDate, signal),
    ]);
    const costs = travelCost(
      input,
      validateDemoQuote(quotes[0]),
      validateDemoQuote(quotes[1]),
    );
    calendar.push({
      departure,
      returnDate,
      costs,
      score: travelScore(costs.total, input.budgetCents),
      withinBudget: costs.total <= input.budgetCents,
      budgetDifferenceCents: input.budgetCents - costs.total,
    });
  }
  return {
    mode: 'demo',
    currency: 'BRL',
    generatedAt: now.toISOString(),
    calendar,
    ranking: rankScenarios(calendar),
    assumptions: [
      'Valores simulados; não representam ofertas ou disponibilidade real.',
      'Passagem de ida e volta por viajante; hospedagem por quarto e noite.',
      'Alimentação por pessoa/dia e transporte por grupo/dia; duração = noites + 1.',
      'Passeios por pessoa; deslocamento porta a porta total para o grupo.',
      'Travel Score v0 mede apenas adequação ao orçamento: 100 − 50 × custo/orçamento, limitado a 0–100.',
      'Sem cotação cambial, clima, bagagem adicional ou seguro; nenhum fornecedor real conectado.',
    ],
  };
}
