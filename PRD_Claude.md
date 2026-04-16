# JaylaOps — Product Requirements & System Architecture
**Author:** Claude (Opus 4.6)
**Version:** 1.1 — 2026-04-16
**Supersedes:** `PRD.txt` (ChatGPT draft) for design purposes; original kept for diffing.

**v1.1 changes:** Database migrated to **Supabase**; added **JaylaOps Edge** — an on-prem node running on a local machine at the guest house hosting a **local AI agent** (Ollama) and an offline-capable sync gateway. See §2 (S3, S4, S5, S11, S12), §11 (architecture diagram), §19 (Edge spec).

---

## 1. Executive Summary

JaylaOps is a hospitality operations platform for **Jayla Selfcatering**, a 6-unit self-catering property. It orchestrates daily housekeeping, inspection, maintenance, and guest-feedback workflows through a **Next.js web dashboard** and a **Telegram bot + Mini App** used by on-the-ground staff and management.

**Design philosophy:** one property today, multi-property-ready tomorrow. Telegram is the *input* channel for staff because they already live there; the web app is the *system of record* and management surface. Guest feedback enters through **per-room QR codes** that open a public mobile form — no login, short form, low friction.

**Success is measured by four KPIs**, not by feature count:

| KPI | Target (Month 3 post-launch) |
|---|---|
| Daily task completion rate (by 14:00 local) | ≥ 95% |
| Inspection turnaround (completed → approved) | median ≤ 30 min |
| Urgent guest complaint → manager ack | ≤ 5 min |
| Staff DAU on Telegram bot | ≥ 90% of roster |

If the system ships without telemetry to measure these, it is not done.

---

## 2. Scope Decisions (made explicit — were ambiguous in v0 PRD)

| # | Decision | Rationale |
|---|---|---|
| S1 | **Single-tenant deployment, multi-tenant-ready schema.** Every row carries `property_id`; RLS keys on it. | Jayla today, franchise later without a migration. |
| S2 | **Backend: NestJS (TypeScript).** Not FastAPI. | One language across stack, shared DTOs with Next.js, mature Telegraf/Bull ecosystem. |
| S3 | **Database: Supabase (managed Postgres 16 + Auth + Storage + Edge Functions + Realtime).** RLS is first-class. | Managed backups/PITR, built-in auth, storage, and realtime — removes ~30% of bespoke infra. |
| S4 | **Hosting: Supabase (cloud DB/Auth/Storage) + single VM (Hetzner/DO) for NestJS orchestration + BullMQ workers + on-prem Edge node at the property.** Docker Compose. | Supabase handles data plane; VM handles orchestration; Edge handles offline + local AI. |
| S5 | **Object storage: Supabase Storage** (buckets: `task-photos`, `issue-photos`, `guest-photos`, `reports`). Signed URLs only. Cloudflare R2 retained as optional cold archive via lifecycle job. | One vendor for DB+Auth+Storage RLS semantics; R2 stays available if egress/cost ever dominates. |
| S6 | **Offline-first on the housekeeper's phone.** Task state transitions and photo uploads queue in the browser (IndexedDB + Service Worker) and sync when WiFi returns. | Rooms have weak WiFi; cloud is fine, it's the last 10 metres that fail. |
| S7 | **i18n from day one.** English (default), isiZulu, Afrikaans for staff UI; English + guest-browser-locale detection for guest form. | Real user base. |
| S8 | **Urgency definition:** `overall_rating ≤ 2` OR `room_clean_on_arrival = false` OR complaint contains configurable keyword set (pest, dirty, broken, leak, smell, unsafe) → `urgent=true`. | "Immediately notify" needs a trigger rule. |
| S9 | **Data retention:** task photos 90 days; guest feedback 24 months; audit logs 7 years (aligned with POPIA-friendly defaults). | POPIA compliance + storage cost. |
| S10 | **Telegram staff linking via one-time 6-digit code** issued by Manager in web UI, entered in bot with `/link 123456`. | Solves the identity problem the v0 PRD skipped. |
| S11 | **Fully cloud-hosted "Edge" service** on **Railway** (or Fly.io) free tier. No on-prem hardware in v1. Exposed via **Cloudflare Tunnel** + **Cloudflare Access** (no open ports). | No hardware to buy, fastest time-to-launch, lowest cost. On-prem option preserved in §19.9 as a future upgrade if offline resilience becomes critical. |
| S12 | **AI agent uses hosted APIs only**: **Together AI** (Llama 3.x free/cheap) as primary, **OpenRouter** as meta-router to Claude/GPT/DeepSeek when quality needed. No local LLM in v1. | Zero GPU/RAM cost, instant scaling, pay-per-token (capped). User-supplied OpenRouter key already available. |

---

## 3. Roles & Permission Matrix

| Capability | Super Admin | Manager | Supervisor | Housekeeper | Guest |
|---|---|---|---|---|---|
| Manage properties/units | ✅ | view | view | — | — |
| Manage users & roles | ✅ | ✅ | — | — | — |
| Create task templates | ✅ | ✅ | ✅ | — | — |
| Assign daily tasks | ✅ | ✅ | ✅ | — | — |
| Execute & complete tasks | — | — | — | ✅ | — |
| Inspect & approve/reject | ✅ | ✅ | ✅ | — | — |
| Raise issue | ✅ | ✅ | ✅ | ✅ | ✅ (via QR) |
| Close/resolve issue | ✅ | ✅ | ✅ | — | — |
| View reports | ✅ | ✅ | ✅ (unit-scoped) | own stats | — |
| Submit feedback | — | — | — | — | ✅ |
| Manage integrations/secrets | ✅ | — | — | — | — |

Enforced at **three layers**: **Supabase Auth** (JWT issued with `role` + `property_id` claims), **Supabase Postgres RLS** (per-row `property_id` + `auth.jwt() ->> 'role'` checks), and Next.js route middleware (UI guardrails). NestJS API uses a service-role key only for privileged operations (cron task generation, report materialization, Edge sync merges); all user-initiated mutations go through the user's JWT so RLS applies. A user with a tampered JWT cannot see another property's data because Supabase RLS stops the query at the DB.

---

## 4. Domain Model — State Machines (the part the v0 PRD omitted)

### 4.1 Task state machine
```
        ┌──────────┐  assign   ┌─────────────┐  start   ┌─────────────┐
        │ GENERATED├──────────>│   PENDING   ├─────────>│ IN_PROGRESS │
        └──────────┘           └──────┬──────┘          └──────┬──────┘
                                      │ skip (sup only)         │ complete+photos
                                      ▼                          ▼
                                ┌──────────┐              ┌─────────────┐
                                │ SKIPPED  │              │  AWAITING_  │
                                └──────────┘              │  INSPECTION │
                                                          └──────┬──────┘
                                                   reject│        │approve
                                                         ▼        ▼
                                                   ┌─────────┐ ┌──────────┐
                                                   │REJECTED │ │ APPROVED │
                                                   └────┬────┘ └──────────┘
                                                        │ reopen(auto)
                                                        ▼
                                                  (→ IN_PROGRESS)
```
SLA timers: `PENDING > 2h` → supervisor reminder; `AWAITING_INSPECTION > 1h` → supervisor nudge; `REJECTED > 30min unacknowledged` → manager escalation.

### 4.2 Room state machine
`DIRTY → IN_PROGRESS → CLEANED → INSPECTED → GUEST_READY`
Any state can jump to `PROBLEM_REPORTED` via issue creation; returns to `DIRTY` after issue is resolved + re-clean.

### 4.3 Issue state machine
`OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED`
With `severity ∈ {low, medium, high, urgent}`; urgent auto-pages manager (Telegram + email) and blocks `GUEST_READY`.

---

## 5. Data Model (buildable — columns, keys, indexes)

Full DDL in `/db/schema.sql`; summary below. Every table has `id uuid pk`, `property_id uuid not null`, `created_at`, `updated_at`, `deleted_at nullable` (soft delete), and RLS policy `property_id = current_setting('app.property_id')::uuid`.

Core tables (abridged — 22 total):

- **users** — `email citext unique`, `phone`, `tg_user_id bigint unique nullable`, `tg_link_code_hash`, `locale`, `role_id`, `is_active`, `last_login_at`
- **roles** — seeded enum-like: super_admin, manager, supervisor, housekeeper
- **properties / units / areas** — `units` has `qr_token uuid unique` for guest URL `…/q/{qr_token}` (rotatable)
- **task_templates** — `name`, `area_id`, `cadence` (daily|checkin|checkout|weekly), `estimated_minutes`, `required_photos int`, `active`
- **task_checklist_items** — ordered steps per template
- **daily_tasks** — `template_id`, `unit_id`, `assignee_id`, `status`, `scheduled_for date`, `started_at`, `completed_at`, `inspected_at`, `inspector_id`, `rejection_reason`
- **task_photos** — `task_id`, `r2_key`, `sha256`, `taken_at`, `exif_stripped bool`
- **task_status_history** — append-only ledger of transitions (actor, from, to, at, reason)
- **inspections** — `task_id`, `inspector_id`, `result` (approved|rejected), `notes`, `score 1-5`
- **issues** — `reported_by`, `reporter_type` (staff|guest), `unit_id`, `severity`, `category`, `description`, `status`, `assignee_id`, `resolved_at`
- **issue_photos**, **issue_comments**
- **guest_feedback** — `unit_id`, `qr_token_used`, `ratings jsonb` (cleanliness, comfort, comms, overall — each 1–5), `clean_on_arrival bool`, `comments text`, `is_urgent bool` (computed on insert), `submitted_at`, `guest_contact nullable`, `ip_hash`, `user_agent`
- **notifications** — `channel` (telegram|email|inapp), `recipient_user_id`, `template_key`, `payload jsonb`, `sent_at`, `delivered_at`, `error`
- **stock_items / stock_movements** — for `/supplies`
- **audit_logs** — actor, action, entity, entity_id, diff jsonb, ip, ua, at
- **monthly_reports** — materialized summary per (property, year, month)

Critical indexes: `daily_tasks (property_id, scheduled_for, status)`, `guest_feedback (property_id, submitted_at desc)`, `issues (property_id, status, severity)`, partial index `daily_tasks (assignee_id) where status in ('PENDING','IN_PROGRESS')`.

---

## 6. API Design (REST + small GraphQL-ish batch endpoint for dashboard)

Base: `/api/v1`. JSON only. All mutating endpoints require `Idempotency-Key` header (stored 24h). JWT in `Authorization: Bearer`.

Key endpoints (full OpenAPI in `/api/openapi.yaml`):

```
POST   /auth/login              { email, password }      → { access, refresh }
POST   /auth/telegram/link      { code }                 (bot-initiated, HMAC-verified)
GET    /me

GET    /units
GET    /units/:id/qr            → signed PDF of room QR card

POST   /task-templates
POST   /daily-tasks/generate    (idempotent, cron-callable)
GET    /daily-tasks?date=&assignee=&status=
POST   /daily-tasks/:id/start
POST   /daily-tasks/:id/complete       { checklist: [...], photoKeys: [...] }
POST   /daily-tasks/:id/inspect        { result, notes, score }

POST   /issues                  { unit_id, severity, category, description, photoKeys }
PATCH  /issues/:id              { status, assignee_id, comment }

POST   /public/feedback/:qr_token     (rate-limited, no auth)
GET    /public/unit/:qr_token         (public unit name only)

GET    /reports/monthly?year=&month=   → JSON
GET    /reports/monthly.pdf?…
GET    /reports/monthly.csv?…

POST   /media/upload-url        { contentType, sha256 } → { url, key }   (pre-signed R2)

GET    /dashboard/overview      → batched KPI payload
```

**Public endpoints** (`/public/*`) are on a separate rate-limit bucket: 5 req/min/IP, 20 req/hour/QR token, Cloudflare Turnstile challenge on ≥3 feedbacks from same IP in 10 min.

---

## 7. Telegram Bot & Mini App

**Stack:** Telegraf (NestJS module) + Telegram Mini App (Next.js route `/tg`) validated via `initData` HMAC (SHA-256 with bot token) — the v0 PRD did not mention this and it's the only secure way to trust a Mini App user.

**Identity linking flow:**
1. Manager creates staff user in web dashboard → clicks "Generate Telegram link code" → system shows 6-digit code valid 10 min.
2. Staff opens bot, sends `/link 123456`. Bot verifies, stores `tg_user_id`, invalidates code.
3. All future commands authenticated by `tg_user_id` lookup.

**Command set** (all dispatch to the same service layer as REST — no logic lives in the bot):

| Role | Commands |
|---|---|
| Housekeeper | `/start`, `/link`, `/today`, `/next`, `/pending`, `/done <id>`, `/issue`, `/supplies`, `/summary` |
| Supervisor | above + `/inspect <id>`, `/reject <id>` |
| Manager | `/dashboard`, `/today`, `/unit <n>`, `/issues`, `/assign`, `/remind`, `/report`, `/monthly` |

**When to use Mini App vs plain messages:** plain messages for single-action commands (`/done`, `/next`); Mini App deep-link for photo upload, checklist execution, dashboards, and report viewing. Rule: if the interaction needs a form or a scrollable list > 5 items, open Mini App.

**Notifications are outbound** too: new assignment, rejected task, urgent guest feedback, issue assigned, escalation — all routed through the `notifications` table + worker so delivery is auditable and retryable.

---

## 8. Guest QR Feedback Flow

1. Printed card in each unit: `https://jaylaops.com/q/{qr_token}` (token rotatable so a leaked QR can be revoked without reprinting if needed — fallback: print new card).
2. Public page loads (no JS frameworks if possible for speed — but we'll use Next.js RSC + minimal client). Shows unit name ("Unit 3 — Protea Suite"), 4 rating stars groups, one yes/no ("Was the room clean when you arrived?"), optional comment, optional photo, optional contact.
3. Submit → `POST /public/feedback/:qr_token`.
4. Server computes `is_urgent` (rule S8). If urgent: enqueue manager notification (Telegram + email) with ack deadline = now + 5 min; if not acked, escalate to Super Admin.
5. Guest sees thank-you screen with reference number; if urgent, text reads "A manager will contact you shortly."

**Anti-abuse:** rate limit + Turnstile, honeypot field, store `sha256(ip + salt)` not raw IP, reject submissions where all ratings are identical and comment is empty (low-effort spam heuristic, configurable).

---

## 9. Escalation & Notification Engine

Rule-based, config-driven (YAML in `/config/escalations.yml`, hot-reloaded). Default rules:

| Trigger | Action | Escalate if not acked in |
|---|---|---|
| Urgent guest feedback | Notify on-duty Manager (TG + email) | 5 min → Super Admin |
| Task `PENDING > 2h` after shift start | Remind assignee (TG) | 30 min → Supervisor |
| Task `REJECTED` | Notify assignee + log | 30 min → Manager |
| Issue `severity=urgent` & `status=OPEN` | Notify Manager | 10 min → Super Admin |
| No housekeeper seen online by 08:00 | Notify Supervisor | — |

Implemented as **BullMQ delayed jobs** keyed by `(trigger_type, entity_id)` so re-triggering is idempotent.

---

## 10. Monthly Reporting

Report is a materialized view refreshed nightly + on-demand PDF/CSV render.

**Sections & KPIs:**
1. **Executive summary** — 4 headline KPIs vs prior month (delta, trend arrow).
2. **Staff performance** — per housekeeper: tasks assigned, completed, rejected, avg completion time, avg inspection score, photo compliance %.
3. **Unit performance** — per unit: tasks, issues opened/closed, MTTR, guest rating avg, urgent events count.
4. **Guest feedback** — distribution of ratings, top 3 positive themes, top 3 complaint themes (keyword extraction), verbatims with consent flag.
5. **Issues & maintenance** — by category, by severity, MTTR, recurring-issue flag (same unit+category ≥3 in 30d).
6. **Anomalies** — auto-flagged: room with rating drop > 1.0, housekeeper with rejection rate > 20%, unit with > 2 urgent events.

Exported as PDF (pdfkit + Handlebars template), CSV (per section), and JSON (for downstream BI).

---

## 11. System Architecture

```
                                ┌──────────────────────────┐
                                │  Cloudflare (WAF, CDN,   │
                                │  Turnstile, TLS, DNS)    │
                                └──────────┬───────────────┘
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                │                          │                          │
         Guest Browser               Staff Browser              Telegram Client
         (QR form)                   (Next.js dashboard)        (Bot + Mini App)
                │                          │                          │
                └──────────────────────────┼──────────────────────────┘
                                           │ HTTPS
                                   ┌───────▼────────┐
                                   │  Next.js App   │  (RSC + Server Actions;
                                   │  (Vercel /     │   public /q/*; Mini App /tg/*)
                                   │   self-host)   │   uses supabase-js w/ user JWT
                                   └───┬───────┬────┘
                                       │       │
              REST /api/v1 (orchestr.) │       │ direct (PostgREST, RLS-protected)
                                       │       │
                     ┌─────────────────▼─┐   ┌─▼─────────────────────────────────┐
                     │ NestJS Orchestrat.│   │  SUPABASE (managed)               │
                     │  (VM — Hetzner)   │   │  ├─ Postgres 16 + RLS + pg_trgm   │
                     │  ├─ Telegraf bot  │◄──┤  ├─ Auth (JWT, magic link)        │
                     │  ├─ BullMQ prod.  │   │  ├─ Storage (task/issue/guest/rep)│
                     │  ├─ Sync merge   │   │  ├─ Edge Functions (webhooks)     │
                     │  │  (Edge ↔ cloud)│   │  └─ Realtime (dashboard live KPIs)│
                     │  └─ Report render │   └───────────────────────────────────┘
                     └───┬──────────┬────┘               ▲
                         │          │                     │ service-role (workers only)
                   ┌─────▼─────┐ ┌──▼─────────────┐       │
                   │ Redis 7   │ │ BullMQ Workers │───────┘
                   │ (BullMQ,  │ │ daily-task-gen │
                   │  rate     │ │ escalations    │
                   │  limits)  │ │ notifications  │
                   └───────────┘ │ report-render  │
                                 │ edge-sync      │
                                 │ media-scan     │
                                 └───┬────────────┘
                                     │
                        ┌────────────┴───────────┐
                        ▼                         ▼
                  Telegram Bot API         SMTP (Postmark)

  ═══════════════════════════════════════════════════════════════════════
                    CLOUD-HOSTED EDGE (v1 — no on-prem hardware)
  ═══════════════════════════════════════════════════════════════════════

                  Cloudflare Tunnel + Cloudflare Access
                 ▲                                        ▲
                 │ (no inbound ports; identity-gated)     │
                 │                                        │
          ┌──────┴──────────────────────────────────────────────┐
          │  RAILWAY (or Fly.io) — free/hobby tier              │
          │  GitHub → auto-deploy on push to main:              │
          │   ├─ edge-api    (NestJS slim, same container code  │
          │   │               as on-prem spec; AI tools only)   │
          │   ├─ sync-worker (Supabase ↔ Turso bridge)          │
          │   └─ healthcheck / heartbeat                        │
          │                                                     │
          │  State: TURSO (managed libSQL / SQLite at edge)     │
          │   └─ replicated, free tier: 9 GB, 1B row reads/mo   │
          │                                                     │
          │  AI backends (HTTPS, OpenAI-compatible):            │
          │   ├─ Together AI  → meta-llama/Llama-3.3-70B-…      │
          │   ├─ OpenRouter   → anthropic/claude-*, deepseek/*   │
          │   └─ routing via config/ai-routing.yml (§19.3b)     │
          │                                                     │
          │  Secrets: Doppler → Railway env sync                │
          └─────────────────────────────────────────────────────┘
```

**Cross-cutting:** OpenTelemetry traces → Grafana Cloud (free tier); pino structured logs; Sentry for errors. Secrets in Doppler or 1Password Connect — never in `.env` committed.

---

## 12. Security Checklist (enforced, not aspirational)

- [ ] TLS 1.3, HSTS preload, Cloudflare in front
- [ ] JWT: 15-min access, 7-day refresh rotation, `jti` revocation list in Redis
- [ ] Passwords: argon2id (not bcrypt)
- [ ] Postgres RLS on every tenant-scoped table — CI test asserts no table missing policy
- [ ] Telegram Mini App `initData` HMAC verification on every Mini App request
- [ ] Telegram bot webhook secret token header checked
- [ ] File uploads: pre-signed PUT only, MIME + magic-byte validation server-side, EXIF stripped, `ClamAV` scan job before marking usable
- [ ] Public feedback: rate limit + Turnstile + honeypot + IP-hash storage
- [ ] POPIA alignment: guest consent checkbox for photo upload & contact, data export/delete endpoints, retention jobs
- [ ] Audit log is append-only (trigger blocks UPDATE/DELETE on `audit_logs`)
- [ ] Daily encrypted Postgres backup to R2, weekly restore drill (scripted)
- [ ] Dependency scan (npm audit + Snyk) in CI; fail on High
- [ ] SAST (Semgrep) + secret scan (gitleaks) pre-commit and in CI
- [ ] No `eval`, no `dangerouslySetInnerHTML` without sanitizer; CSP with nonces
- [ ] CSRF: SameSite=Lax cookies + double-submit token for non-API form posts

---

## 13. Test Plan

- **Unit:** Jest, 80% coverage gate on domain services (not UI).
- **Integration:** Testcontainers-Postgres; every API endpoint hits real DB with RLS enabled under a non-superuser role.
- **E2E:** Playwright — golden paths: housekeeper-complete-task, supervisor-reject, guest-urgent-feedback-alerts-manager, monthly-report-generates.
- **Bot tests:** Telegraf test harness + recorded fixtures.
- **Load:** k6 — 50 concurrent staff actions + 200 guest form posts/min; p95 < 400ms.
- **Security:** OWASP ZAP baseline in CI; quarterly manual pentest.

---

## 14. Build Roadmap (phased, shippable each phase)

| Phase | Weeks | Ships |
|---|---|---|
| **P0 — Foundations** | 1–2 | Repo, CI, Supabase schema + RLS, auth, user/role admin, properties/units, QR generation, audit log |
| **P1 — Housekeeping core** | 3–4 | Task templates, daily generation via Supabase pg_cron, web task execution with photos (Supabase Storage), inspection flow, room state |
| **P2 — Telegram** | 5–6 | Bot, `/link` flow, housekeeper command set, Mini App for checklist + photos, notifications via Resend + Telegram |
| **P2.5 — Cloud Edge + AI agent** | 5.5–6.5 (parallel) | Railway service, Turso projection, Together AI + OpenRouter wiring, Cloudflare Tunnel + Access, `/ask` in Telegram. **See §19.7.** |
| **P3 — Guest & issues** | 7–8 | QR feedback page, urgency engine, issue module, escalation rules, manager alerts |
| **P4 — Reporting & polish** | 9–10 | Monthly report, PDF/CSV export, dashboard KPIs (Supabase Realtime), i18n, offline queue on staff phones |
| **P5 — Hardening** | 11–12 | Load test, ZAP baseline, backup drill (Supabase PITR), docs, staff training, soft launch to 2 units |
| **GA** | Week 13 | All 6 units live; KPI dashboards watched weekly for first month |

**Start-simple rule for v1:** run the NestJS orchestration and the Edge AI service **as one Railway project with two processes** (or even one process with two modules). Split them only if Railway usage metrics show they're fighting for resources. Same for Redis/BullMQ — **defer** until Supabase pg_cron + Edge Functions prove insufficient. Fewer moving parts = faster launch + lower bill.

---

## 15. Folder Structure

```
jaylaops/
├── apps/
│   ├── web/                 # Next.js 15 (App Router, RSC)
│   │   ├── app/(dashboard)/
│   │   ├── app/q/[token]/   # guest QR page
│   │   ├── app/tg/          # Telegram Mini App
│   │   └── lib/
│   └── api/                 # NestJS
│       ├── src/modules/{auth,users,properties,tasks,inspections,issues,feedback,reports,telegram,notifications,audit}
│       ├── src/workers/
│       └── src/common/{rls,guards,dtos,filters}
├── packages/
│   ├── shared-types/        # Zod schemas shared web↔api
│   ├── ui/                  # Tailwind + shadcn components
│   └── config/              # eslint, tsconfig, tailwind presets
├── db/
│   ├── migrations/          # node-pg-migrate
│   ├── schema.sql
│   └── seed/
├── infra/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── terraform/           # when we outgrow compose
├── docs/
│   ├── PRD.md               # this file
│   ├── adr/                 # architecture decision records
│   └── runbooks/
└── .github/workflows/
```

---

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Staff don't adopt Telegram flow | Med | High | Paper fallback for week 1; co-design with actual housekeepers before P2 freeze |
| Poor WiFi loses photos | High | Med | Offline queue (S6) |
| Guest QR abuse / fake feedback | Med | Med | Turnstile, rate limits, keyword + duplicate heuristics |
| Manager alert fatigue | Med | High | Escalation rules tunable per property; daily digest option |
| Vendor lock-in (R2/Cloudflare) | Low | Low | S3-compatible API; can swap to AWS in a day |
| POPIA complaint from guest | Low | High | Consent, retention jobs, DSAR endpoint, privacy notice on QR page |
| Solo-dev bus factor | High | High | ADRs, runbooks, infra-as-code from day one |

---

## 17. Future Enhancements (explicitly out of scope for v1)

- Booking engine integration (Booking.com, lekkaslap.co.za, NightsBridge iCal, Airbnb calendar sync)
- Inventory replenishment prediction from `stock_movements`
- WhatsApp channel parity with Telegram
- Dynamic pricing suggestions from feedback + occupancy
- Multi-property franchise onboarding self-serve
- On-site IoT (door locks, smart plugs) via MQTT bridge

---

## 18. What Changed vs the ChatGPT PRD (diff summary)

Added: state machines, RLS enforcement plan, Telegram identity-linking flow, Mini App `initData` verification, offline strategy, urgency rule, retention policy, anti-abuse on public endpoints, measurable KPIs, phased roadmap with exit criteria per phase, POPIA alignment, concrete tech choices (NestJS, Supabase, BullMQ, Caddy/Hetzner), escalation ladder, anomaly detection in monthly report, CI security gates, **on-prem Edge node with local AI agent**.

Removed / consolidated: ambiguous "NestJS *or* FastAPI" (chose NestJS), generic "audit log" (now append-only enforced by trigger), vague "urgent" (now a computable rule), self-managed Postgres (→ Supabase), Cloudflare R2 as primary (→ Supabase Storage; R2 optional cold archive).

Kept: role list, module list (refined), stack direction, deliverables spirit.

---

## 18b. Builder Model — Solo Owner, Vibe-Coded

**Who's building this:** the product owner (non-developer, AI Generalist course graduate), using AI coding assistants (Cursor + Claude Sonnet/Opus 4.6, or Claude Code CLI). No freelance developer in the loop for v1.

### 18b.1 Operating rules (all sessions)
1. **PRD is the contract.** Every coding session begins with the assistant reading `PRD_Claude.md` and `NOTES.md`. The assistant must not invent features outside the PRD without asking.
2. **Git is the safety net.** New feature = new branch. Working state = commit. Broken state = revert. No exceptions.
3. **One feature at a time.** The owner tests each slice in a browser before the next slice is written.
4. **Ask before big changes.** Schema migrations, new providers, new dependencies, deletions of >20 lines → assistant confirms with the owner first.
5. **Explain, don't just fix.** When errors occur, the assistant explains the root cause in plain English before patching.
6. **Secrets never in chat or Git.** API keys live in `.env.local` (git-ignored) and in Doppler → Vercel/Railway env vars.
7. **Supabase changes are migrations.** Never ad-hoc dashboard edits on production. Every schema change is a versioned SQL migration committed to git.
8. **Deploy weekly at minimum.** The `main` branch must be deployable to Vercel + Railway at all times.

### 18b.2 Toolchain
| Purpose | Tool |
|---|---|
| Editor / AI coding | Claude Code CLI (primary) |
| Version control | Git + GitHub |
| Web hosting | Vercel (Next.js) |
| Edge/API hosting | Railway |
| DB / Auth / Storage | Supabase |
| Dev tunnel (Telegram webhooks) | ngrok |
| Secrets | Doppler |
| AI (inside the app) | Together AI + OpenRouter |
| Monitoring | Sentry + Vercel/Railway built-in |

### 18b.3 Session template (paste at the start of every Cursor/Claude Code session)
```
Read PRD_Claude.md and NOTES.md.
We are working on Phase <N>, section <§>. Today's goal: <one sentence>.
Rules: follow §18b operating rules. One slice at a time. Explain before fixing.
Do not touch files outside <path> without asking.
Confirm understanding, then propose the smallest first step.
```

### 18b.4 Realistic timeline (part-time, solo, non-coder)
16–18 weeks evenings/weekends. Full-time would be ~8 weeks. Do **not** compress below 12 weeks — rushed vibe-coding produces unmaintainable code.

### 18b.5 Escape hatches
If a phase stalls for > 2 weeks on the same problem:
- **Option A:** hire a freelancer for that single phase only (GitHub issue scoped, paid hourly).
- **Option B:** simplify the scope (drop a feature to v1.5).
- **Option C:** switch tools (e.g., Supabase pg_cron → an Inngest scheduled function — sometimes a fresh stack unblocks a stuck one).

Sunk-cost is not a strategy. Stuck for two weeks = change something.

---

## 19. JaylaOps Edge Service — Cloud-Hosted (v1)

> **v1.2 change:** The on-prem laptop plan is deferred. v1 runs the "Edge" as a cloud service on free/hobby tiers. Original on-prem spec is preserved in **§19.9** as a future upgrade path.

### 19.1 Purpose
A small always-on cloud service that (a) hosts the AI agent + tool server, (b) keeps a lightweight edge database for fast, cheap reads, (c) runs the sync/merge worker between agent state and Supabase, and (d) is the integration surface for Telegram's `/ask` and the dashboard "Ask JaylaOps" panel.

### 19.2 Hosting stack (all free tier to start)
| Concern | Provider | Plan | Free-tier limits | Paid tip-over |
|---|---|---|---|---|
| **Compute** (edge-api, sync-worker) | **Railway** | Hobby | $5 credit/mo; sleeps when idle | ~$5/mo active |
| Alt compute | Fly.io | Free | 3 shared-cpu-1x VMs, 256 MB | $1.94/mo per extra VM |
| **Edge DB** | **Turso** (libSQL) | Starter | 9 GB storage, 1 B row reads/mo, 25 M row writes/mo, 500 DBs | $29/mo Scaler if exceeded |
| **Primary DB/Auth/Storage** | **Supabase** | Free | 500 MB DB, 1 GB storage, 50 k MAU | $25/mo Pro when >500 MB |
| **AI — primary** | **Together AI** | pay-as-you-go | $1 signup credit; Llama 3.3 70B ≈ $0.88/M tok | budget cap $10/mo |
| **AI — router** | **OpenRouter** | pay-as-you-go | your key; many free models listed (`:free` suffix) | budget cap $10/mo |
| **Tunnel / access** | **Cloudflare Tunnel + Access** | Free | up to 50 users on Access Free | $0 |
| **Secrets** | **Doppler** | Developer | free for personal projects; syncs to Railway | $0 |
| **Email** | Resend | Free | 3 k emails/mo | $0 |
| **Errors** | Sentry | Developer | 5 k errors/mo | $0 |
| **Domain** | Cloudflare Registrar | at-cost | ~$10/yr | — |

**Estimated monthly spend for v1:** **$0–$10** (domain is annual; AI stays inside configured $20 cap).

### 19.2a Why these choices
- **Railway vs Fly.io:** Railway has friction-free GitHub auto-deploy, built-in metrics, and one-click Doppler sync — best for shipping fast. Fly.io is cheaper at scale and better for regional latency. **Pick Railway for v1**, migrate to Fly if cost/latency ever dictates (same Docker image runs on both).
- **Turso over on-prem SQLite:** same libSQL engine, but replicated, managed, and free-tier generous. Keeps the Edge stateless → can redeploy or move region without data loss.
- **Together AI over Ollama:** no GPU needed, faster tokens/sec than CPU Llama, cheap enough that $10/mo handles routine use. Keeps a user's OpenRouter key available for premium models.
- **Cloudflare Tunnel over Tailscale:** Tailscale was chosen to reach an on-prem box. With no on-prem, Cloudflare Tunnel is the simpler path — no inbound ports on Railway, identity-gated via Cloudflare Access (Google/Microsoft/email OTP).

### 19.3 Software stack (containers on Railway)
| Service | Purpose |
|---|---|
| `edge-api` | NestJS slim: exposes the agent's MCP-style tool server + a small REST surface for `/ask`, draft generation, and health. Stateless. |
| `sync-worker` | Node worker: pulls relevant rows (today's tasks, open issues, last 72 h feedback) from Supabase into Turso for cheap local reads; pushes agent-generated artifacts (drafts, summaries, anomaly flags) back to Supabase. |
| `turso` | Managed libSQL — no container, accessed via SDK with an auth token. |
| `agent-runtime` | Library inside `edge-api` (Vercel AI SDK or LangChainJS) wiring tools → model; OpenAI-compatible client pointed at Together AI or OpenRouter per routing rules. |
| `cloudflared` | Cloudflare Tunnel sidecar (or Railway-native Cloudflare integration) — exposes `edge-api` at `edge.jaylaops.com` with no open inbound port. |
| Cloudflare Access | Identity gate in front of the tunnel — service-token for NestJS-cloud calls, SSO for human debug access. |
| Doppler | Secret source of truth; Railway pulls env at build & runtime. |

### 19.3a Hosted model selection (Together AI + OpenRouter)

All providers expose an OpenAI-compatible chat-completions endpoint — one client, many backends.

| Rank | Model | Provider / tag | Price (approx, in/out per 1M tok) | Use it for |
|---|---|---|---|---|
| ★ **Primary** | **Llama 3.3 70B Instruct Turbo** | Together: `meta-llama/Llama-3.3-70B-Instruct-Turbo` | ~$0.88 / $0.88 | Default agent, tool-calling, summaries, drafts |
| 2 | **Llama 3.1 8B Instruct Turbo** | Together: `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | ~$0.18 / $0.18 | High-volume cheap calls (triage, short summaries) |
| 3 | **DeepSeek R1 Distill Llama 70B** | OpenRouter: `deepseek/deepseek-r1-distill-llama-70b` (often `:free`) | free / low | Reasoning-heavy (anomaly detection, root-cause drafts) |
| 4 | **Claude Haiku 4.5** | OpenRouter: `anthropic/claude-haiku-4-5` | ~$1 / $5 | Monthly-report narrative; polished prose |
| 5 | **Claude Sonnet 4.6** | OpenRouter: `anthropic/claude-sonnet-4-6` | ~$3 / $15 | Manager `/ask` hard questions only (rate-limited) |
| — | **Embeddings** | Together: `togethercomputer/m2-bert-80M-8k-retrieval` | ~$0.008 / 1M tok | Feedback theme clustering |

**Runtime policy** (in `config/ai-routing.yml`, hot-reloaded):
1. Routine tool calls → **Llama 3.3 70B Turbo** on Together.
2. Very short/high-volume → **Llama 3.1 8B Turbo**.
3. Reasoning tasks → try **DeepSeek R1 free tier** via OpenRouter first.
4. Manager free-form `/ask` → **Sonnet 4.6** (primary) with **Llama 3.3 70B** as fallback on 5xx / timeout.
5. **Budget guardrail:** hard monthly cap **$20** total across all providers; at 80% usage → Telegram alert to Super Admin; at 100% → auto-switch every rule to OpenRouter free-tier models (`:free` suffix).
6. Context window capped at **8 k tokens** (longer prompts summarized first) to keep cost predictable.

**No install step** — just environment variables:
```bash
TOGETHER_API_KEY=…
OPENROUTER_API_KEY=…
EDGE_AI_BACKEND=hybrid   # local | openrouter | together | hybrid
AI_MONTHLY_BUDGET_USD=20
```

### 19.3b AI backend options (local vs OpenRouter vs hybrid)

The agent runtime is provider-agnostic (OpenAI-compatible chat-completions interface). Three supported modes, selected via `EDGE_AI_BACKEND` env var:

| Mode | `EDGE_AI_BACKEND` | When to pick | Pros | Cons |
|---|---|---|---|---|
| **local** | `ollama` | Sensitive data, offline-first, zero per-call cost | Private (POPIA ✓), works during WAN outage, no spend | Limited to small models on this laptop; slower |
| **cloud** | `openrouter` | You've got an OpenRouter API key and want best quality with zero local RAM/CPU load | One key → many models (Claude, GPT-4o, Llama 3.1 70B, Gemini, DeepSeek); no model mgmt; fastest | Requires internet; per-token cost; guest PII leaves property (mitigate: redact before send) |
| **hybrid** ★ recommended | `hybrid` | Best of both | Routine/PII tasks local, hard tasks cloud | Slightly more config |

**Hybrid routing rules** (in `config/ai-routing.yml`, hot-reloadable):
```yaml
rules:
  - task: summarize_guest_feedback       # contains PII
    backend: local
    model: llama3.2:3b-instruct-q4_K_M
  - task: draft_manager_reply            # PII + tone matters
    backend: local
    model: qwen2.5:7b-instruct-q4_K_M
  - task: triage_issue                   # short, local is fine
    backend: local
    model: llama3.2:3b-instruct-q4_K_M
  - task: monthly_report_narrative       # long context, quality matters
    backend: openrouter
    model: anthropic/claude-haiku-4-5
  - task: ask_free_form                  # manager /ask — quality first
    backend: openrouter
    model: anthropic/claude-sonnet-4-6
    fallback:
      backend: local
      model: llama3.2:3b-instruct-q4_K_M
  - task: anomaly_detection              # reasoning-heavy
    backend: openrouter
    model: deepseek/deepseek-r1
```

**OpenRouter integration specifics:**
- **Auth:** API key stored in Supabase Vault (or sops-encrypted on Edge); never in plain env, never in git.
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible — same client code as Ollama, just different base URL + auth header).
- **Headers:** set `HTTP-Referer: https://jaylaops.com` and `X-Title: JaylaOps` so usage shows cleanly in the OpenRouter dashboard.
- **Cost guardrails:** hard monthly budget cap (default **$20/mo**) enforced in `edge-api`; when 80% consumed → Telegram alert to Super Admin; at 100% → auto-switch all rules to `backend: local`.
- **PII redaction:** before any `openrouter` call, run a pass that replaces guest names, phones, emails, and room numbers with tokens (`[GUEST_1]`, `[UNIT_3]`); de-tokenize on the way back. Logged in `audit_logs` with `pii_redacted: true`.
- **Model preferences:** pin model IDs (don't use OpenRouter's "auto") so cost/behavior is predictable; review quarterly.
- **Fallback:** any 5xx / timeout > 8 s → automatic local fallback; event logged.
- **Observability:** every call records `{backend, model, prompt_tokens, completion_tokens, cost_usd, latency_ms}` to `ai_calls` table for the monthly AI-spend report.

**If you choose OpenRouter-only** (`EDGE_AI_BACKEND=openrouter`): skip the Ollama install, drop RAM reservation to ~4 GB for the Edge stack, and the laptop just runs sync + `edge-api`. You lose offline AI (during WAN outage the agent is unavailable but operational tasks still work via the local SQLite mirror).

### 19.4 AI agent — tools exposed
- `list_today_tasks(unit?)` — reads local mirror
- `summarize_guest_feedback(window)` — runs locally, extracts themes/sentiment
- `draft_manager_reply(feedback_id, tone)` — returns suggested message, manager approves before send
- `triage_issue(description, photos?)` — severity + category suggestion
- `flag_anomaly(date_range)` — cross-references tasks + feedback + issues
- `escalate(entity_id, reason)` — enqueues via sync-worker to cloud notifications

Invocation paths:
- **Telegram:** `/ask <question>` → routes to Edge over Tailscale; if unreachable or timeout 3 s → cloud fallback (Claude Haiku with same tool schema).
- **Dashboard:** "Ask JaylaOps" side panel (Next.js) streams from Edge via signed WebSocket.
- **Background:** nightly job calls agent to generate "morning brief" posted to Manager's Telegram at 07:00 local.

### 19.5 Sync model (Supabase ↔ Turso, cloud-to-cloud)
- **Source of truth:** Supabase (always). Turso is a **read-optimized projection** for the agent — never authoritative, never writes back application state directly.
- **Scope of projection:** `daily_tasks`, `issues` (open), `guest_feedback` (last 72 h), `units`, `users` (staff only). Refreshed every 60 s by `sync-worker` or via Supabase webhook → Railway endpoint for near-real-time.
- **Agent outputs** (drafts, summaries, anomaly flags) land in Supabase tables `agent_drafts`, `agent_summaries`, `agent_flags` with `status=pending_review` until a human approves.
- **No photos** on the Edge; agent receives signed Supabase Storage URLs when needed and streams content server-side.
- **Health:** `edge-api` exposes `/healthz`; a Supabase cron pings it every 60 s; two consecutive failures → Telegram alert to Super Admin. Cloudflare also runs an uptime check.

### 19.6 Security (cloud-hosted Edge, in addition to §12)
- **No inbound ports:** Railway service reachable only through Cloudflare Tunnel; origin URL not publicly routable.
- **Cloudflare Access** in front of `edge.jaylaops.com`: service-token for machine callers (NestJS cloud), SSO/email-OTP for human debug access. Unauthorized requests never reach the container.
- **Secrets:** Doppler → Railway env sync; Supabase **service-role key scoped by RLS policy** where possible, never shipped to the browser.
- **PII redaction** before any Together/OpenRouter call (as in §19.3b): guest names, phones, emails, room numbers replaced with tokens; de-tokenized on return; both events logged in `audit_logs` with `pii_redacted=true`.
- **Per-provider budget caps** enforced in `edge-api`; circuit-breaker trips to free-tier models at 100%.
- **Railway** is SOC 2 Type II; Cloudflare Access adds Zero Trust gating → same or stronger posture than the on-prem LAN design.
- **CI supply chain:** GitHub Actions builds images with provenance attestations; Railway pulls pinned digests, not `:latest`.

### 19.7 Roadmap delta — replaces original P2.5
**Phase P2.5 — Cloud Edge** (Weeks 5.5–6.5, parallel with P2):
1. Provision **Railway** project; link GitHub repo; set up preview + production environments.
2. Create **Turso** DB; generate auth token; seed projection schema.
3. Generate **Together AI** + **OpenRouter** API keys; load into **Doppler**; sync to Railway.
4. Implement `edge-api` (NestJS slim) + `sync-worker`; deploy via GitHub Actions → Railway on push to `main`.
5. Set up **Cloudflare Tunnel** to `edge.jaylaops.com`; protect with **Cloudflare Access** (service token for NestJS cloud, SSO for humans).
6. Wire agent tool-calling to Supabase via service-role client with RLS-scoped queries.
7. Dogfood with manager for 1 week: `/ask` in Telegram, "Ask JaylaOps" panel in dashboard.
8. GA gating: $0–$10/mo observed spend; p95 agent latency < 3 s; 99% uptime over 7-day window.

### 19.8 Risks specific to the cloud Edge
| Risk | Mitigation |
|---|---|
| Free tier runs out mid-month | Doppler-driven budget caps + auto-downgrade to `:free` OpenRouter models; Railway usage alert at 80% |
| LLM hallucinates a reply | All drafts require manager approval before send; agent outputs flagged `ai_generated=true` in `audit_logs` |
| Provider outage (Together / OpenRouter) | Cross-provider fallback chain in `ai-routing.yml`; circuit breaker with 30-s cooldown |
| Railway sleeps free-tier container | Health-check cron pings every 5 min to keep warm; upgrade to $5 Hobby if cold-starts hurt UX |
| Guest PII leaves property via LLM | Mandatory tokenization pass; logged + auditable; escalate to on-prem (§19.9) if a customer ever demands strict residency |
| Vendor lock-in (Railway, Turso, Together) | Each is swappable: Railway ↔ Fly.io (same Dockerfile), Turso ↔ local SQLite, Together ↔ OpenRouter (OpenAI-compatible); documented in ADRs |

### 19.9 Future upgrade path — on-prem Edge (deferred)
If offline resilience, strict data residency, or on-site IoT becomes a hard requirement, re-introduce the on-prem laptop/mini-PC spec (previous v1.1 draft — Ollama + litestream + Tailscale). The cloud Edge is designed to be swapped for the on-prem one without changing the cloud API or data model: same container image, same tool schema, same Supabase projection. Decision trigger: sustained ISP outages > 4 h/week OR > 20% of feedback flagged as residency-sensitive OR first IoT integration (door lock / leak sensor) greenlit.
