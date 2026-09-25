# Staging Deployment Guide

This document outlines the required infrastructure, environment configurations, and deployment steps to set up the Event Booking System for staging and UAT (User Acceptance Testing).

---

## 1. Environment Distinctions

**Local Development:**
- Used by developers.
- Features `APP_DEBUG=true`, `APP_ENV=local`.
- Uses SQLite or local MySQL.
- Uses local `npm run dev`.

**Staging / UAT (This Guide):**
- Used by QA, product managers, and beta users.
- Mirrors production infrastructure.
- Features `APP_DEBUG=false`, `APP_ENV=staging`.
- Uses persistent MySQL, secure caching, and queue workers.
- Uses built/compiled frontend (`npm run build`).

**Production:**
- Live customer environment. Same technical setup as staging but with production secrets and live Telebirr/CBE credentials.

---

## 2. Backend Requirements & Setup

### Prerequisites
- **PHP:** 8.2+
- **Composer:** 2.x
- **Database:** MySQL 8.0+

### Staging Environment Variables (`.env`)
DO NOT copy a local `.env` to staging. Use `.env.example` as a template and configure the following for staging:

```env
APP_NAME="Event Booking System"
APP_ENV=staging
APP_DEBUG=false
APP_URL=https://staging-api.yourdomain.com
FRONTEND_URL=https://staging.yourdomain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=event_booking_staging
DB_USERNAME=staging_user
DB_PASSWORD=YOUR_SECURE_PASSWORD

# Ensure the frontend domain is listed here without protocols
SANCTUM_STATEFUL_DOMAINS=staging.yourdomain.com

QUEUE_CONNECTION=database
CACHE_STORE=database
```

### Staging Deployment Commands
When deploying new backend code to staging, execute the following commands in the `backend` directory:

```bash
# 1. Install optimized dependencies
composer install --no-dev --optimize-autoloader

# 2. Run database migrations safely (Do NOT use migrate:fresh in staging)
php artisan migrate --force

# 3. Create storage link (only needed once)
php artisan storage:link

# 4. Cache configurations & routes for performance
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Queue Worker Configuration
The application requires a background queue worker to process notifications and delayed jobs (if added). Configure a process monitor (e.g., Supervisor) to continuously run:

```bash
php artisan queue:work --tries=3
```

### Scheduler (Cron) Configuration
The application requires a cron job to handle booking expirations automatically. Add the following to your server's crontab (running every minute):

```bash
* * * * * cd /path-to-your-project/backend && php artisan schedule:run >> /dev/null 2>&1
```

The scheduler guarantees that `php artisan bookings:expire` runs automatically.

---

## 3. Frontend Requirements & Setup

### Prerequisites
- **Node.js:** 18.x or 20.x
- **NPM:** 9.x+

### Staging Environment Variables (`.env.local`)
Create a `.env.local` file in the `frontend` directory:

```env
# Point to the Staging Backend API
NEXT_PUBLIC_API_URL=https://staging-api.yourdomain.com
```
*Note: Do NOT hardcode staging secrets. `NEXT_PUBLIC_` variables are embedded into the client bundle.*

### Staging Deployment Commands
When deploying the Next.js application:

```bash
# 1. Install dependencies
npm ci

# 2. Build the optimized production bundle
npm run build

# 3. Start the Next.js server (use PM2 for process management)
npm start
```

---

## 4. Payment Integrations Rule
For staging, **Telebirr** and **CBE** are **BLOCKED**. 
Do not mock provider responses or invent APIs. The `PaymentProviderInterface` is designed to fail safely until official staging/sandbox credentials from the providers are configured in the `.env` file. You may test the "cash" payment workflow end-to-end.
