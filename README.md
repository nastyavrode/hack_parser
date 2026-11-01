# HackTeen

HackTeen aggregates current hackathons, coding competitions and IT events for participants under 18. The first launch focuses on Barnaul and Altai Krai, with Russian and international online events alongside them.

## Architecture

The application uses Next.js 15 App Router, TypeScript, Tailwind CSS, PostgreSQL and Prisma. Feature-Sliced Design separates route composition (`src/app`), entities, features, widgets, shared utilities and server-only services. Public pages use Server Components; validated JSON endpoints live under `src/app/api`.

The architecture decisions, project map, ERD and development roadmap are in [docs/architecture.md](docs/architecture.md). The normalized PostgreSQL model is defined in `prisma/schema.prisma`.

## Run locally

Requirements: Node.js 20+, npm 10+, Docker Compose.

```bash
cp .env.example .env
# Set AUTH_SECRET, AUTH_URL, and optional GitHub OAuth / SMTP values in .env.
docker compose up --build
```

In another terminal, initialize reference data:

```bash
docker compose exec app npm run db:seed
```

The app is available at http://localhost:3000. `AUTH_URL` must match the browser-facing app URL (for local Docker, `http://localhost:3000`); register its `/api/auth/callback/github` URL in the GitHub OAuth app. No sample events are seeded: stale or invented events must not appear as current. Add events in `/admin`, or review parser candidates after configuring provider URLs. To bootstrap a moderator, set `ADMIN_EMAIL` before login; set `MODERATOR_EMAILS` to a comma-separated list for moderator accounts. Those users receive their roles after signing in through the configured GitHub OAuth app. Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` in `.env`.

### Automatic event discovery

For local development, the optional Compose `parser` service runs once when it starts, then every day at 06:00 `Asia/Barnaul`. Start it with `docker compose --profile local-parser up parser`. For a Yandex Cloud deployment, use the Cloud Function and Timer Trigger described in [docs/yandex-cloud-serverless.md](docs/yandex-cloud-serverless.md) instead of running this service continuously.

1. Create a Yandex Cloud billing account and folder, then create a service account.
2. Grant the service account the `search-api.webSearch.user` role on the folder.
3. Create an API key for the service account with the `yc.search-api.execute` scope.
4. Put the API key and folder ID in the private `.env` file:

```dotenv
YANDEX_SEARCH_API_KEY=your-yandex-cloud-service-account-api-key
YANDEX_CLOUD_FOLDER_ID=your-cloud-folder-id
PARSER_RUN_HOUR=6
PARSER_RUN_MINUTE=0
PARSER_TIMEZONE=Asia/Barnaul
```

The API uses `SEARCH_TYPE_RU` for Russian phrases and `SEARCH_TYPE_COM` for English phrases, decodes Yandex's base64 XML response, and stores result links as pending candidates. Search API usage is billed according to the current Yandex Cloud pricing; new accounts may not receive a free trial. Check the [official service pricing](https://yandex.cloud/ru/docs/search-api/pricing) before enabling the scheduled worker.

Rebuild/recreate the services after changing the environment:

```bash
docker compose up --build -d
docker compose logs -f parser
```

Yandex discovery prioritizes Kvantorium 22, IT-Cube 22, AltSTU, ASU, AltSPU and Dvizhenie Pervykh, then public VK/Telegram posts and Russian competition platforms. The Kvantorium provider independently reads recent entries from the site's official `sitemap-feeds.xml`, so current events do not depend on Yandex indexing. It checks publication freshness, event dates and registration status before placing candidates in moderation. On its first successful run, a separate one-time Yandex backfill searches these sources for past youth IT competitions held in 2025–2026. Eligible past events are automatically published into `/archive` (the current catalog continues to show upcoming events only); later scheduled runs skip this historical backfill. This searches indexed results and cannot guarantee that every historical event on the internet is found. The backfill uses Yandex Search API and requires valid API credentials/quota; if the request fails, it will retry on a later parser run.

A separate VK provider reads recent public posts from `HACKTEEN_VK_URL`, defaulting to the Barnaul Kvantorium community (`https://vk.ru/kvant22`); multiple community URLs can be comma-separated. Since VK may limit how many older feed posts it exposes to automated visitors, exact public post URLs can also be listed in `HACKTEEN_VK_POST_URLS`, comma-separated. VK posts are accepted only when their publication date is no older than 90 days, the post explicitly indicates open registration, and the event is in the future. Yandex candidates for the current catalog must expose a publication date no older than 90 days, an open-registration signal, a future event start, and a registration deadline that has not passed. Redirects are followed only within the approved source domains. Pages without verifiable publication/event dates or registration signals are discarded rather than guessed. Current search results are placed in `/admin` as pending candidates, never published automatically. Public listings also exclude events whose start date has passed or whose registration deadline is over. A successful run with no eligible results is shown as “Совпадений нет”, not as a success that suggests events were discovered. The worker logs provider failures and rejection counts; inspect them with `docker compose logs --tail=100 parser`.

For local development without Docker:

```bash
npm ci
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

## Aggregation providers

Each adapter implements `HackathonProvider.fetchEvents(): Promise<Hackathon[]>`. Configure `YANDEX_SEARCH_API_KEY` and `YANDEX_CLOUD_FOLDER_ID` for query-based discovery, or configure a source URL in `.env` before running `npm run parser:run`. The official Kvantorium feed and default VK community are enabled without additional URL configuration. Scraped current-event candidates are stored as `PENDING` and are never published automatically; unknown age, format or dates remain explicitly unknown for moderation. The Sirius adapter uses Playwright for JavaScript-rendered pages; HTML sources use Cheerio.

Before enabling a source, verify its terms of service, robots policy, rate limits and data-use permissions. The crawler uses a conservative generic event-card extractor; site-specific selectors/API integrations require validation against each source's current markup. Parser outcomes and failures are recorded in `ParserRun`.

## Authentication and notifications

NextAuth is configured with GitHub OAuth. Roles (`user`, `moderator`, `admin`) are seeded as database reference data; `ADMIN_EMAIL` bootstraps the first administrator. Configure a real, long random `AUTH_SECRET` before deployment.

Subscriptions are stored by email with age, format and optional direction preferences. Publishing an event creates idempotent delivery records; SMTP delivery failures are saved with retryable status. Configure SMTP before publishing if email notifications are required.

Retry failed deliveries after correcting SMTP settings with `npm run notifications:retry`.

## Operations

```bash
npm run typecheck
npm run db:generate
npm run db:seed
npm run parser:run
```

Install the Playwright browser when running the JavaScript-rendered Sirius provider outside Docker: `npx playwright install chromium`. The scheduled worker can also be started locally with `npm run parser:schedule`; set `DATABASE_URL`, `YANDEX_SEARCH_API_KEY` and `YANDEX_CLOUD_FOLDER_ID` in `.env`.

The sitemap and robots routes are generated by Next.js. Event details include Open Graph metadata and `EducationEvent` JSON-LD. Database credentials, OAuth secrets and SMTP credentials belong only in the deployment environment, never in source control.
