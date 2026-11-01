FROM node:20-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0
ARG DATABASE_URL=postgresql://build:build@localhost:5432/hackteen?schema=public

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .
RUN npx prisma generate && npm run build
RUN mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static && if [ -d public ]; then cp -r public .next/standalone/public; fi

EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && cd .next/standalone && node server.js"]
