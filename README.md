# AWS Route 53 Console Clone

A full-stack, pixel-faithful clone of the AWS Route 53 management console. Features a SQLite-backed mock authentication system with bcrypt password hashing, JWT session management, full CRUD for Hosted Zones and DNS Records across all 9 standard Route 53 record types, and an authentic AWS console interface with dark mode.

---

## 🌐 Live Demo & Hosted Links

| Component | Platform | URL |
|---|---|---|
| **Frontend Console** | Vercel | [https://aws-route53-clone.vercel.app](https://github.com/snehachoudhary13/AWS-Route53-clone) *(Live Deployment)* |
| **Backend API Docs** | Render | [https://aws-route53-backend-mcag.onrender.com/docs](https://aws-route53-backend-mcag.onrender.com/docs) |
| **Backend Health Check** | Render | [https://aws-route53-backend-mcag.onrender.com/api/health](https://aws-route53-backend-mcag.onrender.com/api/health) |
| **GitHub Repository** | GitHub | [https://github.com/snehachoudhary13/AWS-Route53-clone](https://github.com/snehachoudhary13/AWS-Route53-clone) |

### Demo Credentials
- **Username**: `admin`
- **Password**: `password123`

---

## 📐 Architecture Overview

The system is designed with a clean separation of concerns between the client-side Next.js console and the server-side FastAPI REST backend:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend: Next.js 14                       │
│                                                                 │
│  ┌────────────┐  ┌────────────────────┐  ┌──────────────────┐  │
│  │  /login    │  │  /hosted-zones     │  │ /hosted-zones/   │  │
│  │  JWT auth  │  │  CRUD table        │  │ [id]  DNS records│  │
│  └────────────┘  └────────────────────┘  └──────────────────┘  │
│         Next.js App Router · TypeScript · Tailwind CSS          │
│         shadcn/ui (Table, Dialog, Form, Toast, Pagination)      │
│         AWS Console Theme · Dark/Light Mode · BIND Parser       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST  /api/*
                            │ Authorization: Bearer <JWT>
┌───────────────────────────▼─────────────────────────────────────┐
│                      Backend: FastAPI                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  auth router │  │  zones router    │  │  records router  │  │
│  │  /api/auth/* │  │  /api/hosted-    │  │  /api/hosted-    │  │
│  │              │  │  zones[/{id}]    │  │  zones/{id}/     │  │
│  └──────────────┘  └──────────────────┘  │  records[/{id}]  │  │
│                                          └──────────────────┘  │
│  SQLModel ORM · python-jose JWT · bcrypt hashing                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   SQLite DB    │
                    │  route53.db    │
                    └────────────────┘
```

---

## 🗄️ Database Schema

The database uses SQLite with SQLModel (SQLAlchemy 2.0). All data cascades cleanly on deletion.

### 1. `users` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | Primary Key, Auto-increment | Unique user ID |
| `username` | TEXT | NOT NULL, UNIQUE, Indexed | Username (e.g. `admin`) |
| `password_hash` | TEXT | NOT NULL | Salted bcrypt hash |
| `created_at` | DATETIME | NOT NULL | Timestamp of creation (UTC) |

### 2. `hosted_zones` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | Primary Key, Auto-increment | Unique hosted zone ID |
| `name` | TEXT | NOT NULL, Indexed | Domain name (e.g. `example.com.`) |
| `type` | TEXT | NOT NULL | Zone type: `Public` or `Private` |
| `comment` | TEXT | Nullable | Optional description |
| `created_at` | DATETIME | NOT NULL | Timestamp of creation (UTC) |
| `updated_at` | DATETIME | NOT NULL | Timestamp of last update (UTC) |

### 3. `dns_records` Table
A single, unified, flexible table supporting all 9 standard DNS record types:

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | Primary Key, Auto-increment | Unique record ID |
| `zone_id` | INTEGER | Foreign Key (`hosted_zones.id`), CASCADE DELETE | Parent hosted zone ID |
| `name` | TEXT | NOT NULL, Indexed | Record name (e.g. `api.example.com.`) |
| `type` | TEXT | NOT NULL | `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA` |
| `value` | TEXT | NOT NULL | Record target value (supports multi-line) |
| `ttl` | INTEGER | NOT NULL, Default: `300` | Time To Live (seconds) |
| `priority` | INTEGER | Nullable | Priority value (for `MX`, `SRV`) |
| `weight` | INTEGER | Nullable | Weight value (for `SRV`) |
| `port` | INTEGER | Nullable | Port value (for `SRV`) |
| `created_at` | DATETIME | NOT NULL | Timestamp of creation (UTC) |
| `updated_at` | DATETIME | NOT NULL | Timestamp of last update (UTC) |

---

## 🔌 API Overview

All API endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <JWT>`.

### Authentication
- `POST /api/auth/login` — Authenticate username & password, returns JWT token.
- `POST /api/auth/logout` — Client-side token revocation.
- `GET /api/auth/me` — Return current authenticated user profile (`Protected`).

### Hosted Zones
- `GET /api/hosted-zones?search=&type=&page=&limit=` — List hosted zones with search & pagination (`Protected`).
- `POST /api/hosted-zones` — Create a hosted zone; automatically seeds standard 4 NS and 1 SOA records (`Protected`).
- `GET /api/hosted-zones/{id}` — Get single hosted zone by ID (`Protected`).
- `PUT /api/hosted-zones/{id}` — Update zone type or comment (`Protected`).
- `DELETE /api/hosted-zones/{id}` — Delete zone and cascade-delete all its records (`Protected`).

### DNS Records
- `GET /api/hosted-zones/{id}/records?search=&type=&page=&limit=` — List records for a zone (`Protected`).
- `POST /api/hosted-zones/{id}/records` — Create a DNS record (`Protected`).
- `PUT /api/hosted-zones/{id}/records/{rec_id}` — Update DNS record fields (`Protected`).
- `DELETE /api/hosted-zones/{id}/records/{rec_id}` — Delete a DNS record (`Protected`).

### System
- `GET /api/health` — Health check endpoint returning `{"status": "healthy"}`.

---

## 🚀 Local Setup Instructions

### Prerequisites
- **Node.js** 18+ & **npm**
- **Python** 3.11+

### 1. Backend Setup (FastAPI)
```bash
# Navigate to backend directory
cd backend

# Create & activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs: **http://127.0.0.1:8000/docs**
- Health Check: **http://127.0.0.1:8000/api/health**

### 2. Frontend Setup (Next.js)
```bash
# Navigate to frontend directory
cd frontend

# Install npm packages
npm install

# Start Next.js development server
npm run dev
```
- Open console in browser: **http://localhost:3000**
- Sign in with:
  - **Username**: `admin`
  - **Password**: `password123`

---

## ✨ Features & UI Highlights

- **Authentic AWS Console Layout**: Header toolbar, breadcrumbs, search filters, pagination controls, and delete confirmation dialogs matching the real Route 53 console.
- **Persistent Record Details Panel**: AWS-style split side panel showing live DNS details and copy-to-clipboard utilities.
- **Multi-Record DNS Types**: Full support for `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA` with multi-value line rendering.
- **Mocked Sections**: Dashboard, Traffic Policies, Health Checks, Resolver, and Profiles using a unified "Coming Soon" component with direct shortcuts to Hosted Zones.
- **Dark Mode**: Complete custom dark theme tailored to AWS dark theme tokens (`#0f1b2a`, `#16212e`, `#2a3747`).
