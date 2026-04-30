# Q ME NOW

**Intelligent queue management + predictive analytics platform.**

Skip the wait. Join from anywhere.

---

## Repository Structure

```
QMe-Now/
├── apps/
│   ├── website/          # User-facing web app (React + Vite + Supabase Auth)
│   ├── admin-desktop/    # Admin desktop app (Electron + React → Windows .exe)
│   ├── mobile/           # Mobile app (Expo + React Native)
│   ├── backend/          # REST API (Node.js + Express + MySQL)
│   └── model/            # Predictive analytics (Jupyter + Python)
├── database/
│   ├── schema.sql        # Complete MySQL schema (19 tables)
│   ├── seed.sql          # Demo data (TAJ, NHT, PICA) + 1,500 rows of history
│   └── analytics_exports.sql  # CSV export queries for the Jupyter model
├── docs/
│   └── QMeNow_API.postman_collection.json  # Postman collection
├── docker-compose.yml    # MySQL + backend API
└── .env.example          # Root environment variables
```

---

## Products

| Product | Stack | Description |
|---|---|---|
| **User Website** | React + Vite + TypeScript + TailwindCSS | Landing page, business search, queue join, live ticket |
| **Admin Desktop** | Electron + React + Vite | Role-based dashboards for staff, managers, executives → .exe |
| **Mobile App** | Expo + React Native + TypeScript | Saved businesses, queue join, live ticket, notifications |
| **Backend API** | Node.js + Express + MySQL | Shared REST API for all products |
| **Predictive Model** | Jupyter + Python + scikit-learn | Peak hours, best time to visit, wait time prediction |

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/itsdebrakayes/QMe-Now.git
cd QMe-Now
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and fill in:
# - MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD
# - SUPABASE_URL, SUPABASE_SERVICE_KEY (from your Supabase project)
```

### 3. Start MySQL + Backend API with Docker Compose

```bash
docker compose up -d
```

This will:
- Start MySQL 8 on port 3306
- Auto-run database/schema.sql and database/seed.sql on first start
- Start the Express API on port 4000
- Health check: http://localhost:4000/health

Optional — Start Adminer (database GUI) on port 8080:
```bash
docker compose --profile tools up -d
```

### 4. Start the User Website

```bash
cd apps/website
cp .env.example .env
npm install
npm run dev
# http://localhost:5173
```

### 5. Start the Admin Desktop App

```bash
cd apps/admin-desktop
cp .env.example .env
npm install
npm run dev
```

### 6. Start the Mobile App

```bash
cd apps/mobile
npm install
npx expo start
```

### 7. Run the Predictive Model

```bash
cd apps/model
pip install pandas numpy scikit-learn matplotlib seaborn jupyter mysql-connector-python python-dotenv
cp .env.example .env
python scripts/export_csv.py
jupyter notebook
python scripts/import_predictions.py
```

---

## Authentication Flow

Supabase Auth issues a JWT on login. Every API request carries that JWT.
The backend verifies it and looks up the MySQL user/staff record.
Supabase is Auth-only. All application data lives in MySQL.

---

## Admin Roles

| Role | Dashboard | Access |
|---|---|---|
| line_staff | Staff Dashboard | Own queue — call, complete, skip, no-show |
| manager | Manager Dashboard | All queues in branch, staff assignments, branch analytics |
| executive | Executive Dashboard | Cross-branch analytics, trends, predictive insights |

---

## Database

The MySQL schema covers 19 tables across all domains.
See database/README.md for full schema documentation.

---

## API Reference

Import docs/QMeNow_API.postman_collection.json into Postman.
Set base_url to http://localhost:4000/api and token to a valid Supabase JWT.
See apps/backend/README.md for the full endpoint reference.

---

## Build Admin Desktop App (.exe)

```powershell
cd apps\admin-desktop
npm install
npm run build:win
```

Output: apps\admin-desktop\release\Q ME NOW Admin Setup 1.0.0.exe

---

## Demo Data

| Organization | Branches | Services |
|---|---|---|
| TAJ (Tax Administration Jamaica) | 4 | 6 |
| NHT (National Housing Trust) | 3 | 4 |
| PICA (Passport, Immigration and Citizenship Agency) | 2 | 5 |
