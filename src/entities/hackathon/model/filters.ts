import { z } from 'zod';

export const ageRanges = [
  { label: '6–10 лет', min: 6, max: 10 },
  { label: '11–13 лет', min: 11, max: 13 },
  { label: '14–16 лет', min: 14, max: 16 },
  { label: '17–18 лет', min: 17, max: 18 },
] as const;

export const hackathonFiltersSchema = z.object({
  q: z.string().trim().max(100).default(''),
  age: z.enum(['6-10', '11-13', '14-16', '17-18']).optional(),
  direction: z.string().trim().max(80).optional(),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
  region: z.enum(['barnaul', 'altai', 'russia', 'international']).optional(),
  price: z.enum(['FREE', 'PAID']).optional(),
  date: z.enum(['upcoming', 'month']).optional(),
  sort: z.enum(['date', 'deadline', 'popular', 'newest']).default('date'),
});

export type HackathonFilters = z.infer<typeof hackathonFiltersSchema>;

export function parseHackathonFilters(searchParams: URLSearchParams): HackathonFilters {
  return hackathonFiltersSchema.parse({
    q: searchParams.get('q') ?? '',
    age: searchParams.get('age') ?? undefined,
    direction: searchParams.get('direction') ?? undefined,
    format: searchParams.get('format') ?? undefined,
    region: searchParams.get('region') ?? undefined,
    price: searchParams.get('price') ?? undefined,
    date: searchParams.get('date') ?? undefined,
    sort: searchParams.get('sort') ?? 'date',
  });
}
