# AWS Route 53 Console Clone

A functional clone of the AWS Route 53 management console built with Next.js, FastAPI, and SQLite.

---

## 1. Demo: Hosted Working Links

- **Live Application (Frontend)**: [https://aws-route53-clone.vercel.app](https://github.com/snehachoudhary13/AWS-Route53-clone)
- **Backend API & Swagger Docs**: [https://aws-route53-backend-mcag.onrender.com/docs](https://aws-route53-backend-mcag.onrender.com/docs)
- **Backend Health Check**: [https://aws-route53-backend-mcag.onrender.com/api/health](https://aws-route53-backend-mcag.onrender.com/api/health)
- **GitHub Repository**: [https://github.com/snehachoudhary13/AWS-Route53-clone](https://github.com/snehachoudhary13/AWS-Route53-clone)

### Demo Credentials
- **Username**: `admin`
- **Password**: `password123`

---

## 2. Architecture Overview

The application follows a decoupled client-server architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                    │
│                                                             │
│  • App Router, TypeScript, Tailwind CSS, shadcn/ui          │
│  • AWS Console Theme, Route Guards, Session Persistence     │
│  • Hosted Zones Table, DNS Records Panel, Search & Filters  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ REST API (/api/*)
                               │ Authorization: Bearer <JWT>
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                      │
│                                                             │
│  • FastAPI REST Endpoints (/api/auth, /api/hosted-zones)    │
│  • JWT Authentication Dependency                            │
│  • SQLModel ORM with Cascade Deletions                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ SQLModel / SQLAlchemy
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     Database (SQLite)                       │
│                                                             │
│  • users, hosted_zones, dns_records tables                  │
│  • Auto-seeded with realistic DNS records on startup        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

The database is powered by SQLite and modeled via SQLModel.

### `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | Primary Key, Auto-increment | Unique user identifier |
| `username` | TEXT | NOT NULL, UNIQUE, Indexed | User login name |
| `password_hash` | TEXT | NOT NULL | Salted bcrypt password hash |
| `created_at` | DATETIME | NOT NULL | Creation timestamp (UTC) |

### `hosted_zones`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | Primary Key, Auto-increment | Unique hosted zone ID |
| `name` | TEXT | NOT NULL, Indexed | Domain name (e.g. `example.com.`) |
| `type` | TEXT | NOT NULL | `Public` or `Private` |
| `comment` | TEXT | Nullable | Optional zone description |
| `created_at` | DATETIME | NOT NULL | Creation timestamp (UTC) |
| `updated_at` | DATETIME | NOT NULL | Last update timestamp (UTC) |

### `dns_records`
One flexible records table supporting all 9 standard DNS types (`A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA`):

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | Primary Key, Auto-increment | Unique record ID |
| `zone_id` | INTEGER | Foreign Key (`hosted_zones.id`), CASCADE DELETE | Parent hosted zone reference |
| `name` | TEXT | NOT NULL, Indexed | FQDN record name |
| `type` | TEXT | NOT NULL | `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA` |
| `value` | TEXT | NOT NULL | Target value(s) |
| `ttl` | INTEGER | NOT NULL, Default: `300` | Time To Live in seconds |
| `priority` | INTEGER | Nullable | Priority (for `MX`, `SRV`) |
| `weight` | INTEGER | Nullable | Weight (for `SRV`) |
| `port` | INTEGER | Nullable | Port (for `SRV`) |
| `created_at` | DATETIME | NOT NULL | Creation timestamp (UTC) |
| `updated_at` | DATETIME | NOT NULL | Last update timestamp (UTC) |

---

## 4. API Overview

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <JWT>`.

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Authenticate user and return JWT token |
| `POST` | `/api/auth/logout` | No | Stateless logout |
| `GET` | `/api/auth/me` | Yes | Return current user details |

### Hosted Zones
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/hosted-zones` | Yes | List hosted zones (supports `?search=&type=&page=&limit=`) |
| `POST` | `/api/hosted-zones` | Yes | Create hosted zone (auto-seeds default NS & SOA records) |
| `GET` | `/api/hosted-zones/{id}` | Yes | Get hosted zone details by ID |
| `PUT` | `/api/hosted-zones/{id}` | Yes | Update hosted zone comment or type |
| `DELETE` | `/api/hosted-zones/{id}` | Yes | Delete hosted zone and cascade-delete all its records |

### DNS Records
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/hosted-zones/{id}/records` | Yes | List records for a zone (supports `?search=&type=&page=&limit=`) |
| `POST` | `/api/hosted-zones/{id}/records` | Yes | Create a new DNS record |
| `PUT` | `/api/hosted-zones/{id}/records/{rec_id}` | Yes | Update an existing DNS record |
| `DELETE` | `/api/hosted-zones/{id}/records/{rec_id}` | Yes | Delete a DNS record |

### Health
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | No | Returns `{"status": "healthy"}` |

---

## 5. Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### Backend (FastAPI)
```bash
cd backend

# Create & activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend (Next.js)
```bash
cd frontend

# Install dependencies
npm install

# Start frontend development server
npm run dev
```
