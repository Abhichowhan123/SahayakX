# ServeEase — Complete Local Setup & Testing Guide
> Follow every step in order. You only need Docker, Node.js, and npm.

---

## What will be running after this guide

| Thing | URL | What it does |
|---|---|---|
| API Gateway (nginx) | `http://<YOUR_IP>:8080` | All API requests go here |
| Admin Panel (web) | `http://<YOUR_IP>:8082` | Manage workers, bookings, users |
| Mobile App (web) | `http://<YOUR_IP>:8081` | Customer & worker app |
| RabbitMQ Dashboard | `http://<YOUR_IP>:15672` | Message queue monitor |
| 9 backend microservices | (internal) | Auth, User, Worker, Catalog, Booking, Payment, Notification, Review, Admin |

> **Find your IP:**
> ```bash
> ipconfig getifaddr en0
> ```
> Use this IP everywhere you see `<YOUR_IP>` when testing from another device.
> For curl commands on this Mac, use `http://localhost:8080`.
> For Expo web in the same browser, either `localhost` or `<YOUR_IP>` works.
> For a real phone on the same WiFi, use `http://<YOUR_IP>:8080`.
> For Android emulator, use `http://10.0.2.2:8080` in the app `.env`.
> RabbitMQ dashboard login is `serveease` / `serveease123`.

---

## BEFORE YOU START

```bash
# 1. Docker installed and running
docker --version
docker info

# 2. Node.js installed
node --version   # v18+ required

# 3. Go to project root
cd /Users/abhishekchowhan/Desktop/MyProject/serveease

# 4. Fix npm cache permissions (do this once)
sudo chown -R $(whoami) ~/.npm
```

---

## STEP 1 — Create all .env files

Run each block in your terminal from the project root.

### Auth Service
```bash
cat > services/auth-service/.env << 'EOF'
PORT=3001
MONGODB_URI=mongodb://mongo-auth:27017/serveease_auth
REDIS_URL=redis://redis:6379
RABBITMQ_URL=amqp://serveease:serveease123@rabbitmq:5672
JWT_SECRET=serveease_local_jwt_secret_dev_only
JWT_EXPIRES=7d
OTP_EXPIRY_MINUTES=10
NODE_ENV=development
TWILIO_ACCOUNT_SID=placeholder
TWILIO_AUTH_TOKEN=placeholder
TWILIO_FROM_NUMBER=+11234567890
ENCRYPTION_KEY=exactly_32_characters_long_key!!
EOF
```

### User Service
```bash
cat > services/user-service/.env << 'EOF'
PORT=3002
NODE_ENV=development
EOF
```

### Worker Service
```bash
cat > services/worker-service/.env << 'EOF'
PORT=3003
NODE_ENV=development
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=
EOF
```

### Catalog Service
```bash
cat > services/catalog-service/.env << 'EOF'
PORT=3004
NODE_ENV=development
EOF
```

### Booking Service
```bash
cat > services/booking-service/.env << 'EOF'
PORT=3005
NODE_ENV=development
EOF
```

### Payment Service
```bash
cat > services/payment-service/.env << 'EOF'
PORT=3006
NODE_ENV=development
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
EOF
```

### Notification Service
```bash
cat > services/notification-service/.env << 'EOF'
PORT=3007
NODE_ENV=development
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
EOF
```

### Review Service
```bash
cat > services/review-service/.env << 'EOF'
PORT=3008
NODE_ENV=development
EOF
```

### Admin Service
```bash
cat > services/admin-service/.env << 'EOF'
PORT=3009
MONGODB_URI=mongodb://mongo-admin:27017/serveease_admin
AUTH_SERVICE_URL=http://auth-service:3001
WORKER_SERVICE_URL=http://worker-service:3003
USER_SERVICE_URL=http://user-service:3002
BOOKING_SERVICE_URL=http://booking-service:3005
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_JWT_SECRET=admin_super_secret_change_in_production_min_32_chars
NODE_ENV=development
EOF
```

### Verify all 9 files exist
```bash
ls services/auth-service/.env \
   services/user-service/.env \
   services/worker-service/.env \
   services/catalog-service/.env \
   services/booking-service/.env \
   services/payment-service/.env \
   services/notification-service/.env \
   services/review-service/.env \
   services/admin-service/.env
```

---

## STEP 2 — Build and start all backend services

```bash
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
docker compose up --build
```

> **First time:** Takes 5–10 minutes (downloads images, compiles TypeScript).
> **After that:** `docker compose up` starts in under 30 seconds.

Wait until you see all services connected:
```
MongoDB connected
Redis connected
RabbitMQ connected
Auth service started
Admin service started
```

---

## STEP 3 — Test the backend locally

Keep `docker compose up --build` running. Open a **new terminal tab** and run the checks below.

### 3.1 — Verify all containers are running

```bash
docker compose ps
```

All 19 containers must show `running`:

- `serveease-gateway`
- `serveease-auth`, `serveease-user`, `serveease-worker`, `serveease-catalog`
- `serveease-booking`, `serveease-payment`, `serveease-notification`, `serveease-review`, `serveease-admin`
- `serveease-mongo-auth`, `serveease-mongo-user`, `serveease-mongo-worker`, `serveease-mongo-booking`
- `serveease-mongo-payment`, `serveease-mongo-review`, `serveease-mongo-admin`
- `serveease-redis`, `serveease-rabbitmq`

### 3.2 — Run gateway and service health tests

```bash
API=http://localhost:8080

curl -s "$API/health"
# Expected: {"status":"ok","gateway":"nginx"}

for path in auth users workers catalog bookings payments notifications reviews admin; do
  echo "$path:"
  curl -s "$API/$path/health"
  echo
done
```

Expected service responses:

| Path | Expected service |
|---|---|
| `/auth/health` | `auth-service` |
| `/users/health` | `user-service` |
| `/workers/health` | `worker-service` |
| `/catalog/health` | `catalog-service` |
| `/bookings/health` | `booking-service` |
| `/payments/health` | `payment-service` |
| `/notifications/health` | `notification-service` |
| `/reviews/health` | `review-service` |
| `/admin/health` | `admin-service` |

Each response should look like `{"status":"ok","service":"..."}`.

### 3.3 — Test public catalog APIs

```bash
curl -s "$API/catalog/categories"
# Expected: {"success":true,"message":"Categories fetched","data":[...]}

curl -s "$API/catalog/pricing"
# Expected: {"success":true,"message":"Pricing guidelines fetched",...}
```

### 3.4 — Test customer auth and protected user APIs

cd /Users/abhishekchowhan/Desktop/MyProject/serveease/mobile-app
npx expo start --web --clear --port 8081

# Same for admin-panel if running:
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/admin-panel
npm run web

Use a new phone number for this test. In development, the API returns the OTP as `data.devOtp`.

```bash
PHONE=+919876543210

curl -s -X POST "$API/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"role\":\"customer\",\"mode\":\"register\"}"
# Copy data.devOtp from the response.

curl -s -X POST "$API/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"paste-dev-otp-here\",\"platform\":\"web\"}"
# Copy data.token from the response.

TOKEN='paste-customer-token-here'

curl -s "$API/users/me" \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"message":"Profile fetched",...}

curl -s -X PUT "$API/users/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Local Test Customer","email":"customer.local@example.com"}'
# Expected: {"success":true,"message":"Profile updated",...}
```

> If you reuse the same phone later, change `mode` from `register` to `login`.

### 3.5 — Test admin login and dashboard

```bash
curl -s -X POST "$API/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
# Copy data.token from the response.

ADMIN_TOKEN='paste-admin-token-here'

curl -s "$API/admin/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected: {"success":true,"message":"Dashboard stats",...}
```

### 3.6 — Test worker search after adding a worker

This returns an empty list until a worker is registered, approved by admin, and set online.

```bash
curl -s "$API/workers?category=plumber&lat=28.6139&lng=77.2090&maxDistanceKm=15"
# Expected before adding a worker: {"success":true,"message":"Workers fetched","data":[]...}
```

---

## STEP 4 — Set up the Admin Panel

```bash
# 1. Create the .env file (replace <YOUR_IP> with your machine's IP from above)
cat > /Users/abhishekchowhan/Desktop/MyProject/serveease/admin-panel/.env << 'EOF'
EXPO_PUBLIC_API_URL=http://<YOUR_IP>:8080
EOF

# 2. Install dependencies
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/admin-panel
npm install

# 3. Start the admin panel
npm run web
# OR: npx expo start --web --port 8082
```

Open `http://<YOUR_IP>:8082` in your browser.

**Login credentials:**
- Username: `admin`
- Password: `admin123`

**What you can do in the admin panel:**
- View all service health checks (Dashboard tab)
- Manage workers (approve/reject/block)
- View all bookings and disputes
- View users and payments

---

## STEP 5 — Set up the Mobile App

```bash
# 1. Create the .env file (replace <YOUR_IP> with your machine's IP from above)
cat > /Users/abhishekchowhan/Desktop/MyProject/serveease/mobile-app/.env << 'EOF'
EXPO_PUBLIC_API_URL=http://<YOUR_IP>:8080
EOF

# 2. Install dependencies
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/mobile-app
npm install

# 3. Start the mobile app (web mode)
npx expo start --web --clear --port 8081
# Press 'w' in the terminal if the browser doesn't open automatically
```

Open `http://<YOUR_IP>:8081` in your browser.

**To run on a physical phone or emulator:**
```bash
# iOS simulator (Mac only)
npm run ios

# Android emulator
npm run android
# Use EXPO_PUBLIC_API_URL=http://10.0.2.2:8080 in mobile-app/.env

# Scan QR code with Expo Go app on your phone
npx expo start
```

---

## STEP 6 — Test the full customer flow

### 6.1 — Login as a new customer

1. Open `http://<YOUR_IP>:8081`
2. Select **"I need a service"**
3. Enter your 10-digit mobile number (e.g. `9876543210`)
4. For a new number, tap **New user? Create Account**. If you tap **Send OTP** first, the app will show **Create Account & Send OTP**.
5. The OTP screen will show a yellow **"DEV MODE — OTP: xxxxxx"** banner and auto-fill the boxes — just tap **Verify & Continue**
6. You are logged in

> If the banner doesn't appear, get the OTP from logs:
> ```bash
> docker logs serveease-auth 2>&1 | grep "OTP"
> ```

### 6.2 — Complete your profile

1. Go to **Profile** tab (bottom nav)
2. Tap **Edit Profile**
3. Enter your Full Name and Email → **Save Changes**
4. Your name will now appear on the profile screen

### 6.3 — Browse services and find a worker

1. Go to **Home** tab
2. Tap a service category (e.g. House Maid, Plumber)
3. A list of available workers nearby will appear

> **Note:** Workers must be registered and set to online before they appear. See Step 7 to add a test worker.

### 6.4 — Book a worker

1. Tap a worker from the list
2. View their profile and pricing
3. Tap **Book Now**
4. Fill in the booking details (date, time, address)
5. Confirm booking

### 6.5 — Check your bookings

1. Go to **Bookings** tab to see all your bookings and their status

---

## STEP 7 — Add a test worker (so you can test booking)

### 7.1 — Register as a worker

1. Open `http://<YOUR_IP>:8081` in a **different browser or incognito window**
2. Select **"I provide service"**
3. Enter a different phone number (e.g. `9876543211`)
4. Tap **Send OTP** — if not registered tap **Create Account & Send OTP**
5. The OTP screen auto-fills in DEV mode — tap **Verify & Continue**
6. Complete the 5-step registration form (name → category → specializations → experience → location)

### 7.2 — Approve the worker from Admin Panel

Workers need admin approval before they appear in search results:
1. Open admin panel → **Workers** tab
2. Find the pending worker → Click **Approve**

### 7.3 — Set worker online

1. Go back to the worker browser
2. Go to **Profile** tab
3. Toggle **Go Online** to ON

---

## STEP 8 — Test booking end-to-end

1. **Customer browser:** Go to Home → select a category → tap the approved worker → Book
2. **Worker browser:** Go to Dashboard → Accept the booking request
3. **Worker browser:** Copy the start-work OTP shown after accepting
4. **Customer browser:** Track the booking in real time under Bookings tab and enter the start-work OTP
5. **Worker browser:** Mark En Route → Start Work → Complete

---

## API QUICK REFERENCE (for Postman testing)

Base URL: `http://<YOUR_IP>:8080`

| Action | Method | URL | Auth | Body / notes |
|---|---|---|---|---|
| Send OTP | POST | `/auth/send-otp` | No | `{ "phone":"+919876543210", "role":"customer", "mode":"register" }` |
| Verify OTP | POST | `/auth/verify-otp` | No | `{ "phone":"+919876543210", "otp":"123456", "platform":"web" }` |
| Get profile | GET | `/users/me` | Bearer customer token | No body |
| Update profile | PUT | `/users/me` | Bearer customer token | `{ "fullName":"Local Test Customer", "email":"customer.local@example.com" }` |
| Worker register | POST | `/workers/register` | Bearer worker token | Worker profile payload from mobile app |
| Set worker online | PUT | `/workers/me/status` | Bearer worker token | `{ "isOnline": true }` after admin approval |
| Search workers | GET | `/workers?category=plumber&lat=28.6139&lng=77.2090&maxDistanceKm=15` | No token required | Returns only verified, online, available workers |
| Create booking | POST | `/bookings` | Bearer customer token | Requires a real `workerId` from search |
| Get my bookings | GET | `/bookings` | Bearer customer/worker token | Optional `?status=accepted` |
| Admin login | POST | `/admin/login` | No | `{ "username":"admin", "password":"admin123" }` |
| Admin dashboard | GET | `/admin/dashboard` | Bearer admin token | No body |

---

## DAILY WORKFLOW

```bash
# Terminal 1 — start backend
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
docker compose up

# Terminal 2 — admin panel
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/admin-panel
npm run web
# Opens at http://<YOUR_IP>:8082

# Terminal 3 — mobile app
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/mobile-app
npx expo start --web --clear --port 8081
# Opens at http://<YOUR_IP>:8081
```

> Make sure `.env` files exist in both `admin-panel/` and `mobile-app/` with `EXPO_PUBLIC_API_URL=http://<YOUR_IP>:8080` before starting.

```bash
# Stop backend (keeps all data)
docker compose down

# Full reset (deletes all data)
docker compose down -v && docker compose up --build
```

---

## VIEW LOGS

Open separate terminals for the services you are debugging:

```bash
# Pretty backend logs with requestId/eventId
npm run logs:backend

# Only errors across backend services
npm run logs:errors

# One service per terminal
npm run logs:auth
npm run logs:booking
npm run logs:worker
npm run logs:admin
```

Every backend log line includes:
- `requestId` — same id for one API request across nginx and service-to-service calls
- `eventId` — unique id for that exact log line
- `service`, `fn`, `tag`, and `action` — useful for search

To follow one broken request, copy its `requestId` and run:

```bash
npm run logs:backend -- --grep <requestId>
```

To search a specific handler/tag:

```bash
npm run logs:backend -- --grep bookingService_createBooking
```

Raw Docker logs are still available:

```bash
docker compose logs -f

# One service
docker compose logs -f auth-service
docker compose logs -f booking-service

# Get OTP in dev mode (shown automatically in the app, or from logs as fallback)
docker logs serveease-auth 2>&1 | grep "OTP"
```

---

## TROUBLESHOOTING

**White screen on mobile app / admin panel**
- The app uses `SecureStore` which doesn't work on web — this is already fixed in the code.
- Try hard refresh: `Cmd+Shift+R`

**Network Error when logging in from browser**
- Make sure `.env` files in both `admin-panel/` and `mobile-app/` use your machine's IP:
  ```
  EXPO_PUBLIC_API_URL=http://<YOUR_IP>:8080
  ```
- Restart Expo after changing `.env`: `npx expo start --web --clear --port 8081`

**"OTP not found or already used"**
- Make sure the phone number format is consistent: always use `+91XXXXXXXXXX`
- Check logs: `docker logs serveease-auth 2>&1 | grep "OTP"`

**"Invalid credentials" on admin login**
- The admin password is set in `services/admin-service/.env` as `ADMIN_PASSWORD=admin123`
- If you changed it, rebuild: `docker compose up --build admin-service`

**Port 80 already in use**
```bash
lsof -i :80
kill -9 <PID>
docker compose up
```

**Container keeps restarting**
```bash
docker compose logs <service-name>
# Look for ERROR or ECONNREFUSED
```

**Full reset**
```bash
docker compose down -v
docker compose up --build
```

---

## EXTERNAL SERVICES (add when ready for production)

| Feature | Service file | Where to get keys |
|---|---|---|
| OTP via SMS | `services/auth-service/.env` | https://console.twilio.com |
| Push notifications | `services/notification-service/.env` | https://console.firebase.google.com |
| Payments | `services/payment-service/.env` | https://dashboard.razorpay.com |
| File uploads (Aadhaar) | `services/worker-service/.env` | https://s3.console.aws.amazon.com |

After adding keys, restart that service:
```bash
docker compose up --build auth-service
```
