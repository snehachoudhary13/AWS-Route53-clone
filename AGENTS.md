# Project: AWS Route53 Clone

You are helping build a functional clone of the AWS Route53 console for a graded assignment.
Focus on recreating the Route53 workflow and UI — not real DNS functionality.

## Tech stack — do not substitute any of these
- Frontend: Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui (Table, Dialog, Form,
  Toast, Pagination components)
- Backend: FastAPI, SQLModel, SQLite
- Auth: mocked only — hardcoded demo credentials via environment variables, JWT for session.
  No real IAM/OAuth, no AWS SDK calls, no real DNS resolution — everything is simulated.

## Folder structure
- `frontend/` — Next.js app
- `backend/` — FastAPI app
- Keep them fully separate. Frontend talks to backend only over REST at
  `http://localhost:8000/api`.

## Database schema
**hosted_zones**: id, name, type (Public | Private), comment, created_at, updated_at

**dns_records**: id, zone_id (FK → hosted_zones, cascade delete), name,
type (A | AAAA | CNAME | TXT | MX | NS | PTR | SRV | CAA), value, ttl,
priority (nullable — MX, SRV), weight (nullable — SRV), port (nullable — SRV),
created_at, updated_at

One flexible records table, not nine type-specific tables.

## API conventions
- All routes prefixed `/api`
- Every hosted-zone and record route sits behind the auth dependency
- List endpoints accept `?search=&page=&limit=`; record list endpoints also accept `&type=`
- Proper HTTP status codes — 404 for missing resources, 401 for missing/invalid auth

## UI conventions
- Match the real Route53 console: left sidebar nav (Dashboard, Hosted Zones,
  Traffic Policies, Health Checks, Resolver, Profiles), breadcrumbs, tables with
  search + pagination, modals for create/edit, toast notifications on every action
- Dashboard / Traffic Policies / Health Checks / Resolver / Profiles are placeholder
  "Coming Soon" pages — reuse one shared component for all five

## Rules
- Always seed the database with a few realistic example zones/records on startup so
  the UI is never empty
- Skip automated test suites — not required for this assignment, prioritize working features
- After any backend change, verify the endpoint through FastAPI's `/docs` before
  saying you're done
- Never leave the app in a broken state between prompts — keep each step working end to end

Don't scaffold frontend/ or backend/ yet — just create this one file for now.
