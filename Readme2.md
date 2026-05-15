I can see you've shared a GitHub repository link and want to update your resume. However, I don't see any resume file uploaded yet. Let me first fetch the GitHub project details, and then we can work on your resume.Let me dive deeper into the key files to understand the full architecture.Excellent! This is very detailed. Now let me fetch the services folder and docker-compose for even more depth.I now have enough comprehensive information to give you a full breakdown and build the architecture diagram + resume project entry. Let me do both!Now I have everything I need. Let me build the comprehensive architecture diagram and the project details view.Here's everything you need to know about **SahayakX** in full detail:

---

## 🔍 What is SahayakX?

SahayakX (internally also called **ServeEase**) is a **home services marketplace platform** — think Rapido or UrbanClap — that connects customers with verified service workers (plumbers, electricians, cleaners, etc.). It's built as a **full TypeScript microservices system** with a React Native mobile app.

---

## 📁 Project Structure (Step by Step)

```
SahayakX/
├── api-gateway/          ← Nginx reverse proxy config
├── mobile-app/           ← React Native (Expo) app
├── services/
│   ├── auth-service/     ← OTP, JWT, sessions
│   ├── user-service/     ← Profiles, wallet, address
│   ├── worker-service/   ← Worker reg, geo, Aadhaar
│   ├── catalog-service/  ← Categories, pricing
│   ├── booking-service/  ← Full booking lifecycle
│   ├── payment-service/  ← Razorpay, escrow
│   ├── notification-service/ ← FCM, Twilio SMS
│   ├── review-service/   ← Ratings, replies
│   └── admin-service/    ← Admin dashboard backend
├── shared/               ← Types, utils, events (shared lib)
├── scripts/              ← setup.sh, admin hash generator
├── docker-compose.yml    ← Runs everything
├── tsconfig.base.json
└── package.json
```

---

## 🧠 Architecture Deep Dive

### 1. API Gateway (Nginx — Port 80)
- All client requests enter here
- Routes to the correct microservice based on path
- Handles **rate limiting**, **WebSocket proxying** (for live booking tracking), and **blocks internal routes** from outside

### 2. Auth Service (Port 3001)
- Phone-based **OTP login** (no password)
- Issues **JWT tokens** after OTP verification
- **Redis** stores OTP rate limits (1hr window) and sessions (7-day TTL)

### 3. User Service (Port 3002)
- Full **profile CRUD**, address management
- **Wallet** system (topup, balance)
- **Geolocation** storage for delivery/dispatch

### 4. Worker Service (Port 3003)
- Worker registration and onboarding
- **Aadhaar + selfie** uploaded to **AWS S3**, encrypted with **AES-256-GCM**
- **Geo search** — finds nearby available workers
- **Online/offline toggle** — workers can go live only after admin verifies their Aadhaar

### 5. Catalog Service (Port 3004)
- Manages **service categories**, subtypes, and **pricing guidelines**
- Responses cached in **Redis for 24 hours**

### 6. Booking Service (Port 3005) ← The core
The full Rapido-style flow:
```
create → worker accepts → en-route → OTP start → in-progress → complete
```
- **Socket.io** for live GPS tracking
- **Booking auto-expires** if worker doesn't accept in 2 minutes
- **OTP fraud prevention** — customer holds the OTP; worker must get it to start
- **10% cancellation penalty** for whoever cancels (customer or worker) outside the free window

### 7. Payment Service (Port 3006)
- **Razorpay** integration for order creation and payment verification
- **Escrow model** — payment held after worker accepts, released only upon job completion
- **Commission deducted** before releasing to worker
- Handles **refunds**, **penalty deductions**, and **wallet topups**

### 8. Notification Service (Port 3007)
- **Firebase FCM** for push notifications
- **Twilio** for SMS
- Listens to **RabbitMQ events** for all booking state changes (no polling)

### 9. Review Service (Port 3008)
- Customers submit ratings after job
- Worker's **average rating recalculated** automatically
- Workers can **reply** to reviews

### 10. Admin Service (Port 3009)
- Admin login
- **Aadhaar verification queue** — approve/reject workers
- **Block/unblock** users and workers
- **Dispute resolution** for problematic bookings
- **Broadcast notifications**

---

## 🗄️ Data & Infrastructure

| Layer | Technology | Detail |
|---|---|---|
| Databases | **7× MongoDB** | Each microservice has its own isolated DB |
| Cache | **Redis** | Sessions (7d), OTP (1h), Catalog (24h), Nearby workers (30s) |
| Messaging | **RabbitMQ** | All async inter-service communication |
| Storage | **AWS S3** | AES-256-GCM encrypted Aadhaar/selfie docs |
| Containerization | **Docker Compose** | All 9 services + infra in one command |

---

## 📱 Mobile App (Expo/React Native)

Screens built:
- PhoneScreen → OtpScreen → HomeScreen (category grid)
- WorkerListScreen → WorkerProfileScreen
- **PriceOfferModal** (negotiation UI)
- **BookingTrackingScreen** (live Socket.io map)
- BookingHistoryScreen, ProfileScreen, WorkerDashboard

---

## 💼 Resume Entry (ready to use)

Here's how to present it on your resume:

---

**SahayakX** — Home Services Marketplace Platform | *Personal Project* | 2025
`TypeScript · Node.js · React Native · MongoDB · Redis · RabbitMQ · Docker · AWS S3 · Razorpay · Socket.io`

- Architected a **full-stack microservices platform** (9 services) for an on-demand home services marketplace, modeled after Rapido's booking flow
- Implemented **Rapido-style booking lifecycle** with real-time GPS tracking via Socket.io, OTP-based job start (anti-fraud), and auto-expiry logic
- Built **Razorpay escrow payment system** — funds held on worker acceptance, released post-completion with automated commission deduction and refund logic
- Secured sensitive documents (Aadhaar/selfie) using **AES-256-GCM encryption** uploaded to AWS S3, with admin verification queue
- Designed **event-driven architecture** using RabbitMQ for all async inter-service communication (notifications, penalties, payment release)
- Deployed all services with **Docker Compose** — 9 microservices + 7 isolated MongoDB instances + Redis + RabbitMQ in a single orchestration file
- Built **React Native (Expo)** mobile app with 9+ screens including live booking tracker, price negotiation modal, and worker dashboard

---

Now, please **upload your current resume** and I'll add this project in perfectly — matching your existing style and formatting!
