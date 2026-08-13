# AWS Route 53 Console Clone

A full-stack, pixel-faithful clone of the AWS Route 53 management console built as a graded assignment. Implements a real SQLite-backed authentication system with bcrypt password hashing, full CRUD for Hosted Zones and DNS Records, bonus power-user features, and a UI that closely matches the real AWS console.

---

## Quick start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18 + |
| Python | 3.11 + |
| npm | 9 + |
| Docker *(optional)* | 20 + |

---

### 1 — Backend (FastAPI)

#### Option A: Local Python Environment
```bash
cd backend

# Create & activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file with demo credentials
echo DEMO_USERNAME=admin       >> .env
echo DEMO_PASSWORD=password123 >> .env
echo JWT_SECRET=route53-clone-secret-key-change-in-prod >> .env
echo DATABASE_URL=sqlite:///./route53.db >> .env

# Start the server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Option B: Docker Container
```bash
cd backend

# Build Docker image
docker build -t route53-backend .

# Run container with custom environment variables
docker run -d \
  --name route53-backend \
  -p 8000:8000 \
  -e JWT_SECRET="your-secure-production-jwt-secret-key" \
  -e DEMO_USERNAME="admin" \
  -e DEMO_PASSWORD="password123" \
  -e DATABASE_URL="sqlite:///./route53.db" \
  route53-backend
```

The API is now available at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

> **Note:** The database (`route53.db`) is created automatically on first startup. The demo user (`admin` / `password123`) and seed data (3 hosted zones with realistic DNS records) are inserted at startup if the database is empty.

---

### 2 — Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Create a .env.local file
echo NEXT_PUBLIC_API_URL=http://localhost:8000/api > .env.local

# Start the dev server
node node_modules/next/dist/bin/next dev -p 3000
# or: npm run dev
```

The app is now available at **http://localhost:3000**

Login with:
- **Username:** `admin`
- **Password:** `password123`

---

## Environment Variables Reference

Every environment variable used across both backend and frontend for local development and production deployment:

### Backend (`backend/.env` or Docker container)

| Variable | Required | Default Value | Description |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | `route53-clone-secret-key-change-in-prod` | Secret key used to sign and verify HS256 JWT session tokens. Change to a strong random string in production. |
| `DEMO_USERNAME` | No | `admin` | Username for the automatically seeded demo account in SQLite. |
| `DEMO_PASSWORD` | No | `password123` | Plaintext password hashed via bcrypt with salt on initial startup. |
| `DATABASE_URL` | No | `sqlite:///./route53.db` | Connection string or path for the SQLite database engine. |
| `PORT` | No | `8000` | Port on which Uvicorn / Docker container listens. |

### Frontend (`frontend/.env.local` or environment)

| Variable | Required | Default Value | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:8000/api` | Public base URL pointing to the FastAPI backend REST API. |

---

## Bonus Functionalities ✨

### 1. Import DNS Records from BIND Zone Files
- Supports standard RFC 1035 BIND zone files (`.zone` / `.txt`) or pasting raw BIND configuration.
- Automatically handles `$ORIGIN`, `$TTL`, comments, and parses record-specific values (`MX` priorities, `SRV` priority/weight/port, `TXT` quotes, etc.).
- Includes a live **Preview Table** before applying changes, with real-time import progress bar.

### 2. Export Hosted Zones (JSON / BIND Format)
- **JSON Export**: Exports full zone metadata and structured DNS records in JSON format.
- **BIND Export**: Formats records according to standard BIND specifications, ready for import into BIND9, Unbound, NSD, or migration.
- Available per hosted zone (`Export zone` in zone detail) and for multiple selected zones simultaneously.

### 3. Dark Mode
- Built with custom AWS Console Dark Theme tokens (`#0f1b2a` navbar/background, `#16212e` card surfaces, `#2a3747` borders).
- Instant toggle via Navbar button or pressing <kbd>d</kbd> on any page.
- Persistent across page reloads via `localStorage`.

### 4. Keyboard Shortcuts
Navigate and operate the console completely hands-on-keyboard:

| Key | Action |
|---|---|
| `/` | Focus search bar |
| `n` | Open Create dialog (Hosted Zone / DNS Record) |
| `i` | Open Import BIND Zone File dialog |
| `e` | Edit single selected resource |
| `r` | Refresh table data |
| `a` | Select / Deselect all rows |
| `Delete` / `Backspace` | Delete selected resource(s) |
| `d` | Toggle Dark / Light theme |
| `Escape` | Clear row selection or close active dialogs |
| `?` | Open interactive Keyboard Shortcuts help modal |

### 5. Bulk Operations
- **Floating Action Bar**: Automatically slides up whenever 2 or more rows are selected.
- **Bulk TTL Update**: Change TTL for all selected DNS records in a single click with inline validation.
- **Bulk Delete**: Delete multiple hosted zones or DNS records in one batch with cascading verification.
- **Bulk Export**: Select specific records or zones and export only the selected subset.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (port 3000)                      │
│                                                                 │
│  ┌────────────┐  ┌────────────────────┐  ┌──────────────────┐  │
│  │  /login    │  │  /hosted-zones     │  │ /hosted-zones/   │  │
│  │  JWT auth  │  │  CRUD table        │  │ [id]  DNS records│  │
│  └────────────┘  └────────────────────┘  └──────────────────┘  │
│         Next.js 14 App Router · TypeScript · Tailwind CSS       │
│         shadcn/ui components · Dark Mode · Keyboard Shortcuts   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST  http://localhost:8000/api
                            │ Authorization: Bearer <JWT>
┌───────────────────────────▼─────────────────────────────────────┐
│                    FastAPI  (port 8000)                          │
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

## Database schema

### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | — |
| `username` | TEXT | NOT NULL, UNIQUE, indexed | Demo user: `admin` |
| `password_hash` | TEXT | NOT NULL | Salted bcrypt hash |
| `created_at` | DATETIME | NOT NULL | UTC |

### `hosted_zones`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | — |
| `name` | TEXT | NOT NULL, indexed | Always ends with `.` (e.g. `example.com.`) |
| `type` | TEXT | NOT NULL | `"Public"` or `"Private"` |
| `comment` | TEXT | nullable | Free-text description |
| `created_at` | DATETIME | NOT NULL | UTC, set on insert |
| `updated_at` | DATETIME | NOT NULL | UTC, updated on every PUT |

### `dns_records`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INTEGER | PK, auto-increment | — |
| `zone_id` | INTEGER | FK → `hosted_zones.id`, CASCADE DELETE | — |
| `name` | TEXT | NOT NULL, indexed | Fully-qualified name (e.g. `api.example.com.`) |
| `type` | TEXT | NOT NULL | `A · AAAA · CNAME · TXT · MX · NS · PTR · SRV · CAA` |
| `value` | TEXT | NOT NULL | Record data |
| `ttl` | INTEGER | NOT NULL, default 300 | Seconds |
| `priority` | INTEGER | nullable | MX and SRV only |
| `weight` | INTEGER | nullable | SRV only |
| `port` | INTEGER | nullable | SRV only |
| `created_at` | DATETIME | NOT NULL | UTC |
| `updated_at` | DATETIME | NOT NULL | UTC |

---

## API endpoints

All routes are prefixed with `/api`. Every route except `/api/auth/login` requires a valid JWT in the `Authorization: Bearer <token>` header.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Authenticate username & password against SQLite bcrypt hash, returns JWT access token |
| `POST` | `/api/auth/logout` | No | Stateless logout (client discards token) |
| `GET` | `/api/auth/me` | Yes | Validates active JWT in SQLite and returns authenticated user profile |

### Hosted Zones

| Method | Path | Auth | Query params | Description |
|---|---|---|---|---|
| `GET` | `/api/hosted-zones` | Yes | `search`, `type`, `page`, `limit` | List all hosted zones with pagination |
| `POST` | `/api/hosted-zones` | Yes | — | Create a new hosted zone (auto-adds SOA + NS records for Public zones) |
| `GET` | `/api/hosted-zones/{zone_id}` | Yes | — | Get a single hosted zone by ID |
| `PUT` | `/api/hosted-zones/{zone_id}` | Yes | — | Update `type` and/or `comment` |
| `DELETE` | `/api/hosted-zones/{zone_id}` | Yes | — | Delete zone and all its records (cascade) |

### DNS Records

| Method | Path | Auth | Query params | Description |
|---|---|---|---|---|
| `GET` | `/api/hosted-zones/{zone_id}/records` | Yes | `search`, `type`, `page`, `limit` | List records for a zone |
| `POST` | `/api/hosted-zones/{zone_id}/records` | Yes | — | Create a DNS record |
| `PUT` | `/api/hosted-zones/{zone_id}/records/{record_id}` | Yes | — | Update any field of a record |
| `DELETE` | `/api/hosted-zones/{zone_id}/records/{record_id}` | Yes | — | Delete a single record |

---

## Project structure

```
AWS route53 clone/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, startup hook
│   │   ├── auth.py          # bcrypt password hashing & JWT verification
│   │   ├── database.py      # SQLite engine + session factory
│   │   ├── models.py        # SQLModel ORM models (User, HostedZone, DNSRecord)
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── seed.py          # Demo user and example zone seeder
│   │   └── routers/
│   │       ├── zones.py     # Hosted zone CRUD routes
│   │       └── records.py   # DNS record CRUD routes
│   ├── Dockerfile           # Production container image
│   ├── .dockerignore
│   ├── requirements.txt
│   └── .env                 # DEMO_USERNAME, DEMO_PASSWORD, JWT_SECRET, DATABASE_URL
│
└── frontend/
    ├── app/
    │   ├── layout.tsx                  # Root layout + fonts
    │   ├── login/page.tsx              # Login form
    │   ├── dashboard/page.tsx          # ComingSoon dashboard placeholder
    │   ├── hosted-zones/
    │   │   ├── page.tsx                # Hosted zones list + CRUD + Bulk Bar
    │   │   └── [id]/page.tsx           # DNS records list + CRUD + BIND Import/Export
    │   └── (placeholder pages)         # health-checks, resolver, profiles, etc.
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.tsx              # Dark mode toggle & Shortcuts button
    │   │   ├── Sidebar.tsx             # Route 53 console sidebar navigation
    │   │   ├── Footer.tsx
    │   │   └── ClientLayout.tsx        # Session validation & breadcrumbs
    │   ├── ui/                         # shadcn-style components
    │   ├── BulkActionBar.tsx           # Floating batch actions bar
    │   ├── ShortcutsPanel.tsx          # Keyboard shortcuts help modal
    │   └── ComingSoon.tsx              # Shared placeholder component
    ├── hooks/
    │   ├── use-toast.ts
    │   ├── use-theme.ts                # Dark/Light theme manager
    │   └── use-keyboard-shortcuts.ts   # Keyboard navigation hook
    ├── lib/
    │   ├── api.ts                      # apiFetch wrapper + token helpers
    │   ├── bind-parser.ts              # BIND zone file parser
    │   └── export.ts                   # JSON & BIND export utilities
    ├── middleware.ts                   # JWT-protected route guard
    ├── tailwind.config.ts
    └── .env.local                      # NEXT_PUBLIC_API_URL
```
