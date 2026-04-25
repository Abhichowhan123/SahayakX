FROM node:20-alpine AS builder
WORKDIR /app

# ── Copy root tsconfig (shared + services extend it) ──────────────────────────
COPY tsconfig.base.json ./

# ── Build shared ──────────────────────────────────────────────────────────────
COPY shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# ── Build review-service ────────────────────────────────────────────────────────────────
WORKDIR /app/services/review-service
COPY services/review-service/package*.json ./
RUN npm install
COPY services/review-service/tsconfig*.json ./
COPY services/review-service/src ./src
RUN npm run build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine
COPY --from=builder /app/shared/package.json /app/shared/package.json
COPY --from=builder /app/shared/dist         /app/shared/dist
WORKDIR /app/shared
RUN npm install --omit=dev

WORKDIR /app/services/review-service
COPY --from=builder /app/services/review-service/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/review-service/dist ./dist
EXPOSE 3008
CMD ["node", "dist/index.js"]
