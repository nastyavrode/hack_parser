import { z } from 'zod';

const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Нужна HTTPS-ссылка');

const hackathonMutationFields = {
  slug: z.string().min(3).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(5).max(240),
  summary: z.string().trim().min(20).max(500),
  description: z.string().trim().min(40).max(20_000),
  requirements: z.string().max(20_000).nullable().optional(),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']),
  priceType: z.enum(['FREE', 'PAID', 'UNKNOWN']).default('UNKNOWN'),
  ageMin: z.number().int().min(6).max(18),
  ageMax: z.number().int().min(6).max(18),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  registrationDeadline: z.string().datetime().nullable().optional(),
  registrationUrl: httpsUrl.nullable().optional(),
  logoUrl: httpsUrl.nullable().optional(),
  prizeDescription: z.string().trim().max(500).nullable().optional(),
  organizerName: z.string().trim().min(2).max(160).nullable().optional(),
  location: z.enum(['barnaul', 'altai', 'russia', 'international', 'global']).optional(),
  directionSlugs: z.array(z.string().max(80)).max(20),
  status: z.enum(['PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED']).optional(),
};

function validateHackathonDatesAndAge(
  value: { ageMin?: number; ageMax?: number; startsAt?: string; endsAt?: string },
  context: z.RefinementCtx,
) {
  if (value.ageMin != null && value.ageMax != null && value.ageMin > value.ageMax) {
    context.addIssue({ code: 'custom', path: ['ageMax'], message: 'Максимальный возраст меньше минимального' });
  }
  if (value.startsAt && value.endsAt && new Date(value.startsAt) > new Date(value.endsAt)) {
    context.addIssue({ code: 'custom', path: ['endsAt'], message: 'Дата окончания раньше даты начала' });
  }
}

export const hackathonMutationSchema = z.object(hackathonMutationFields)
  .superRefine(validateHackathonDatesAndAge);

export const hackathonPatchSchema = z.object(hackathonMutationFields)
  .partial()
  .superRefine(validateHackathonDatesAndAge);

export const subscriptionSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  ageMin: z.number().int().min(6).max(18),
  ageMax: z.number().int().min(6).max(18),
  format: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).nullable(),
  directionSlugs: z.array(z.string().max(80)).max(20),
}).refine(({ ageMin, ageMax }) => ageMin <= ageMax, {
  path: ['ageMax'],
  message: 'Максимальный возраст меньше минимального',
});
