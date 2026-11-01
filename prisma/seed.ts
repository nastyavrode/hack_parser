import { PrismaClient } from '@prisma/client';
import { directionCatalog } from '../src/entities/direction/model/directions';

const prisma = new PrismaClient();

const sources = [
  ['Timepad', 'timepad', 'HACKTEEN_TIMEPAD_URL'],
  ['Leader-ID', 'leader_id', 'HACKTEEN_LEADER_ID_URL'],
  ['Devpost', 'devpost', 'HACKTEEN_DEVPOST_URL'],
  ['Hackathons.com', 'hackathons_com', 'HACKTEEN_HACKATHONS_COM_URL'],
  ['Telegram', 'telegram', 'HACKTEEN_TELEGRAM_URL'],
  ['VK', 'vk', 'HACKTEEN_VK_URL'],
  ['Кванториум', 'kvantorium', 'HACKTEEN_KVANTORIUM_URL'],
  ['Движение Первых', 'dvizhenie_pervykh', 'HACKTEEN_DVIZHENIE_PERVYKH_URL'],
  ['Сириус', 'sirius', 'HACKTEEN_SIRIUS_URL'],
] as const;

async function seed() {
  for (const [id, name] of [['user', 'User'], ['moderator', 'Moderator'], ['admin', 'Admin']]) {
    await prisma.role.upsert({ where: { id }, create: { id, name }, update: { name } });
  }

  const country = await prisma.country.upsert({
    where: { code: 'RU' },
    create: { name: 'Россия', code: 'RU' },
    update: { name: 'Россия' },
  });
  const region = await prisma.region.upsert({
    where: { countryId_name: { countryId: country.id, name: 'Алтайский край' } },
    create: { countryId: country.id, name: 'Алтайский край' },
    update: {},
  });
  await prisma.city.upsert({
    where: { regionId_name: { regionId: region.id, name: 'Барнаул' } },
    create: { regionId: region.id, name: 'Барнаул' },
    update: {},
  });

  for (const { slug, name } of directionCatalog) {
    await prisma.direction.upsert({ where: { slug }, create: { slug, name }, update: { name } });
  }
  for (const [name, slug] of [
    ['Онлайн', 'online'], ['Бесплатно', 'free'], ['Барнаул', 'barnaul'],
    ['Алтайский край', 'altai-krai'], ['Международный', 'international'],
  ]) {
    await prisma.tag.upsert({ where: { slug }, create: { slug, name }, update: { name } });
  }
  for (const [name, providerKey, environmentVariable] of sources) {
    await prisma.source.upsert({
      where: { providerKey },
      create: { name, providerKey, baseUrl: process.env[environmentVariable] ?? null },
      update: { name, baseUrl: process.env[environmentVariable] ?? null },
    });
  }

  console.info('Roles are ready; configured ADMIN_EMAIL/MODERATOR_EMAILS receive their roles on OAuth sign-in');
}

seed()
  .then(() => console.info('HackTeen reference data seeded'))
  .catch((error: unknown) => {
    console.error('Failed to seed HackTeen reference data', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
