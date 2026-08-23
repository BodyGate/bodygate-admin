# BodyGate Platinum Documentation

This directory is the governance baseline for the industrialisation of BodyGate.

## Current baseline

- Audit date: **2026-08-06**
- Audited branch: `main`
- Baseline commit: `c4d95da882ee49dc5af3463d32b748506a02e8e3`
- Product state: **operational internal platform undergoing industrialisation**

## Documents

1. [`PHASE_0_AUDIT_2026-08-06.md`](./PHASE_0_AUDIT_2026-08-06.md)  
   Verified architecture, module maturity, governance gaps and critical risks.

2. [`BACKLOG_V1.md`](./BACKLOG_V1.md)  
   Prioritised P0–P3 backlog and proposed release sequence to BodyGate `1.0.0`.

3. [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md)  
   Mandatory completion standard for code, database, API, UI, tests, documentation and releases.

## Governance rules

- `main` represents reviewed, releaseable work only.
- Production-critical changes use a dedicated branch and pull request.
- Access control, Bridge, DNake, KT02.3, turnstile, Digital Pass, receipt numbering and atomic economic flows are protected areas.
- Database changes must be represented by versioned SQL and verification evidence.
- A successful build is not equivalent to production acceptance.
- Every production deployment must map to an immutable release record.
- Work that has been delivered must not remain indefinitely represented as an open issue or superseded PR.

## Next documents required

The following artefacts remain part of Phase 0/Phase 1 and require controlled repository/database inspection:

- active Supabase database dictionary;
- migration registry with applied status;
- complete API catalogue;
- environment-variable reference;
- local Windows service and launcher runbook;
- disaster-recovery manual;
- reception operating manual;
- release checklist and changelog;
- canonical logging model;
- architecture diagram with trust boundaries.

## V1 release principle

BodyGate `1.0.0` is reached when all P0 items and mandatory P1 certification items are complete. Feature expansion, multi-site architecture and SaaS work remain outside V1 until the local production platform is reproducible, observable and recoverable.