import { prisma } from '@/shared/lib/prisma';

export async function resolveLocation(location: string | undefined) {
  if (!location || location === 'global' || location === 'international') {
    return { cityId: null, regionId: null, countryId: null, error: null };
  }
  const country = await prisma.country.findUnique({ where: { code: 'RU' } });
  if (!country) return { cityId: null, regionId: null, countryId: null, error: 'Справочники не инициализированы; запусти seed' };
  if (location === 'russia') return { cityId: null, regionId: null, countryId: country.id, error: null };
  const region = await prisma.region.findFirst({
    where: { countryId: country.id, name: { equals: 'Алтайский край', mode: 'insensitive' } },
  });
  if (!region) return { cityId: null, regionId: null, countryId: null, error: 'Регион Алтайский край не найден в справочнике' };
  if (location === 'altai') return { cityId: null, regionId: region.id, countryId: country.id, error: null };
  const city = await prisma.city.findFirst({
    where: { regionId: region.id, name: { equals: 'Барнаул', mode: 'insensitive' } },
  });
  if (!city) return { cityId: null, regionId: null, countryId: null, error: 'Барнаул не найден в справочнике' };
  return { cityId: city.id, regionId: region.id, countryId: country.id, error: null };
}
