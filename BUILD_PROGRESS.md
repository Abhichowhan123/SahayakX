# ServeEase — Build Progress Tracker
> Auto-updated by Claude Code. Used for session resumption.

## Project
Home services marketplace (like Rapido) — TypeScript microservices + MongoDB + Redis

## Location
`/Users/abhishekchowhan/Desktop/MyProject/serveease/`

## Port Map
| Service             | Port |
|---------------------|------|
| API Gateway (Nginx) | 80   |
| Auth Service        | 3001 |
| User Service        | 3002 |
| Worker Service      | 3003 |
| Catalog Service     | 3004 |
| Booking Service     | 3005 |
| Payment Service     | 3006 |
| Notification Svc    | 3007 |
| Review Service      | 3008 |
| Admin Service       | 3009 |
| RabbitMQ UI         | 15672|

## Completed ✅
- [x] Root project structure (`package.json`, `tsconfig.base.json`, `.gitignore`)
- [x] Shared package (`/shared/types/index.ts`, `/shared/utils/index.ts`, `/shared/events/index.ts`)
- [x] Auth Service — OTP send/verify, JWT, Redis session caching, rate limiting
- [x] User Service — profile CRUD, address management, saved workers, wallet, geo location
- [x] Worker Service — registration, Aadhaar + selfie upload to S3 (AES-256 encrypted), geo search, online/offline toggle
- [x] Catalog Service — categories, sub-types, pricing guidelines, Redis-cached
- [x] Booking Service — full Rapido-style flow (create → accept → en-route → OTP start → complete), Socket.io live tracking, cancellation + penalty logic
- [x] Payment Service — Razorpay order/verify, escrow hold, release to worker (minus commission), refund, penalty deduction, wallet topup
- [x] Notification Service — Firebase FCM push + Twilio SMS, RabbitMQ consumers for all booking events
- [x] Review Service — submit review, update worker average rating, worker reply
- [x] Admin Service — login, verification queue (approve/reject Aadhaar), block users/workers, dispute resolution, broadcast notifications
- [x] API Gateway — Nginx reverse proxy, rate limiting, WebSocket proxy, internal routes blocked
- [x] Docker Compose — all 9 services + 7 MongoDB instances + Redis + RabbitMQ

## Next Steps (Phase 2) 🔜
- [x] Add `tsconfig.json` to each service (copy from auth-service pattern)
- [x] Add `.env.example` files for each service
- [x] Add internal endpoints to worker-service: `/internal/workers/stats`, `/internal/workers/pending`, `/internal/workers/:id/rating`, `/internal/workers/:id/verification`, `/internal/workers/:id/block`, `/internal/workers/:id/wallet`
- [x] Add internal endpoints to user-service: `/internal/users/:phone/block`, `/internal/users/:phone/wallet`, `/internal/users/stats`
- [x] Add internal endpoints to booking-service: `/internal/bookings`, `/internal/bookings/stats`, `/internal/bookings/disputed`, `/internal/bookings/:id/resolve`, `/internal/bookings/:id/dispute`
- [x] Write `scripts/setup.sh` (installs all deps + copies .env files)
- [x] Write `scripts/generate-admin-hash.js` (bcrypt hash generator)
- [x] React Native mobile app scaffold (Expo) — `/mobile-app/` — PhoneScreen, OtpScreen, HomeScreen (category grid), WorkerListScreen, WorkerProfileScreen, PriceOfferModal (matches screenshot), BookingTrackingScreen (Socket.io live), BookingHistoryScreen, ProfileScreen, WorkerDashboard
- [x] Admin panel (Expo app) — `/admin-panel/` — Dashboard (health), Auth Test, Users, Workers, Catalog, Bookings, Payments, Reviews, Admin screens. Runs on web (`npm start` → `w`) and Android (`a` or Expo Go + QR)
### Phase 3 — User-Facing Features (build in this order)

- [ ] **START HERE → In-app chat** — Socket.io rooms per booking (customer ↔ worker); backend room logic in booking-service, chat screen in mobile-app
- [ ] Scheduled bookings — book for a future date/time slot; add `scheduledAt` field to booking model + cron job to auto-dispatch
- [ ] SOS / safety button — one-tap alert to admin + emergency contact; add endpoint in booking-service + SOS screen in mobile-app

### Phase 4 — Growth Features

- [ ] Referral + loyalty points — referral code on signup, points earned per completed booking, redeem against wallet
- [ ] Subscription / monthly plan — recurring plan for maid/cook/gym trainer; fixed monthly charge, auto-booking each day
- [ ] AI price suggestion — suggest fair price based on location + demand + time of day (can use simple heuristic first, ML later)
- [ ] Multi-language (i18n) — Hindi + regional languages; use i18n-js library in mobile-app

### Phase 5 — Production Readiness

- [ ] Unit + integration tests — Jest tests for each service; start with auth-service and booking-service
- [ ] CI/CD pipeline — GitHub Actions: lint → test → docker build → push to registry on merge to main
- [ ] Kubernetes manifests — k8s/ folder with Deployment + Service + HPA for each microservice

## Bug Fixes (README audit — 29 issues)

### Critical (10)
- [x] Fix #1: mobile-app/src/api/index.ts:49 — platform 'mobile' not accepted by Joi ('ios'|'android'|'web')
- [x] Fix #2: booking-service/src/controllers/booking.controller.ts:258–259 — cancelBooking publishes oldStatus === newStatus
- [x] Fix #3: shared/utils/index.ts:17 — Hardcoded AES fallback key
- [x] Fix #4: shared/utils/index.ts:5–6 — Math.random() for OTP generation (not crypto-secure)
- [x] Fix #5: admin-panel/src/api/client.ts:32 — PUT /admin/workers/:id/approve → POST /admin/workers/:workerId/verify
- [x] Fix #6: admin-panel/src/api/client.ts:42 — GET /admin/stats → GET /admin/dashboard
- [x] Fix #7: admin-panel/src/api/client.ts:41 — POST /admin/notifications/broadcast → POST /admin/broadcast-notification
- [x] Fix #8: admin-panel/src/api/client.ts:31 — GET /admin/workers/pending → GET /admin/workers/pending-verification
- [x] Fix #9: booking-service/src/controllers/booking.controller.ts:166 — startWork always publishes oldStatus WORKER_EN_ROUTE
- [x] Fix #10: payment-service/src/index.ts — PAYMENT_PROCESSED queue published but never consumed

### Warning (13)
- [x] Fix #11: auth-service/src/controllers/auth.controller.ts:90 — isNewUser always returns true
- [x] Fix #12: user-service/src/routes/user.routes.ts:22–26 — internalUserRouter exported but never registered
- [x] Fix #13: worker-service/src/routes/worker.routes.ts:37 — internalWorkerRouter exported but never registered
- [x] Fix #14: api-gateway/nginx.conf — No location /notifications/ block
- [x] Fix #15: admin-panel/src/screens/DashboardScreen.tsx:11–20 — Health check paths wrong
- [x] Fix #16: user-service/src/routes/internal.routes.ts:35 — Wallet debit increments cancellationCount
- [x] Fix #17: booking-service/src/controllers/booking.controller.ts:76 — setTimeout expiry lost on restart
- [x] Fix #18: admin-service/src/index.ts:171 — mongoose.connect but no models defined
- [x] Fix #19: docker-compose.yml:247 — ADMIN_PASSWORD_HASH placeholder
- [x] Fix #20: docker-compose.yml:248 — ADMIN_JWT_SECRET hardcoded plaintext
- [x] Fix #21: worker-service/src/utils/s3.ts:29 — ACL: 'private' as any throws 400
- [x] Fix #22: package.json:11 — npm run dev references missing docker-compose.dev.yml
- [x] Fix #23: worker-service/src/controllers/worker.controller.ts:149–155 — $near + .skip() MongoDB error

### Minor (6)
- [x] Fix #24: mobile-app/src/screens/workers/WorkerListScreen.tsx:146 — onBook navigates to WorkerProfile instead of booking
- [x] Fix #25: notification-service/src/index.ts:44–47 — Twilio client initialized unconditionally
- [x] Fix #26: mobile-app/src/constants/index.ts — pest_control missing from SERVICE_CATEGORIES
- [x] Fix #27: auth-service/src/config/index.ts:9 — Hardcoded fallback JWT secret
- [x] Fix #28: admin-service/src/index.ts:16 — Hardcoded fallback admin JWT secret
- [x] Fix #29: shared/types/index.ts:23 — BookingStatus.OFFER_SENT defined but never used

## Wave-Based Dispatch (Nearby Worker Assignment) — Implemented

Instead of customer picking a specific worker, the system now:
- Customer selects category + location → booking saved as `SEARCHING` (no workerId)
- `dispatchWave(bookingId)` finds 5–8 nearby verified workers via Redis GEO (`workers:online`)
- Publishes `BOOKING_DISPATCHED` → notification-service sends push/SMS to all wave workers
- `acceptBooking` uses atomic Redis lock `SET booking:{id}:lock {workerId} NX EX 60` — first worker to accept wins, others get "already taken"
- Accepted worker removed from GEO (BUSY) until job completes/cancels

Files changed:
- `shared/utils/index.ts` — `setRedisGeoClient`, `addOnlineWorker`, `removeOnlineWorker`, `findNearbyWorkers`
- `shared/events/index.ts` — added `QueueName.BOOKING_DISPATCHED`
- `services/worker-service/src/index.ts` — creates Redis GEO client on startup
- `services/worker-service/src/controllers/worker.controller.ts` — `toggleOnline`/`updateLocation` sync Redis GEO
- `services/booking-service/src/index.ts` — creates Redis lock client on startup
- `services/booking-service/src/controllers/booking.controller.ts` — `createBooking` (no workerId), `dispatchWave`, `acceptBooking` (atomic lock)
- `services/notification-service/src/index.ts` — consumes `BOOKING_DISPATCHED`, notifies wave workers

## Key Design Decisions
- Each microservice has its OWN MongoDB database (true microservice isolation)
- Payment held in escrow after worker accepts; released only after job completion
- Aadhaar card number + bank account number encrypted with AES-256-GCM before storing
- 10% penalty charged to whoever cancels (customer OR worker) outside the free window
- Worker can only go online after admin verifies their Aadhaar
- Booking auto-expires if worker doesn't accept within 2 minutes
- OTP sent to customer; worker must get it from customer to start the job (prevents fraud)
- RabbitMQ used for all async inter-service communication (notifications, penalties, payment release)
- Redis caches: sessions (7d), OTP rate limits (1h), catalog (24h), nearby workers (30s)

## Run Command
```bash
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
docker-compose up --build
```
