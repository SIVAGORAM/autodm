# ---- build ----
FROM node:24.22.1-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json .npmrc* ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps
RUN npx prisma generate
COPY . .
RUN npm run build

# ---- run ----
FROM node:24.22.1-slim AS run
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json .npmrc* ./
COPY prisma ./prisma
RUN PRISMA_SKIP_POSTINSTALL_GENERATE=true npm ci --omit=dev --legacy-peer-deps
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
RUN test -f ./node_modules/.prisma/client/index.js
COPY --from=build /app/dist ./dist
EXPOSE 4000
# Default = API. The worker service overrides the start command to: node dist/worker.js
CMD ["node", "dist/main.js"]
