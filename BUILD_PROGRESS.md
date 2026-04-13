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
- [ ] Add `tsconfig.json` to each service (copy from auth-service pattern)
- [ ] Add `.env` files for each remaining service (copy from auth-service `.env.example` pattern)
- [ ] Add internal endpoints to worker-service: `/internal/workers/stats`, `/internal/workers/pending`, `/internal/workers/:id/rating`, `/internal/workers/:id/verification`, `/internal/workers/:id/block`, `/internal/workers/:id/wallet`
- [ ] Add internal endpoints to user-service: `/internal/users/:id/block`, `/internal/users/:id/wallet`
- [ ] Add internal endpoints to booking-service: `/internal/bookings`, `/internal/bookings/stats`, `/internal/bookings/disputed`, `/internal/bookings/:id/resolve`
- [ ] Add `tsconfig.json` files to remaining services
- [ ] Write install script (`scripts/setup.sh`)
- [ ] React Native mobile app scaffold (Expo)
- [ ] React.js admin web panel scaffold
- [ ] Scheduled booking feature (book for future date)
- [ ] Subscription/monthly plan model
- [ ] In-app chat (Socket.io rooms per booking)
- [ ] SOS / safety button
- [ ] Referral + loyalty points system
- [ ] Multi-language (i18n)
- [ ] AI price suggestion (based on location + demand)
- [ ] Kubernetes manifests (k8s/)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Unit + integration tests

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
