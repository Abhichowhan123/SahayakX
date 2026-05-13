# ServeEase — Local Setup Checklist

## SYSTEM REQUIREMENTS
- [ ] Docker Desktop installed and RUNNING  ← open Docker app before anything else
- [ ] Docker Compose v2+ installed  (`docker compose version`)
- [ ] At least 4 GB RAM free for Docker
- [ ] Ports 80 and 15672 are free on your machine

---

## STEP 1 — Create .env files (one per service)

Each file must exist at the exact path shown. Copy the content as-is for local dev.

### 1.1 Auth Service
**File:** `services/auth-service/.env`
```
PORT=3001
JWT_SECRET=serveease_local_jwt_secret_dev_only
JWT_EXPIRES=7d
NODE_ENV=development
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```
- [ ] File created at `services/auth-service/.env`

---

### 1.2 User Service
**File:** `services/user-service/.env`
```
PORT=3002
NODE_ENV=development
```
- [ ] File created at `services/user-service/.env`

---

### 1.3 Worker Service
**File:** `services/worker-service/.env`
```
PORT=3003
NODE_ENV=development
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=
```
- [ ] File created at `services/worker-service/.env`

---

### 1.4 Catalog Service
**File:** `services/catalog-service/.env`
> No secrets needed — all values are already in docker-compose.yml
```
PORT=3004
NODE_ENV=development
```
- [ ] File created at `services/catalog-service/.env`

---

### 1.5 Booking Service
**File:** `services/booking-service/.env`
```
PORT=3005
NODE_ENV=development
```
- [ ] File created at `services/booking-service/.env`

---

### 1.6 Payment Service
**File:** `services/payment-service/.env`
```
PORT=3006
NODE_ENV=development
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```
- [ ] File created at `services/payment-service/.env`

---

### 1.7 Notification Service
**File:** `services/notification-service/.env`
```
PORT=3007
NODE_ENV=development
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```
- [ ] File created at `services/notification-service/.env`

---

### 1.8 Review Service
**File:** `services/review-service/.env`
```
PORT=3008
NODE_ENV=development
```
- [ ] File created at `services/review-service/.env`

---

### 1.9 Admin Service
> Values already set in docker-compose.yml — no .env file needed for this service.
- [ ] No action needed (admin service reads from docker-compose.yml directly)

---

## STEP 2 — Start Docker

```bash
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
docker compose up --build
```

- [ ] Command runs without "file not found" errors for .env files
- [ ] All images build successfully (takes 2-5 min first time)
- [ ] No port conflict errors on port 80 or 15672

---

## STEP 3 — Verify all containers are up

```bash
docker compose ps
```

Expected containers (all should show `running`):

| Container | Status |
|---|---|
| serveease-gateway | - [ ] running |
| serveease-auth | - [ ] running |
| serveease-user | - [ ] running |
| serveease-worker | - [ ] running |
| serveease-catalog | - [ ] running |
| serveease-booking | - [ ] running |
| serveease-payment | - [ ] running |
| serveease-notification | - [ ] running |
| serveease-review | - [ ] running |
| serveease-admin | - [ ] running |
| serveease-mongo-auth | - [ ] running |
| serveease-mongo-user | - [ ] running |
| serveease-mongo-worker | - [ ] running |
| serveease-mongo-booking | - [ ] running |
| serveease-mongo-payment | - [ ] running |
| serveease-mongo-review | - [ ] running |
| serveease-mongo-admin | - [ ] running |
| serveease-redis | - [ ] running |
| serveease-rabbitmq | - [ ] running |

---

## STEP 4 — Smoke test the API

Run these in your terminal to confirm services respond:

```bash
curl http://localhost/health               # should return {"status":"ok",...}
curl http://localhost/catalog/categories
   # should return service list
```

- [ ] Health check returns `{"status":"ok"}`
- [ ] Catalog endpoint returns service categories

---

## STEP 5 — Run the Admin Panel UI (test all services from browser or Android)

The admin panel is a separate Expo app at `admin-panel/`. It lets you test every service through a UI instead of curl.

### 5.1 Start the admin panel

```bash
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/admin-panel
npx expo start --web --port 8082
```

- Opens in web browser at `http://localhost:8082`
- Press **`a`** → opens on Android emulator (AVD must be running)
- Scan QR with **Expo Go** app → opens on real Android phone

- [ ] Admin panel starts without errors

---

### 5.2 Android device / emulator — set API URL

By default the panel points to `localhost:80`. On Android that doesn't reach your Mac's Docker.

**Android Emulator (AVD):**

Create `admin-panel/.env`:
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:80
```

**Real Android phone (same WiFi):**

Find your Mac's LAN IP first:
```bash
ipconfig getifaddr en0
```

Then create `admin-panel/.env`:
```
EXPO_PUBLIC_API_URL=http://192.168.1.XX:80
```

- [ ] `.env` created with correct IP for your device

---

### 5.3 What each tab tests

| Tab | Service | What you can do |
|---|---|---|
| Dashboard | All | Health check — green = UP, red = DOWN |
| Auth | auth-service (3001) | Send OTP → verify OTP → get JWT token |
| Users | user-service (3002) | Fetch profile, wallet balance |
| Workers | worker-service (3003) | Search nearby by category, get worker detail |
| Catalog | catalog-service (3004) | Load all categories and pricing |
| Bookings | booking-service (3005) | List bookings, filter by status, cancel |
| Payments | payment-service (3006) | View payment history |
| Reviews | review-service (3008) | View reviews for any worker |
| Admin | admin-service (3009) | Verify/reject workers, block users, resolve disputes, broadcast notifications |

- [ ] Dashboard shows all services UP after `docker compose up`
- [ ] Auth tab: OTP sent and JWT token received
- [ ] Catalog tab: categories load from Redis cache
- [ ] Workers tab: search returns workers in your area

---

### 5.4 Full end-to-end test flow (golden path)

1. **Auth tab** → Send OTP for a customer phone → Verify OTP → token saved
2. **Catalog tab** → Load categories → note a category name (e.g. `plumber`)
3. **Workers tab** → Search by that category → copy a worker `_id`
4. **Reviews tab** → Paste the worker `_id` → load their reviews
5. **Admin tab** → Login with admin credentials → load pending workers → approve one
6. **Bookings tab** → List bookings → check status after a booking is created from mobile app

---

## STEP 6 — (Optional) External API Keys

Fill in these `.env` values only when you want to test that specific feature.
Leave blank to skip — the rest of the app still works.

---

## LOGGING WHILE TESTING

Use separate terminals so one noisy service does not hide the error you need:

```bash
npm run logs:errors       # errors across backend services
npm run logs:auth         # auth-service only
npm run logs:booking      # booking-service only
npm run logs:worker       # worker-service only
npm run logs:admin        # admin-service only
```

Each formatted log line has `requestId` and `eventId`. Search one request across services:

```bash
npm run logs:backend -- --grep <requestId>
```

| Feature | Service | Keys Needed |
|---|---|---|
| OTP via SMS | auth-service | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Push notifications | notification-service | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| SMS alerts | notification-service | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Payments (Razorpay) | payment-service | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Aadhaar doc upload | worker-service | `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_S3_BUCKET` |

- [ ] Twilio account created → https://console.twilio.com
- [ ] Firebase project created → https://console.firebase.google.com
- [ ] Razorpay test account created → https://dashboard.razorpay.com
- [ ] AWS S3 bucket created (or use any S3-compatible storage)

---

## USEFUL COMMANDS

```bash
# View logs for all services
docker compose logs -f

# View logs for one service
docker compose logs -f auth-service

# Restart a single service after code change
docker compose up --build auth-service

# Stop everything (keep data)
docker compose down

# Full reset — deletes all data and starts fresh
docker compose down -v
docker compose up --build
```

---

## QUICK STATUS SUMMARY

| | Requirement | Without it |
|---|---|---|
| MUST HAVE | Docker running | Nothing starts |
| MUST HAVE | All 8 .env files created | Docker build fails |
| MUST HAVE | Port 80 free | Nginx won't bind |
| NICE TO HAVE | Twilio keys | OTP/SMS skipped |
| NICE TO HAVE | Firebase keys | Push notifications skipped |
| NICE TO HAVE | Razorpay keys | Payment flow skipped |
| NICE TO HAVE | AWS S3 keys | Document upload skipped |
