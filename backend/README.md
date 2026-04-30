# Q ME NOW — Backend API

Node.js/Express REST API that serves as the data layer for the Q ME NOW platform. It connects to a **MySQL** database and verifies user identity using **Supabase Auth JWTs**.

---

## Architecture

```
Browser / Mobile App
        │
        │  Supabase Auth (login / signup)
        ▼
Supabase Auth Service ──► issues JWT
        │
        │  All data requests (Bearer JWT)
        ▼
  This Express API  ──► MySQL (qme_now database)
```

Supabase is used **only** for authentication. All application data (queues, tickets, staff, analytics, predictions, etc.) lives in MySQL.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| MySQL | 8.0+ |
| Supabase project | Any (Auth only) |

---

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your MySQL credentials and Supabase service role key
```

### 3. Create the database

```bash
mysql -u root -p < ../database/schema.sql
```

### 4. Load seed data (optional, recommended for development)

```bash
mysql -u root -p qme_now < ../database/seed.sql
```

### 5. Start the server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:4000`.

---

## API Reference

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Server health check |

### Auth Sync

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/sync-user` | Bearer JWT | Mirror Supabase user into MySQL |
| GET | `/api/auth/me` | Bearer JWT | Get MySQL user/staff record |

### Businesses

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/businesses` | None | List all active businesses |
| GET | `/api/businesses/:slug` | None | Get one business by slug |
| POST | `/api/businesses` | Executive | Create a business |
| PUT | `/api/businesses/:id` | Executive | Update a business |

### Branches

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/branches?business_id=` | None | List branches |
| GET | `/api/branches/:id` | None | Get one branch |
| POST | `/api/branches` | Manager+ | Create a branch |
| PUT | `/api/branches/:id` | Manager+ | Update a branch |

### Services

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/services?business_id=` | None | List services |
| GET | `/api/services/:id` | None | Get one service |
| POST | `/api/services` | Manager+ | Create a service |
| PUT | `/api/services/:id` | Manager+ | Update a service |

### Queues

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/queues?branch_id=&service_id=&date=` | None | List today's queues |
| GET | `/api/queues/:id` | None | Get queue with ticket list |
| POST | `/api/queues` | Staff+ | Open a queue |
| PUT | `/api/queues/:id/close` | Manager+ | Close a queue |

### Tickets

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/tickets` | Bearer JWT | Join a queue |
| GET | `/api/tickets/:id` | None | Get ticket status |
| GET | `/api/tickets/queue/:queue_id` | Staff+ | All tickets for a queue |
| PUT | `/api/tickets/:id/status` | Staff+ | Update ticket status |

### Staff

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/staff?business_id=` | Manager+ | List staff |
| GET | `/api/staff/:id` | Manager+ | Get one staff member |
| POST | `/api/staff` | Manager+ | Create staff member |
| PUT | `/api/staff/:id` | Manager+ | Update staff member |

### Assignments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/assignments?branch_id=&date=` | Manager+ | Get assignments |
| POST | `/api/assignments` | Manager+ | Assign staff to counter |
| DELETE | `/api/assignments/:id` | Manager+ | Remove assignment |

### Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/analytics/summary?business_id=` | Manager+ | Daily summaries |
| GET | `/api/analytics/heatmap?business_id=` | Manager+ | Hourly traffic heatmap |
| GET | `/api/analytics/services?business_id=` | Manager+ | Service performance |
| GET | `/api/analytics/staff?business_id=` | Manager+ | Staff performance |

### Predictions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/predictions?business_id=` | None | Get predictive insights |
| POST | `/api/predictions` | Executive | Save Jupyter model output |

### User Data

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/history` | Bearer JWT | Visit history |
| GET | `/api/saved` | Bearer JWT | Saved businesses |
| POST | `/api/saved/:business_id` | Bearer JWT | Save a business |
| DELETE | `/api/saved/:business_id` | Bearer JWT | Unsave a business |
| GET | `/api/notifications` | Bearer JWT | Notifications |
| POST | `/api/notifications` | Staff+ | Send notification |
| PUT | `/api/notifications/:id/read` | Bearer JWT | Mark as read |

---

## Role Hierarchy

| Role | Access |
|---|---|
| `line_staff` | Own queue operations (call, complete, skip, no-show) |
| `manager` | All branch operations + staff management + analytics |
| `executive` | All manager access + cross-branch + predictions + business management |

---

## Connecting the Jupyter Model

1. Export CSV data using the queries in `../database/analytics_exports.sql`
2. Run the Jupyter notebooks in `../analytics/notebooks/`
3. POST the results to `POST /api/predictions` using an executive JWT
4. The frontend will automatically display the new predictions

---

## Database

See `../database/` for:
- `schema.sql` — Full MySQL schema
- `seed.sql` — Demo data (TAJ, NHT, PICA)
- `analytics_exports.sql` — CSV export queries for the Jupyter model
