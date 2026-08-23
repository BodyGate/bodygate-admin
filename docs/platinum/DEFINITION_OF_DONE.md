# BodyGate Platinum — Definition of Done

A BodyGate change is not complete merely because it works once on a developer machine.

This document defines the mandatory completion standard for features, fixes, migrations and releases.

---

## 1. Work-item readiness

Before development starts, the work item must define:

- user or operational problem;
- expected outcome;
- priority: P0, P1, P2 or P3;
- target release;
- protected areas not to modify;
- data and API impact;
- acceptance criteria;
- rollback/recovery expectation.

Emergency P0 fixes may begin immediately, but the missing record must be completed before merge.

---

## 2. Architecture

A change is complete only when:

- it follows the established BodyGate business boundary;
- it does not duplicate an existing table, route, catalogue or business rule;
- writes occur through an approved server/RPC path;
- multi-step critical writes are atomic;
- retryable operations are idempotent;
- access-control, receipt and payment invariants are explicitly preserved;
- new dependencies are justified and recorded;
- obsolete code is removed or formally deprecated.

---

## 3. Security

Mandatory checks:

- server-side authentication is explicit;
- required permission is explicit;
- public routes are intentionally allowlisted;
- machine routes use the approved machine-auth policy;
- input is validated and normalised;
- secrets are not logged or committed;
- service-role usage is limited to server code;
- personal data is minimised in logs and responses;
- rate limiting is considered for public endpoints;
- storage access and RLS are reviewed when files/data are involved.

---

## 4. Database

For schema or RPC changes:

- migration is versioned;
- migration is idempotent where practical;
- preflight is provided for risky changes;
- verification query is provided;
- rollback or recovery procedure is documented;
- indexes and constraints are reviewed;
- RLS and grants are explicit;
- live manual changes are not the sole implementation record;
- applied migration status is recorded.

Critical economic and booking operations require transaction-level rollback testing.

---

## 5. API

Every added or changed API must have:

- documented method and route;
- authentication and permission requirement;
- request schema;
- response schema;
- stable error codes for operational cases;
- side effects listed;
- tables/RPCs listed;
- idempotency behaviour listed;
- logging/correlation behaviour;
- timeout behaviour for external/local dependencies.

No API should return raw internal errors, credentials or unnecessary database structure to the UI.

---

## 6. UI and UX

A UI change is complete only when:

- it uses the BodyGate Platinum visual system;
- no browser-default buttons, alerts or confirm dialogs are introduced;
- loading, empty, success, disabled and error states exist;
- text is understandable by reception staff;
- technical JSON is hidden from normal operator views;
- keyboard and focus behaviour are valid;
- responsive behaviour is checked on the supported desktop/tablet/mobile set;
- long names, emails and identifiers do not break the layout;
- destructive or irreversible actions require explicit confirmation;
- the UI reflects server-authoritative state after completion.

---

## 7. Testing

Minimum checks for every pull request:

- `npx tsc --noEmit`;
- `npm run lint` or the currently approved no-regression lint gate;
- `npm run build` with the approved CI environment;
- `git diff --check`;
- targeted unit/integration tests;
- affected responsive smoke tests;
- manual acceptance steps recorded when hardware or physical devices are required.

Additional mandatory tests by area:

### Access control

- allowed case;
- denied case;
- unavailable dependency;
- duplicate/replay protection;
- access log result;
- no unintended opening.

### Economic operations

- successful transaction;
- duplicate submission/replay;
- forced mid-operation failure;
- full rollback;
- receipt counter integrity;
- historical documents unchanged.

### Authentication

- login;
- invalid credentials;
- session refresh/expiry;
- logout;
- disabled user;
- role/permission denial;
- supported tablet/iPad browser.

### Documents

- allowed MIME/size;
- rejected file;
- replacement history;
- storage failure;
- tablet capture/upload;
- date validation where required.

---

## 8. Documentation

The change must update all affected sources of truth:

- changelog;
- API catalogue;
- database dictionary/migration registry;
- operator manual;
- architecture document;
- environment variable reference;
- recovery runbook;
- release notes.

Documentation may be marked not applicable only with a stated reason.

---

## 9. Pull request standard

Every pull request must include:

1. problem and root cause;
2. implemented solution;
3. files/modules changed;
4. database/API/security impact;
5. protected areas confirmed untouched;
6. tests executed and results;
7. manual acceptance instructions;
8. rollout steps;
9. rollback steps;
10. screenshots for visible UI changes where feasible.

A PR must not mix unrelated feature, refactor and infrastructure work.

---

## 10. Release standard

A production release is complete only when:

- all included PRs are merged and traceable;
- required CI checks pass;
- migration order is fixed and verified;
- environment changes are documented;
- Bridge/local release hash is recorded when affected;
- database backup checkpoint exists;
- rollback decision point is defined;
- smoke tests pass after deployment;
- release tag and changelog are published;
- reception-impacting changes are communicated.

---

## 11. P0 incident fix standard

A P0 fix may use an expedited path, but it still requires:

- preservation of evidence/logs;
- minimal-scope patch;
- explicit protected-area review;
- immediate smoke test;
- rollback plan;
- post-incident root-cause record;
- permanent regression test added afterwards.

---

## 12. Platinum acceptance statement

The final approval statement for a completed item must be equivalent to:

> The change is implemented on the approved branch, respects BodyGate invariants, passes the required automated and operational tests, is documented, has a recovery path and is ready for the declared release environment.

Without this evidence, the item remains **partial**, even when the main scenario appears to work.