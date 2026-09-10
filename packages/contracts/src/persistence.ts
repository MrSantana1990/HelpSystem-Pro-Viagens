import { z } from 'zod';
import { searchSchema, type SearchInput, type Scenario } from './index.js';
export const idSchema = z.string().uuid();
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const registerSchema = z
  .object({ email: emailSchema, password: z.string().min(12).max(128) })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const dateSchema = z
  .string()
  .regex(/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  });
export const tripSchema = z
  .object({ title: z.string().trim().min(1).max(200), input: searchSchema })
  .strict();
export const tripPatchSchema = tripSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const scenarioSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    input: searchSchema,
    departure: dateSchema,
  })
  .strict()
  .refine((value) => value.departure.startsWith(value.input.month + '-'), {
    message: 'A partida deve pertencer ao mês pesquisado.',
  });
export const compareSchema = z
  .object({
    scenarioIds: z
      .array(idSchema)
      .min(1)
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export type SessionView = {
  user: { id: string; email: string };
  csrfToken: string;
  expiresAt: string;
};
export type Trip = {
  id: string;
  title: string;
  input: SearchInput;
  createdAt: string;
  updatedAt: string;
};
export type SavedScenario = {
  id: string;
  tripId: string;
  title: string;
  input: SearchInput;
  snapshot: Scenario;
  provenance: {
    sourceType: 'DEMO' | 'INDICATIVE' | 'LIVE';
    provider: string;
    observedAt: string;
    expiresAt: string | null;
    currency: 'BRL';
  };
};
export type TripDetail = Trip & { scenarios: SavedScenario[] };
