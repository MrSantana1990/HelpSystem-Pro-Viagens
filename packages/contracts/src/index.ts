import { z } from 'zod';
export const cents = z.number().int().min(0).max(100_000_000);
export const searchSchema = z
  .object({
    origin: z.string().regex(/^[A-Z]{3}$/),
    destination: z.string().regex(/^[A-Z]{3}$/),
    month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    nights: z.number().int().min(1).max(30),
    travelers: z.number().int().min(1).max(9),
    rooms: z.number().int().min(1).max(9),
    budgetCents: cents.refine((n) => n > 0),
    foodPerPersonDayCents: cents,
    transportPerDayCents: cents,
    activitiesPerPersonCents: cents,
    doorToDoorCents: cents,
  })
  .strict()
  .refine((x) => x.origin !== x.destination, {
    message: 'Origem e destino devem ser diferentes.',
  })
  .refine((x) => x.rooms <= x.travelers, {
    message: 'Quartos não podem superar viajantes.',
  });
export type SearchInput = z.infer<typeof searchSchema>;
export type CostBreakdown = {
  flights: number;
  hotels: number;
  food: number;
  transport: number;
  activities: number;
  doorToDoor: number;
  total: number;
};
export type Scenario = {
  departure: string;
  returnDate: string;
  costs: CostBreakdown;
  score: number;
  withinBudget: boolean;
  budgetDifferenceCents: number;
};
export type SearchResult = {
  mode: 'demo';
  currency: 'BRL';
  generatedAt: string;
  assumptions: string[];
  calendar: Scenario[];
  ranking: Scenario[];
};
