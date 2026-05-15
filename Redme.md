# ServeEase

A home services marketplace app — like Rapido, but for home services. Customers book workers (maid, electrician, plumber, cook, gym trainer, carpenter, etc.) via a mobile app. Workers get assigned jobs in real-time with live location tracking.

---

## Project Summary

ServeEase connects customers who need home services with nearby verified workers. The booking flow mirrors Rapido: customer requests a service → nearby workers are notified → a worker accepts → live tracking begins → job done → payment released from escrow → review submitted.

**Stack:** TypeScript + Node.js microservices, MongoDB (one DB per service), Redis, RabbitMQ, Razorpay, Firebase FCM, Twilio, Nginx, Docker

---

## Architecture — 9 Microservices

| Service | Port | Purpose |
|---|---|---|
| auth-service | 3001 | OTP login + JWT issuance |
| user-service | 3002 | Customer profiles, wallet |
| worker-service | 3003 | Worker profiles, Aadhaar verification, geo search |
| catalog-service | 3004 | Service categories, Redis caching |
| booking-service | 3005 | Full booking flow (Rapido-style), Socket.io live tracking |
| payment-service | 3006 | Razorpay integration, escrow, penalties |
| notification-service | 3007 | FCM push + Twilio SMS via RabbitMQ |
| review-service | 3008 | Ratings and reviews |
| admin-service | 3009 | Worker verification queue, dispute resolution |

**API Gateway:** Nginx reverse proxy routes all external traffic to the correct service.

**Event Bus:** RabbitMQ handles async communication between services (booking events, payment events, notification triggers).

---

## Frontends

- **Mobile App** — React Native (Expo) for both customers and workers
- **Admin Panel** — React Native (Expo) for admin operations (worker verification, disputes, broadcasts)

---

## Service Categories Supported

House Maid, Gardening, Construction, Electrician, Plumber, Home Teacher, Gym Trainer, Cook, Carpenter, Painter, AC Repair, Pest Control

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+

### Run the full stack

```bash
docker-compose up --build
```

### Generate admin password hash

```bash
node scripts/generate-admin-hash.js
```

Update `ADMIN_PASSWORD_HASH` in `docker-compose.yml` with the generated hash before starting.

---

## Environment Variables

Each service has its own `.env` file. Key variables:

| Variable | Used By | Purpose |
|---|---|---|
| `JWT_SECRET` | auth-service | Signs user JWTs |
| `ADMIN_JWT_SECRET` | admin-service | Signs admin JWTs |
| `ENCRYPTION_KEY` | shared/utils | AES encryption for Aadhaar/bank data |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | payment-service | Payment gateway |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | notification-service | SMS delivery |
| `FIREBASE_SERVICE_ACCOUNT` | notification-service | FCM push notifications |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | worker-service | S3 document uploads |

---

## Build Progress

See [BUILD_PROGRESS.md](BUILD_PROGRESS.md) for the full phase-by-phase checklist and next steps.

---

## Known Issues

> Audit performed on 2026-04-30. 29 issues found across the codebase.

### Critical (10) — Break core functionality

| # | File | Line | Problem |
|---|---|---|---|
| 1 | `mobile-app/src/api/index.ts` | 49 | `platform: 'mobile'` sent to auth-service, but Joi only accepts `'ios'|'android'|'web'` — OTP verification fails on every mobile login |
| 2 | `booking-service/src/controllers/booking.controller.ts` | 258–259 | `cancelBooking` publishes `oldStatus === newStatus` — downstream notifications never know the previous state |
| 3 | `shared/utils/index.ts` | 17 | Hardcoded AES fallback key — if `ENCRYPTION_KEY` is missing, Aadhaar/bank data encrypted with a known key |
| 4 | `shared/utils/index.ts` | 5–6 | `Math.random()` used for OTP generation — not cryptographically secure |
| 5 | `admin-panel/src/api/client.ts` | 32 | `PUT /admin/workers/:id/approve` doesn't exist (should be `POST /admin/workers/:workerId/verify`) → always 404 |
| 6 | `admin-panel/src/api/client.ts` | 42 | `GET /admin/stats` doesn't exist (should be `GET /admin/dashboard`) → always 404 |
| 7 | `admin-panel/src/api/client.ts` | 41 | `POST /admin/notifications/broadcast` doesn't exist (should be `POST /admin/broadcast-notification`) → always 404 |
| 8 | `admin-panel/src/api/client.ts` | 31 | `GET /admin/workers/pending` doesn't exist (should be `GET /admin/workers/pending-verification`) → always 404 |
| 9 | `booking-service/src/controllers/booking.controller.ts` | 166 | `startWork` always publishes `oldStatus: WORKER_EN_ROUTE` even when state was `ACCEPTED` |
| 10 | `payment-service/src/index.ts` | — | `PAYMENT_PROCESSED` queue published but never consumed — worker wallets never credited on job completion |

### Warning (13) — Significant but not completely blocking

| # | File | Line | Problem |
|---|---|---|---|
| 11 | `auth-service/src/controllers/auth.controller.ts` | 90 | `isNewUser` always returns `true` — returning users indistinguishable from new users |
| 12 | `user-service/src/routes/user.routes.ts` | 22–26 | `internalUserRouter` exported but never registered — dead code |
| 13 | `worker-service/src/routes/worker.routes.ts` | 37 | `internalWorkerRouter` exported but never registered — dead code |
| 14 | `api-gateway/nginx.conf` | — | No `location /notifications/` block — notification service unreachable via gateway |
| 15 | `admin-panel/src/screens/DashboardScreen.tsx` | 11–20 | Health check paths wrong (e.g. `/auth/health` instead of `/health`) — all 404 |
| 16 | `user-service/src/routes/internal.routes.ts` | 35 | Wallet debit incorrectly increments `cancellationCount` |
| 17 | `booking-service/src/controllers/booking.controller.ts` | 76 | `setTimeout` for booking expiry inside request handler — lost on service restart |
| 18 | `admin-service/src/index.ts` | 171 | `mongoose.connect` called but no models defined — wasted DB connection |
| 19 | `docker-compose.yml` | 247 | `ADMIN_PASSWORD_HASH` is a placeholder — admin login broken out of the box |
| 20 | `docker-compose.yml` | 248 | `ADMIN_JWT_SECRET` hardcoded in plaintext in docker-compose |
| 21 | `worker-service/src/utils/s3.ts` | 29 | `ACL: 'private' as any` — throws 400 on S3 buckets with ACLs disabled (default since Apr 2023) |
| 22 | `package.json` | 11 | `npm run dev` references `docker-compose.dev.yml` which doesn't exist |
| 23 | `worker-service/src/controllers/worker.controller.ts` | 149–155 | `$near` + `.skip()` — MongoDB throws error on paginated geo queries |

### Minor (6)

| # | File | Line | Problem |
|---|---|---|---|
| 24 | `mobile-app/src/screens/workers/WorkerListScreen.tsx` | 146 | `onBook` navigates to `WorkerProfile` instead of creating a booking |
| 25 | `notification-service/src/index.ts` | 44–47 | Twilio client initialized unconditionally — no guard if credentials are missing |
| 26 | `mobile-app/src/constants/index.ts` | — | `pest_control` missing from `SERVICE_CATEGORIES` — customers can't book it |
| 27 | `auth-service/src/config/index.ts` | 9 | Hardcoded fallback JWT secret if `JWT_SECRET` env var not set |
| 28 | `admin-service/src/index.ts` | 16 | Hardcoded fallback admin JWT secret |
| 29 | `shared/types/index.ts` | 23 | `BookingStatus.OFFER_SENT` defined but never used anywhere |
