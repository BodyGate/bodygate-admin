# BodyGate Platinum — Phase 0 Audit

**Audit date:** 2026-08-06  
**Repository:** `BodyGate/bodygate-admin`  
**Audited branch:** `main`  
**Baseline commit:** `c4d95da882ee49dc5af3463d32b748506a02e8e3`  
**Purpose:** establish a truthful, production-oriented baseline before further feature development.

---

## 1. Executive assessment

BodyGate is no longer a prototype. It is a production-local fitness operating system with a real access-control pipeline, CRM, subscriptions, payments, receipts, documents, contracts, staff tools, training and course-booking foundations.

The product is best classified as:

> **Operational internal platform undergoing industrialisation.**

The core business flows are materially more mature than the package version `0.1.0` suggests. The main gap is no longer feature quantity; it is governance, reproducibility, observability, release discipline and infrastructure resilience.

### Current maturity by dimension

| Dimension | Assessment | Notes |
|---|---|---|
| Business functionality | Advanced | Core CRM, access, onboarding, payments and receipts are present. |
| Access-control integration | Operational | DNake, Bridge, controller and turnstile flow is established. |
| Data integrity | Medium/advanced | Atomic and idempotent RPC flows exist for key operations. |
| UI consistency | Advanced | Platinum design system and responsive work are integrated. |
| Security | Medium | Session/RBAC and machine-auth rollout exist; production hardening remains. |
| Testing | Medium-low | Type/build checks are common; comprehensive automated coverage is incomplete. |
| Observability | Low/medium | Health and diagnostic endpoints exist, but no complete operational console/alerting. |
| Deployment/recovery | Low/medium | Local scripts exist, but startup and disaster recovery are not fully certified. |
| Documentation/governance | Medium-low | Useful documents exist but are stale/incomplete relative to current `main`. |
| SaaS readiness | Low | Branch support exists, but tenancy and deployment model are not finalised. |

---

## 2. Verified repository baseline

### Repository facts

- Default branch: `main`.
- Repository visibility at audit time: **public**.
- Package version: `0.1.0`.
- Runtime stack:
  - Next.js `16.2.4`;
  - React `19.2.4`;
  - TypeScript `5`;
  - Supabase JS `2.105.3`;
  - Tailwind CSS `4`;
  - Playwright `1.61.1`;
  - Puppeteer `24.43.1`;
  - shadcn foundation and BodyGate-specific UI components.
- Available package scripts:
  - `dev`;
  - `build`;
  - `start`;
  - `lint`;
  - `qa:responsive`.

### Governance observations

- The project has exceeded 120 pull requests, with recent merged work through PR #123.
- Two legacy UI PRs remain open: #88 and #89. Their scope overlaps later merged work and they should be formally closed or superseded.
- Issue #110 remains open even though PR #111 implemented the Training rebuild described by that issue. The issue must be reconciled against the delivered implementation and either updated with remaining acceptance tests or closed.
- The README presents an ambitious product vision but does not describe production setup, environment requirements, release process, recovery procedure or current module maturity.
- `docs/BODYGATE_V1_MAP.md` is useful but predates major security, atomicity, course, training, UI and digital-pass work. It must not be treated as the sole current source of truth.

---

## 3. Confirmed architecture

### Application

```text
Reception / Tablet / Staff Browser
            ↓
Next.js App Router + React + TypeScript
            ↓
Server API routes and authenticated server helpers
            ↓
Supabase PostgreSQL / Storage / Realtime
```

### Access-control pipeline

```text
DNake AC02C/S
    ↓
unlock_sql.db / device user data / DNake event flow
    ↓
BodyGate Bridge (.NET 8, local Windows host)
    ↓
POST /api/access/check
    ↓
Authoritative access decision
    ↓
KT02.3 controller command
    ↓
TK-01 turnstile opening
    ↓
POST /api/access/log and operational logs
```

### Consolidated network endpoints

- DNake: `192.168.1.22`.
- KT02.3 controller: `192.168.1.251:8000`.
- BodyGate local application/API: `127.0.0.1:3000`.
- BodyGate Bridge: `localhost:5050`.

### Protected invariants

The following areas are production-critical and must not be refactored incidentally:

1. access decision semantics;
2. DNake/Bridge/KT02.3/turnstile command flow;
3. Mobile Pass and unified Digital Pass;
4. annual receipt numbering;
5. A4 receipt layout;
6. atomic renewal/onboarding/membership operations;
7. established payment-receipt relationships;
8. explicit exclusion of `cash_movements` and prima nota from current renewal flows.

---

## 4. Module inventory

### 4.1 Authentication and permissions — **Operational, hardening required**

Confirmed capabilities:

- signed HMAC session token;
- server-side session validation;
- active-user verification;
- server-side role and permission resolution;
- `/api/auth/me`;
- exact public-route allowlist;
- LAN/iPad HTTP cookie compatibility fixes merged in PR #122 and #123;
- admin-role fallback and protected navigation.

Remaining work:

- define the official production transport strategy: LAN HTTP exception versus internal HTTPS;
- remove temporary secret fallbacks;
- build automated session, expiry, logout, RBAC and iPad regression tests;
- document account lifecycle and password policy;
- review all API routes for explicit authorization boundaries.

### 4.2 Access Control — **Production-critical and operational**

Confirmed capabilities:

- customer and staff credential lookup;
- RFID/QR normalization;
- duplicate controls;
- customer blocks;
- subscription validity;
- membership-fee checks where configured;
- medical-certificate checks;
- access logs;
- Debug Center;
- Credentials Audit Center;
- Bridge status and health endpoints;
- gradual machine authentication: `off`, `observe`, `enforce`;
- DNake IP and local IPv4 optimisation;
- raw badge parsing disabled by default in Bridge.

Remaining work:

- certify the Windows startup/launcher path;
- activate machine auth only after Bridge compatibility is verified;
- centralise latency measurements across DNake, API, Bridge, controller and mechanical opening;
- define the canonical operational log stream;
- implement alerting and retention/rotation policies;
- test failure modes and restart recovery.

### 4.3 CRM and customer command centre — **Operational and mature**

Confirmed capabilities:

- customer list/search;
- compact Platinum customer workspace;
- operational overview endpoint;
- profile update;
- subscription, membership, payments and receipts history;
- access credential management;
- customer timeline;
- blocks and notes;
- branch-aware onboarding;
- server-authoritative plans and pricing;
- data-quality and reconciliation warnings.

Remaining work:

- reduce large-component complexity in customer detail without altering business logic;
- establish a formal acceptance matrix for all customer states;
- remove residual client-direct database writes outside approved read-only surfaces;
- complete global search and operator shortcuts.

### 4.4 Onboarding, documents and contracts — **Operational, acceptance testing required**

Confirmed capabilities:

- Platinum onboarding;
- atomic/idempotent onboarding RPC;
- default branch resolution;
- document scanner for tablet/camera/file;
- image compression and PDF pass-through;
- medical certificate validity and history;
- customer photo and document storage;
- annual membership contract creation;
- print-only A4 contract route;
- OTP signature flow foundations.

Remaining work:

- end-to-end physical tablet test plan;
- storage/RLS audit for every document bucket;
- document retention and replacement policy;
- contract template versioning;
- OTP provider, delivery and legal evidence audit;
- disaster recovery for stored documents.

### 4.5 Subscriptions, membership, payments and receipts — **Operational and integrity-focused**

Confirmed capabilities:

- server-authoritative plan selection;
- subscription renewals;
- membership-fee renewals;
- safe subscription edits and soft cancellation;
- atomic and idempotent transaction RPCs;
- annual progressive receipt numbering;
- receipt history and A4 rendering;
- optional RFID badge fee components;
- reconciliation warnings and protection against receipt-linked drift;
- generic payment route blocked for flows that must use official endpoints;
- no automatic `cash_movements` or prima nota.

Remaining work:

- formalise the accounting boundary and future first-note strategy;
- complete reconciliation dashboards and correction workflows;
- add full concurrency and replay tests;
- certify yearly rollover and backup of receipt counters;
- document fiscal/administrative responsibilities outside the software.

### 4.6 Unified Digital Pass — **Operational**

Confirmed capabilities:

- unified DNake QR plus Mobile Pass operation;
- idempotent create/recover behaviour;
- Supabase and DNake duplicate checks;
- credential synchronisation;
- customer timeline event;
- WhatsApp send flow;
- protected administrative route;
- compatibility alias for the previous QR route.

Remaining work:

- controlled production acceptance suite;
- expiry/revocation policy;
- delivery status and resend history;
- privacy-safe public page telemetry;
- rate limiting.

### 4.7 Staff management and Staff Pass — **Operational foundation**

Confirmed capabilities:

- staff management area;
- staff credentials;
- staff Mobile Pass/QR delivery;
- phone normalisation;
- WhatsApp Desktop/Web fallback.

Remaining work:

- staff lifecycle and credential-revocation workflow;
- role templates and least-privilege review;
- staff audit log completeness;
- offboarding checklist.

### 4.8 Courses and bookings — **Database core delivered, product acceptance incomplete**

Confirmed capabilities from merged PR #109:

- course types, rooms, schedules, sessions, bookings and activity log;
- RLS;
- room/instructor overlap constraints;
- booking and waitlist model;
- append-only audit;
- atomic RPCs for scheduling, booking, cancellation, promotion, check-in and session lifecycle;
- preflight, verification and rollback scripts.

Remaining work:

- confirm the complete UI surface currently available on `main`;
- perform end-to-end booking/waitlist/check-in tests;
- specialise and configure the Pilates Reformer product;
- connect WordPress lead/request flow through controlled APIs;
- add occupancy, credits/packages and revenue reporting.

### 4.9 Training — **Rebuilt architecture, runtime certification pending**

Confirmed capabilities from merged PR #111:

- unified Premium client;
- server API boundary;
- atomic program-creation RPC;
- canonical `exercises` catalogue direction;
- dashboard, athletes, programs, builder, library, exercise detail and sessions surfaces;
- architecture documentation.

Governance inconsistency:

- issue #110 remains open despite the merged rebuild.

Remaining work:

- reconcile issue #110 with the actual implementation;
- validate all acceptance criteria on real data;
- certify exercise count, aliases, filters, media and program rollback;
- review permissions/RLS;
- add automated tests.

### 4.10 UI and responsive system — **Advanced**

Confirmed capabilities:

- BodyGate-specific component system;
- shadcn foundation;
- central dark Platinum styles;
- responsive QA script with Playwright;
- tablet scanner fixes;
- safe realtime IDs for browsers without `crypto.randomUUID`;
- CRM and page-wide Platinum refactors.

Remaining work:

- close/supersede stale PRs #88 and #89;
- eliminate repository-wide lint debt;
- create visual regression baselines;
- complete accessibility testing;
- document component ownership and deprecation rules.

---

## 5. Critical risks

| ID | Priority | Risk | Required action |
|---|---|---|---|
| R-001 | P0 | BodyGate local server/launcher may not start reliably after reboot or from the launcher. | Certify one startup mechanism, watchdog, duplicate-process prevention and recovery test. |
| R-002 | P0 | No complete disaster-recovery runbook for local host, Bridge, configuration and Supabase. | Create backup inventory and execute a restore drill. |
| R-003 | P0 | Repository is public while containing proprietary application and hardware-integration code. | Perform exposure review, secret scan and decide whether to make the repository private. |
| R-004 | P0 | Production relies on LAN HTTP exceptions for session cookies. | Decide internal HTTPS or formally document and test the LAN-only model. |
| R-005 | P0 | Machine authentication can be enforced before the Bridge sends the key. | Keep controlled rollout and add a pre-enforcement compatibility test. |
| R-006 | P1 | `npm run lint` is known to fail repository-wide. | Establish a lint baseline and progressively reach zero errors. |
| R-007 | P1 | Build/test frequently depend on dummy environment variables. | Add a safe compile-time environment strategy and CI configuration. |
| R-008 | P1 | Documentation is behind the implemented product. | Adopt the Platinum documentation set as release-controlled source of truth. |
| R-009 | P1 | Open stale PRs/issues create ambiguity. | Close, supersede or re-scope #88, #89 and #110. |
| R-010 | P1 | Course and Training delivery is inferred from merged code but not fully certified operationally. | Run module-specific acceptance tests against staging data. |
| R-011 | P1 | Multiple logging tables may diverge semantically. | Declare canonical logs and retention policy. |
| R-012 | P2 | Branch support may be mistaken for complete multi-tenancy. | Keep SaaS/multi-tenant work outside V1 until core certification. |

---

## 6. Immediate conclusions

### What must be protected

- access-control pipeline;
- atomic economic operations;
- receipt numbering;
- Digital Pass;
- customer operational overview;
- document history;
- Platinum design system.

### What must stop

- unplanned feature additions directly on `main`;
- manual database changes without versioned SQL;
- treating successful compilation as full acceptance;
- leaving completed issues and superseded PRs open;
- duplicating tables, catalogues, routes or business rules.

### What begins now

1. versioned Platinum documentation;
2. P0 infrastructure stabilisation;
3. staging and release discipline;
4. automated acceptance tests for critical flows;
5. formal V1 scope and Definition of Done;
6. backlog managed by priority, owner and release.

---

## 7. Audit limitation

This audit is based on the current GitHub repository metadata, package manifest, README, existing architecture map, merged pull-request history and known production observations. A complete database dictionary still requires a controlled schema export from the active Supabase project, and local Windows service/launcher certification requires execution on the production workstation.