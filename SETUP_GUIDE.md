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
> Use this IP everywhere you see `<YOUR_IP>` in this guide.

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
[Auth Service] MongoDB connected
[Auth Service] Redis connected
[Booking Service] MongoDB connected
[Admin Service] Running on port 3009
```

---

## STEP 3 — Verify all containers are running

Open a **new terminal tab**:

```bash
docker compose ps
```

All 19 containers must show `running`. Check health specifically:
```bash
curl http://localhost:8080/health
# Expected: {"status":"ok","gateway":"nginx"}

curl http://localhost:8080/auth/health
# Expected: {"status":"ok","service":"auth-service"}
```

---

## STEP 4 — Set up the Admin Panel

```bash
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/admin-panel
npm install
npx expo start --web
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
cd /Users/abhishekchowhan/Desktop/MyProject/serveease/mobile-app
npm install
npx expo start --web --clear
```

Open `http://<YOUR_IP>:8081` in your browser (press `w` in the terminal if browser doesn't open).

---

## STEP 6 — Test the full customer flow

### 6.1 — Login as a new customer

1. Open `http://<YOUR_IP>:8081`
2. Select **"I need a service"**
3. Enter your 10-digit mobile number (e.g. `9876543210`)
4. Click **Send OTP**
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
2. Tap a service category (e.g. Cleaning, Plumbing)
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

### 7.2 — Set worker online

1. Go to **Profile** tab
2. Toggle **Go Online** to ON

### 7.3 — Approve the worker from Admin Panel

Workers need admin approval before they appear in search results:
1. Open admin panel → **Workers** tab
2. Find the pending worker → Click **Approve**

---

## STEP 8 — Test booking end-to-end

1. **Customer browser:** Go to Home → select a category → tap the approved worker → Book
2. **Worker browser:** Go to Dashboard → Accept the booking request
3. **Customer browser:** Track the booking in real time under Bookings tab
4. **Worker browser:** Mark En Route → Start Work (customer confirms with OTP) → Complete

---

## API QUICK REFERENCE (for Postman testing)

Base URL: `http://<YOUR_IP>:8080`

| Action | Method | URL | Auth |
|---|---|---|---|
| Send OTP | POST | `/auth/send-otp` | No |
| Verify OTP | POST | `/auth/verify-otp` | No |
| Get profile | GET | `/users/me` | Bearer token |
| Update profile | PUT | `/users/me` | Bearer token |
| Search workers | GET | `/workers?category=cleaning&lat=28.6&lng=77.2` | Bearer token |
| Create booking | POST | `/bookings` | Bearer token |
| Get my bookings | GET | `/bookings` | Bearer token |
| Admin login | POST | `/admin/login` | No |
| Admin dashboard | GET | `/admin/dashboard` | Admin token |

---

## DAILY WORKFLOW

```bash
# Start everything
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
docker compose up

# In separate terminals:
cd admin-panel && npx expo start --web
cd mobile-app  && npx expo start --web --clear
```

```bash
# Stop backend (keeps all data)
docker compose down

# Full reset (deletes all data)
docker compose down -v && docker compose up --build
```

---

## VIEW LOGS

```bash
# All services
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
- Restart Expo after changing `.env`: `npx expo start --web --clear`

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
