FROM node:20-alpine AS builder
WORKDIR /app

# ── Copy root tsconfig (shared + services extend it) ──────────────────────────
COPY tsconfig.base.json ./

# ── Build shared ──────────────────────────────────────────────────────────────
COPY shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# ── Build catalog-service ────────────────────────────────────────────────────────────────
WORKDIR /app/services/catalog-service
COPY services/catalog-service/package*.json ./
RUN npm install
COPY services/catalog-service/tsconfig*.json ./
COPY services/catalog-service/src ./src
RUN npm run build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine
COPY --from=builder /app/shared/package.json /app/shared/package.json
COPY --from=builder /app/shared/dist         /app/shared/dist
WORKDIR /app/shared
RUN npm install --omit=dev

WORKDIR /app/services/catalog-service
COPY --from=builder /app/services/catalog-service/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/catalog-service/dist ./dist
EXPOSE 3004
CMD ["node", "dist/index.js"]
