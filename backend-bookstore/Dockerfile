# ── Build stage ─────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
# Skip Chrome download: chỉ crawler cần Chrome, API không dùng ở runtime
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

# Generate Prisma client (needs prisma.config.ts for schema path)
COPY prisma/ prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

# Compile NestJS to dist/ (entry: dist/src/main.js)
# Tạo các file cấu hình build ngay trong image để không phụ thuộc build context
COPY src/ src/
RUN printf '%s\n' '{"$schema":"https://json.schemastore.org/nest-cli","collection":"@nestjs/schematics","sourceRoot":"src","compilerOptions":{"deleteOutDir":true}}' > nest-cli.json
RUN printf '%s\n' \
  '{' \
  '  "compilerOptions": {' \
  '    "module": "nodenext",' \
  '    "moduleResolution": "nodenext",' \
  '    "resolvePackageJsonExports": true,' \
  '    "esModuleInterop": true,' \
  '    "isolatedModules": true,' \
  '    "declaration": true,' \
  '    "removeComments": true,' \
  '    "emitDecoratorMetadata": true,' \
  '    "experimentalDecorators": true,' \
  '    "allowSyntheticDefaultImports": true,' \
  '    "target": "ES2023",' \
  '    "sourceMap": true,' \
  '    "outDir": "./dist",' \
  '    "incremental": true,' \
  '    "skipLibCheck": true,' \
  '    "strictNullChecks": true,' \
  '    "forceConsistentCasingInFileNames": true,' \
  '    "noImplicitAny": false,' \
  '    "strictBindCallApply": false,' \
  '    "noFallthroughCasesInSwitch": false' \
  '  }' \
  '}' \
  > tsconfig.json
RUN printf '%s\n' '{"extends":"./tsconfig.json","exclude":["node_modules","test","dist","**/*spec.ts"]}' > tsconfig.build.json
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/package.json package.json
COPY --from=build /app/prisma prisma
COPY --from=build /app/prisma.config.ts prisma.config.ts

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && node dist/src/main.js"]
