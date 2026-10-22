# ── Build stage ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# Skip Chrome download: puppeteer has no musl build, and the API never uses it at runtime
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

# Generate Prisma client (needs prisma.config.ts for schema path)
COPY prisma/ prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Compile NestJS to dist/ (entry: dist/src/main.js — tsc infers rootDir from root-level ts files)
COPY src/ src/
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/package.json package.json
COPY --from=build /app/prisma prisma
COPY --from=build /app/prisma.config.ts prisma.config.ts

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/src/main.js"]
