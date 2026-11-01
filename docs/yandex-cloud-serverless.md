# Yandex Cloud serverless monitoring

The timer invokes a Node.js Cloud Function hourly. The function reuses HackTeen's source providers and Prisma ingestion pipeline, so source URL deduplication, parser-run history, pending moderation and the one-time archive backfill continue to use the existing PostgreSQL database. The existing email notification workflow remains unchanged and sends only after an event is published.

The function runs configured providers that do not require a headless browser. It includes the official Kvantorium sitemap provider and Yandex search, but explicitly skips direct VK and browser-rendered Sirius providers. Yandex results that require browser rendering are not rendered in this runtime. Use a Serverless Container or keep the optional Docker parser for those sources.

## Prerequisites

- Yandex Cloud CLI initialized for the target cloud and folder.
- The HackTeen PostgreSQL database is reachable from a Yandex Cloud VPC network and already initialized with `npm run db:migrate` and `npm run db:seed`.
- The service account that owns `YANDEX_SEARCH_API_KEY` has `search-api.webSearch.user` on the folder.
- A function service account with permission to read the required Lockbox secrets and use the VPC network (`vpc.user`).
- A separate timer service account with `serverless.functions.invoker` permission for the function.
- A Lockbox secret containing `DATABASE_URL`, `YANDEX_SEARCH_API_KEY` and `YANDEX_CLOUD_FOLDER_ID`. Use the same Search API role/scope setup as in the main README.

Configure managed PostgreSQL security groups to accept TLS connections from the function's VPC network. Add `connection_limit=5` to the PostgreSQL URL to limit connections. Do not expose the database to the public internet just for the function.

The VPC must have subnets in all availability zones as required by Cloud Functions. Add a NAT gateway/route for outbound internet traffic so the function can reach Yandex Search API and public event sites while retaining private access to PostgreSQL.

## Build and deploy

Build the Linux-compatible function package from the repository root:

```bash
npm ci
npm run build:yandex-function
cd .serverless/yandex-function
zip -qr ../hackteen-yandex-function.zip .
cd ../..
```

Create the function and its first version. Replace the placeholders with resource IDs from your folder. The `--secret` options map Lockbox payload keys to environment variables without putting their values in the command:

```bash
yc serverless function create --name hackteen-parser

yc serverless function version create \
  --function-name hackteen-parser \
  --runtime nodejs20 \
  --entrypoint index.handler \
  --memory 1GB \
  --execution-timeout 600s \
  --concurrency 1 \
  --source-path .serverless/hackteen-yandex-function.zip \
  --service-account-id <FUNCTION_SERVICE_ACCOUNT_ID> \
  --network-id <VPC_NETWORK_ID> \
  --secret id=<LOCKBOX_SECRET_ID>,key=DATABASE_URL,environment-variable=DATABASE_URL \
  --secret id=<LOCKBOX_SECRET_ID>,key=YANDEX_SEARCH_API_KEY,environment-variable=YANDEX_SEARCH_API_KEY \
  --secret id=<LOCKBOX_SECRET_ID>,key=YANDEX_CLOUD_FOLDER_ID,environment-variable=YANDEX_CLOUD_FOLDER_ID \
  --environment HACKTEEN_SERVERLESS=1
```

Create an hourly Timer Trigger (the cron expression has six fields, including seconds):

```bash
yc serverless trigger create timer \
  --name hackteen-parser-hourly \
  --cron-expression '0 * * * ? *' \
  --invoke-function-id <FUNCTION_ID> \
  --invoke-function-service-account-id <TIMER_SERVICE_ACCOUNT_ID> \
  --retry-attempts 2 \
  --retry-interval 30s
```

The first invocation can take several minutes while the one-time archive backfill runs. Subsequent invocations skip that backfill after its first successful completion. Provider results, failures and filter counts are logged to Cloud Logging; inspect the function logs after the first timer run. Candidates from current-event sources remain pending in `/admin`.

To run a one-off check without waiting for the timer:

```bash
yc serverless function invoke --name hackteen-parser --data '{}'
```

Do not run the Cloud Timer and the Compose parser at the same time. For local scheduled parsing, opt in explicitly with `docker compose --profile local-parser up parser`; otherwise leave the parser service stopped.
