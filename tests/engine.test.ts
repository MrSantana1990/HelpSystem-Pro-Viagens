import { describe, it, expect } from 'vitest';
import {
  calendarDates,
  addDays,
  travelCost,
  travelScore,
  analyzeMonth,
  rankScenarios,
} from '../packages/travel-engine/src/index.js';
import {
  searchSchema,
  type SearchInput,
} from '../packages/contracts/src/index.js';
import { demoProviders } from '../packages/providers/src/index.js';
export const input: SearchInput = {
  origin: 'SSA',
  destination: 'REC',
  month: '2028-02',
  nights: 5,
  travelers: 2,
  rooms: 1,
  budgetCents: 600000,
  foodPerPersonDayCents: 10000,
  transportPerDayCents: 6000,
  activitiesPerPersonCents: 25000,
  doorToDoorCents: 20000,
};
describe('Travel Engine', () => {
  it('handles leap years and year boundary in UTC', () => {
    expect(calendarDates('2028-02')).toHaveLength(29);
    expect(calendarDates('2027-02')).toHaveLength(28);
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(() => calendarDates('2026-13')).toThrow();
  });
  it('includes all costs without multiplying group estimates by travelers', () => {
    expect(travelCost(input, 200000, 100000)).toEqual({
      flights: 200000,
      hotels: 100000,
      food: 120000,
      transport: 36000,
      activities: 50000,
      doorToDoor: 20000,
      total: 526000,
    });
  });
  it('bounds score and rejects invalid values', () => {
    expect(travelScore(600000, 600000)).toBe(50);
    expect(travelScore(2000000, 600000)).toBe(0);
    expect(() => travelScore(2, 0)).toThrow();
    expect(() => travelCost(input, -1, 1)).toThrow();
  });
  it('validates strict input, routes, rooms and integer money', () => {
    for (const change of [
      { destination: 'SSA' },
      { rooms: 3 },
      { month: '2026-00' },
      { budgetCents: 1.5 },
      { nights: 0 },
      { extra: true },
    ])
      expect(searchSchema.safeParse({ ...input, ...change }).success).toBe(
        false,
      );
  });
  it('ranks five stable choices and keeps the calendar chronological', async () => {
    const result = await analyzeMonth(input, demoProviders());
    expect(result.calendar).toHaveLength(29);
    expect(result.ranking).toHaveLength(5);
    expect(result.calendar[0]?.departure).toBe('2028-02-01');
    expect(result.ranking).toEqual(rankScenarios(result.calendar));
    expect(result.mode).toBe('demo');
    expect(result.ranking[0]!.costs.total).toBe(
      Math.min(...result.calendar.map((x) => x.costs.total)),
    );
  });
  it('discloses all options exceeding the budget', async () => {
    const result = await analyzeMonth(
      { ...input, budgetCents: 1 },
      demoProviders(),
    );
    expect(
      result.ranking.every(
        (x) => !x.withinBudget && x.budgetDifferenceCents < 0,
      ),
    ).toBe(true);
  });
  it('breaks ties by date without mutating input', async () => {
    const result = await analyzeMonth(input, demoProviders());
    const item = result.calendar[0]!;
    const list = [
      { ...item, departure: '2028-02-03' },
      { ...item, departure: '2028-02-01' },
    ];
    expect(rankScenarios(list)[0]?.departure).toBe('2028-02-01');
    expect(list[0]?.departure).toBe('2028-02-03');
  });
  it('rejects real or invalid quotes in demo mode', async () => {
    const providers = demoProviders();
    providers.flights.quote = async () => ({
      amountCents: 1,
      currency: 'BRL',
      source: 'real',
      simulated: false,
    });
    await expect(analyzeMonth(input, providers)).rejects.toThrow(
      'Invalid demo quote',
    );
  });
});
