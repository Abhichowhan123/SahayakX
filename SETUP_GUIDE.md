# ServeEase — Complete Local Setup Guide
> Start here. You only need Docker. Follow every step in order.

---

## What you will have running after this guide

| Thing | What it does |
|---|---|
| Nginx (port 80) | API Gateway — your app talks to this |
| 9 backend services | Auth, User, Worker, Catalog, Booking, Payment, Notification, Review, Admin |
| 7 MongoDB databases | One isolated DB per service |
| Redis | Caching + session store |
| RabbitMQ (port 15672) | Message queue between services (has a browser UI) |

---

## BEFORE YOU START — Check these

Open your terminal and run:

```bash
# 1. Confirm Docker is installed
docker --version
# Expected: Docker version 29.x.x

# 2. Confirm Docker is RUNNING (Docker Desktop must be open)
docker info
# Expected: prints server info — if it says "Cannot connect to Docker daemon" open Docker Desktop app first

# 3. Confirm port 80 is free
lsof -i :80
# Expected: no output = port is free. If something shows, stop that process first.

# 4. Go to the project folder
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
```

---

## STEP 1 — Create the .env files

Each service needs its own `.env` file. Run each block below one by one in your terminal.
> The values with blank `=` are for external services (Twilio, Razorpay etc.) — leave them blank for now. The app still runs.

---

### Auth Service
```bash
cat > services/auth-service/.env << 'EOF'
PORT=3001
JWT_SECRET=serveease_local_jwt_secret_dev_only
JWT_EXPIRES=7d
NODE_ENV=development
TWILIO_ACCOUNT_SID= 
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
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

---

### Verify all 8 files were created
```bash
ls services/auth-service/.env \
   services/user-service/.env \
   services/worker-service/.env \
   services/catalog-service/.env \
   services/booking-service/.env \
   services/payment-service/.env \
   services/notification-service/.env \
   services/review-service/.env
```
Expected: all 8 file paths print without any "No such file" error.

---

## STEP 2 — Build and start everything

```bash
docker compose up --build
```

> **First time:** This downloads Docker images and compiles all TypeScript code. Takes 3–6 minutes.
> **After that:** Use `docker compose up` (no `--build`) — starts in under 30 seconds.

You will see a lot of log output. This is normal. Wait until you see logs from all services saying they connected to MongoDB and RabbitMQ.

Look for lines like:
```
serveease-auth      | [Auth Service] Connected to MongoDB
serveease-auth      | [Auth Service] Connected to Redis
serveease-booking   | [Booking Service] Connected to MongoDB
serveease-rabbitmq  | Server startup complete
```

---

## STEP 3 — Verify everything is running

Open a **new terminal tab** and run:

```bash
cd /Users/abhishekchowhan/Desktop/MyProject/serveease

# Check all containers are running
docker compose ps
```

You should see 19 containers all with status `running`:

```
serveease-gateway         running
serveease-auth            running
serveease-user            running
serveease-worker          running
serveease-catalog         running
serveease-booking         running
serveease-payment         running
serveease-notification    running
serveease-review          running
serveease-admin           running
serveease-mongo-auth      running
serveease-mongo-user      running
serveease-mongo-worker    running
serveease-mongo-booking   running
serveease-mongo-payment   running
serveease-mongo-review    running
serveease-mongo-admin     running
serveease-redis           running
serveease-rabbitmq        running
```

---

## STEP 4 — Test the API is working

```bash
# Gateway health check
curl http://localhost/health
```
Expected response:
```json
{"status":"ok","gateway":"nginx"}
```

```bash
# Test auth service via gateway
curl http://localhost/auth/health
```
Expected response:
```json
{"status":"ok","service":"auth-service"}
```

```bash
# Test catalog service
curl http://localhost/catalog/categories
```
Expected response: JSON list of service categories (maid, plumber, electrician etc.)

---

## STEP 5 — Open the RabbitMQ dashboard (optional)

Open your browser and go to:
```
http://localhost:15672
```
- Username: `serveease`
- Password: `serveease123`

This shows you all the message queues between services in real time.

---

## HOW TO USE GOING FORWARD

### Start the system each day
```bash
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
docker compose up
```

### Stop the system
```bash
# Stop but keep all data
docker compose down

# Stop and DELETE all data (fresh start)
docker compose down -v
```

### View logs
```bash
# All services together
docker compose logs -f

# Just one service
docker compose logs -f auth-service
docker compose logs -f booking-service
docker compose logs -f payment-service
```

### Rebuild after code changes
```bash
# Rebuild and restart just one service (faster)
docker compose up --build auth-service

# Rebuild everything
docker compose up --build
```

### Open a shell inside a container (for debugging)
```bash
docker exec -it serveease-auth sh
docker exec -it serveease-mongo-auth mongosh serveease_auth
```

---

## API ROUTES REFERENCE

All requests go to `http://localhost` (port 80). Nginx routes them internally.

| URL prefix | Goes to | Port inside Docker |
|---|---|---|
| `http://localhost/auth/` | Auth Service | 3001 |
| `http://localhost/users/` | User Service | 3002 |
| `http://localhost/workers/` | Worker Service | 3003 |
| `http://localhost/catalog/` | Catalog Service | 3004 |
| `http://localhost/bookings/` | Booking Service | 3005 |
| `http://localhost/payments/` | Payment Service | 3006 |
| `http://localhost/reviews/` | Review Service | 3008 |
| `http://localhost/admin/` | Admin Service | 3009 |
| `http://localhost/socket.io/` | Real-time tracking (WebSocket) | 3005 |

---

## EXTERNAL SERVICES — Add keys when ready

Leave these blank now. Add them to the `.env` file of the matching service when you want to test that feature.

| Feature | Add keys to | Where to get keys |
|---|---|---|
| OTP login via SMS | `services/auth-service/.env` | https://console.twilio.com |
| Push notifications (FCM) | `services/notification-service/.env` | https://console.firebase.google.com |
| SMS alerts | `services/notification-service/.env` | https://console.twilio.com |
| Payments | `services/payment-service/.env` | https://dashboard.razorpay.com |
| Aadhaar doc upload | `services/worker-service/.env` | https://s3.console.aws.amazon.com |

After adding a key, restart just that service:
```bash
docker compose up --build <service-name>
# example:
docker compose up --build auth-service
```

---

## TROUBLESHOOTING

**Problem:** `docker compose up --build` fails with "file not found"
```
Fix: Make sure you're in the right folder
cd /Users/abhishekchowhan/Desktop/MyProject/serveease
ls docker-compose.yml   # this file must exist
```

**Problem:** A container keeps restarting
```bash
# See the error
docker compose logs auth-service
# Look for lines with ERROR or ECONNREFUSED
```

**Problem:** Port 80 is already in use
```bash
lsof -i :80          # find what's using port 80
kill -9 <PID>        # stop it (replace <PID> with the number shown)
docker compose up
```

**Problem:** Want to completely reset and start fresh
```bash
docker compose down -v          # removes containers + volumes (all data deleted)
docker compose up --build       # rebuild from scratch
```
