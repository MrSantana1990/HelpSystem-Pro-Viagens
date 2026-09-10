import type { SearchInput } from '../../contracts/src/index.js';
export type Quote = {
  amountCents: number;
  currency: 'BRL';
  source: string;
  simulated: boolean;
};
export interface FlightProvider {
  quote(
    input: SearchInput,
    departure: string,
    returnDate: string,
    signal: AbortSignal,
  ): Promise<Quote>;
}
export interface HotelProvider {
  quote(
    input: SearchInput,
    departure: string,
    returnDate: string,
    signal: AbortSignal,
  ): Promise<Quote>;
}
export interface MapsProvider {
  transferEstimate(
    origin: string,
    destination: string,
    signal: AbortSignal,
  ): Promise<Quote>;
}
export type TravelProviders = {
  flights: FlightProvider;
  hotels: HotelProvider;
};
function seed(value: string): number {
  let hash = 2166136261;
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
export function demoProviders(): TravelProviders {
  return {
    flights: {
      async quote(input, departure, _returnDate, signal) {
        signal.throwIfAborted();
        return {
          amountCents:
            (48000 +
              (seed(input.origin + input.destination + departure) % 95000)) *
            input.travelers,
          currency: 'BRL',
          source: 'demo-flight',
          simulated: true,
        };
      },
    },
    hotels: {
      async quote(input, departure, _returnDate, signal) {
        signal.throwIfAborted();
        return {
          amountCents:
            (14000 + (seed(input.destination + departure) % 21000)) *
            input.nights *
            input.rooms,
          currency: 'BRL',
          source: 'demo-hotel',
          simulated: true,
        };
      },
    },
  };
}
