# BodyGate Platinum — V1 Backlog

**Baseline:** 2026-08-06  
**Target:** certify BodyGate V1 as a stable internal production product before SaaS expansion.

---

## Priority model

- **P0 — Production safety:** failure can stop access, reception or data recovery.
- **P1 — V1 certification:** required for a controlled, supportable internal release.
- **P2 — Product completion:** high-value work after core certification.
- **P3 — Expansion:** multi-site, SaaS and broader ecosystem work.

Every backlog item must have:

- one owner;
- one target release;
- acceptance criteria;
- test evidence;
- rollback or recovery notes;
- explicit protected areas.

---

# P0 — Production safety

## BG-P0-001 — Certify Windows startup and launcher

**Outcome:** BodyGate and required local services start reliably after reboot without manual PowerShell intervention.

### Scope

- select one official startup mechanism;
- prevent duplicate Next.js instances;
- verify port `3000` availability;
- start application with production environment;
- verify `/api/health`;
- verify Bridge status;
- persist logs;
- restart after crash;
- expose clear operator state;
- document manual emergency startup.

### Acceptance criteria

- cold boot test passes three consecutive times;
- launcher test passes three consecutive times;
- duplicate launch does not create a second instance;
- simulated process crash triggers recovery;
- health endpoint returns `200` after recovery;
- reception can log in from desktop and iPad;
- access-check smoke test passes;
- no changes to access decision business logic.

---

## BG-P0-002 — Disaster recovery baseline

**Outcome:** BodyGate can be restored after workstation loss or configuration corruption.

### Scope

- inventory all local files and secrets;
- backup `.env.local` securely;
- backup Bridge release and configuration;
- backup PowerShell scripts and Task Scheduler definitions;
- document Supabase backup/restore path;
- document Storage recovery;
- document DNake/controller configuration dependencies;
- create a clean-machine restore checklist.

### Acceptance criteria

- encrypted backup location defined;
- recovery manual reviewed;
- restore drill completed on a non-production machine or isolated path;
- required recovery time and data-loss window recorded;
- secrets are not committed to Git.

---

## BG-P0-003 — Repository exposure and secrets review

**Outcome:** proprietary code and credentials have an intentional, secure hosting model.

### Scope

- review current public repository exposure;
- scan full Git history for secrets and production credentials;
- verify `.gitignore` coverage;
- review binary files and hardware libraries;
- decide public versus private repository;
- rotate any exposed secret;
- document collaborator access policy.

### Acceptance criteria

- written visibility decision approved;
- zero active secrets found in tracked content/history, or all findings remediated;
- branch protection configured;
- least-privilege collaborator list confirmed.

---

## BG-P0-004 — Production transport and session policy

**Outcome:** authentication works securely and consistently across desktop, tablet and iPad.

### Scope

- decide between internal HTTPS and explicitly LAN-only HTTP;
- document cookie policy;
- remove ambiguous environment overrides;
- test login, refresh, logout, expiry and revoked user;
- test `localhost`, `127.0.0.1` and LAN IP access;
- verify Safari/iPad behaviour.

### Acceptance criteria

- official access URL defined;
- automated auth regression tests pass;
- cookie attributes match the official transport;
- no authentication loop on iPad;
- no session cookie accepted outside intended scope.

---

## BG-P0-005 — Access pipeline observability

**Outcome:** an operator can identify which layer caused a delayed or failed opening.

### Scope

- measure DNake acquisition time;
- measure access API time;
- measure Bridge command time;
- measure controller response;
- record mechanical opening observation where possible;
- show last successful/failed event per layer;
- add log correlation ID;
- define log rotation and retention.

### Acceptance criteria

- one correlation ID follows an access attempt end to end;
- status page distinguishes API, Bridge, DNake and controller failures;
- latency thresholds and warning states defined;
- no personal data unnecessarily exposed in technical logs.

---

## BG-P0-006 — Machine-auth enforcement readiness

**Outcome:** access APIs can be protected without interrupting the turnstile.

### Scope

- confirm Bridge sends the machine key;
- verify DNake internal forwarding;
- run `observe` mode;
- inspect unauthenticated-call telemetry;
- prepare rollback to `off`;
- enable `enforce` only after controlled acceptance.

### Acceptance criteria

- zero legitimate unauthenticated calls during observation window;
- valid Bridge calls succeed in enforce test;
- missing/invalid key is rejected;
- emergency rollback is documented and tested.

---

# P1 — V1 certification

## BG-P1-001 — Establish CI quality gate

Required checks:

- dependency install;
- TypeScript check;
- lint;
- production build with safe CI environment;
- unit tests;
- responsive Playwright smoke suite;
- migration syntax/static checks;
- secret scan.

Acceptance: protected `main` cannot merge when required checks fail.

---

## BG-P1-002 — Eliminate repository-wide lint debt

- capture the current lint baseline;
- categorise by module;
- remove `any` from critical server routes first;
- resolve hook and accessibility errors;
- prohibit new lint debt.

Acceptance: `npm run lint` exits successfully.

---

## BG-P1-003 — Versioning and release management

- define semantic versioning policy;
- align package version with product maturity;
- add `CHANGELOG.md`;
- create release checklist;
- tag production releases;
- record database migration set and Bridge release hash.

Acceptance: each production deployment maps to one immutable release record.

---

## BG-P1-004 — Database dictionary and migration registry

- export active Supabase schema metadata;
- map tables, columns, constraints, indexes, RLS and RPCs;
- identify manual changes not represented in versioned SQL;
- create a migration registry with applied status;
- verify staging reproducibility.

Acceptance: an empty compatible database can be built to the current schema using controlled migrations and documented seed/config steps.

---

## BG-P1-005 — API catalogue and authorization audit

For every API route document:

- method;
- authentication;
- permission;
- machine-auth requirement;
- request schema;
- response schema;
- tables/RPCs;
- side effects;
- idempotency;
- error codes;
- logging.

Acceptance: all write routes have explicit server-side authorization and validation.

---

## BG-P1-006 — Critical-flow automated tests

Minimum suite:

1. active customer allowed;
2. expired subscription denied;
3. inactive customer denied;
4. active block denied;
5. missing/expired certificate denied where required;
6. duplicate credential rejected;
7. staff credential recognised;
8. renewal atomic success;
9. renewal replay idempotent;
10. forced renewal failure rolls back;
11. membership renewal atomic;
12. onboarding atomic;
13. receipt counter concurrency;
14. Digital Pass existing/partial/new cases;
15. auth/RBAC regression;
16. iPad login regression.

Acceptance: tests run in CI against isolated test data.

---

## BG-P1-007 — Reconcile stale PRs and issues

- close or supersede PR #88;
- close or supersede PR #89;
- reconcile issue #110 with PR #111;
- verify no abandoned branch is considered production work;
- introduce issue templates and PR template.

Acceptance: open work accurately reflects unfinished work.

---

## BG-P1-008 — Canonical logging model

- define purpose of `access_logs`, `customer_access_logs`, `gym_presence` and technical logs;
- remove semantic ambiguity;
- define retention;
- define personal-data minimisation;
- define audit versus operational logs.

Acceptance: every dashboard and report names its canonical source.

---

## BG-P1-009 — Reception operations manual

Include:

- login;
- customer search;
- onboarding;
- badge assignment/change;
- Digital Pass;
- subscription renewal;
- membership renewal;
- receipt reprint;
- certificate update;
- access denial diagnosis;
- outage procedure;
- manual escalation.

Acceptance: a trained operator can complete core workflows without developer assistance.

---

## BG-P1-010 — Training module acceptance

- reconcile issue #110;
- verify all training routes exist;
- verify canonical exercise catalogue;
- verify alias search and filters;
- verify atomic program creation and rollback;
- verify permissions/RLS;
- verify tablet layout;
- remove remaining placeholders.

Acceptance: module-specific acceptance report signed off.

---

## BG-P1-011 — Courses/bookings acceptance

- verify deployed schema/RPC set;
- confirm UI routes and permissions;
- test schedule overlap constraints;
- test booking capacity;
- test waitlist promotion;
- test cancellation;
- test check-in;
- test session completion/cancellation;
- test audit log.

Acceptance: complete end-to-end acceptance report.

---

# P2 — Product completion

## BG-P2-001 — Pilates Reformer product configuration

- five Reformer stations;
- instructors and availability;
- classes and schedules;
- packages/credits;
- trial lesson;
- waitlist;
- cancellation policy;
- occupancy threshold and reporting;
- customer notifications;
- WordPress request integration.

---

## BG-P2-002 — Customer communication centre

- templates;
- WhatsApp/email provider strategy;
- expiry reminders;
- certificate reminders;
- booking reminders;
- delivery history;
- consent and opt-out management.

---

## BG-P2-003 — Reconciliation and correction centre

- surface mismatches;
- guided corrections;
- immutable audit;
- no direct edits to issued receipts;
- corrective document strategy.

---

## BG-P2-004 — Analytics and management dashboard

- active members;
- renewals;
- expiries;
- revenue by plan/payment method;
- denied accesses;
- attendance trends;
- course occupancy;
- instructor utilisation;
- data-quality indicators.

---

## BG-P2-005 — Directus evaluation and controlled integration

- define permitted use cases;
- prevent direct operational access-control ownership;
- use existing PostgreSQL safely;
- test permissions and audit;
- document deployment and backup;
- retain BodyGate APIs as business boundary.

---

## BG-P2-006 — WordPress API integration

- public lead endpoint;
- validation and rate limiting;
- consent capture;
- CRM request record;
- duplicate detection;
- source/campaign tracking;
- Pilates booking/request handoff;
- no direct browser writes to Supabase tables.

---

# P3 — Expansion

## BG-P3-001 — Multi-site architecture

Do not start until V1 certification is complete.

Required design:

- tenant versus branch distinction;
- data isolation;
- device ownership;
- per-site configuration;
- central updates;
- cross-site identity rules;
- reporting boundaries;
- support model.

---

## BG-P3-002 — SaaS productisation

- onboarding wizard;
- tenant provisioning;
- billing/licensing;
- support and telemetry;
- feature flags;
- controlled migrations;
- remote diagnostics;
- SLA and incident management.

---

# Proposed release sequence

## Release `0.9.0-platinum-baseline`

- Phase 0 documentation;
- P0 issues registered;
- version/release rules introduced;
- no runtime change.

## Release `0.9.1-infrastructure`

- certified launcher/startup;
- disaster recovery;
- observability baseline;
- transport/session policy.

## Release `0.9.2-quality`

- CI quality gate;
- lint baseline fixed;
- critical-flow test suite;
- API and database catalogues.

## Release `1.0.0`

- all P0 complete;
- all mandatory P1 complete;
- Training and Courses acceptance complete;
- documentation and recovery drill complete;
- production release tagged and reproducible.

---

# Explicitly outside V1

- complete SaaS tenancy;
- automated accounting/first note;
- broad refactor of the access pipeline;
- replacement of DNake, Bridge, KT02.3 or turnstile;
- uncontrolled migration to a new CMS;
- duplicate mobile application before the web platform is certified.