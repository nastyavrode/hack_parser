export const siteConfig = {
  name: 'HackTeen',
  description: 'Актуальные IT-соревнования и хакатоны для школьников до 18 лет',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;
