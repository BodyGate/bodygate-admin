# Deprecation evidence registry

This registry records evidence; it authorizes **no deletion or runtime change**. The reproducible scanner reads only `git ls-files`, performs no network, database or device access, writes nothing, emits sorted `file:line` evidence, and distinguishes definitions, imports, calls, documentation and other text. Run `npm run qa:deprecations`; run `node scripts/scan-deprecations.mjs` for JSON evidence.

## Decision matrix

| Candidate | Confirmed duplication | Functional difference | Static evidence | Missing runtime evidence | Proposed decision | Risk | Prerequisites | Rollback |
|---|---|---|---|---|---|---|---|---|
| `*.backup.tsx` (2 files) | Snapshot counterparts exist | Historical implementation may differ | No tracked caller found | Deployment/import logs | remove after evidence | medium/high | 30-day observation; owner approval | restore removal commit |
| `/settings/modules` | None established | Placeholder copy plus client shell | Manifest says placeholder; navigation reference exists | Page views and operator workflow | hide from standard navigation | high | confirm no operational procedure | restore navigation entry |
| `/api/admin/test` | None | Diagnostic API | No tracked caller beyond definition | Access logs/external scripts | remove after evidence | high | 30-day zero calls; Platform approval | restore route and deploy |
| `/ui-lab` | Lab purpose established | General component lab | Developer/lab manifest classification | Authenticated page views | hide from standard navigation | low | Design System approval | restore exposure |
| `/ui-lab/platinum` | None | Platinum reference implementation | Developer/lab classification | Consumers outside repository | retain | medium | Foundation owner review | revert disposition |
| `/test-gate` | None | Hardware diagnostic | Gate API and hardware terminology | Bridge/device runs | protected | critical | Access Control approval and hardware validation | no change authorized |
| Customers V2 route/API | Customer-domain overlap | Separate API contract and V2 components | Route fetches V2 API | Contract, workflow and visual parity | merge after parity | critical | adapters; parity suite; CRM approval | retain V2 route/API |
| `/access` | Destination overlaps access-control | Compatibility URL | Manifest says legacy redirect | bookmarks, kiosks and procedures | protected | critical | inbound-link and device audit | retain legacy URL |
| `/access/check` | Name resembles `/api/access/check` | HTML GET/device contract versus API contract | Separate route files and semantics | Bridge/device call inventory | protected | critical | Bridge and turnstile validation | restore endpoint immediately |
| `/pass/[token]`, `/mobile/[token]` | Token experiences overlap | Different public experiences | Public token routes | Complete issued-token/link population | protected | critical | compatibility window and token validation | retain old resolvers/routes |
| Customer creation APIs | Intent overlaps | Payload, validation and transaction behavior differ | Both route implementations exist | Contract and transaction parity | merge after parity | critical | adapter and rollback metrics | retain both endpoints |
| Medical-certificate API families | Domain overlaps | Customer-scoped versus update payload/storage flow | Each has a distinct UI caller | Payload/error/storage parity | merge after parity | critical | adapter; contract tests; CRM approval | retain both families |
| V2 and UI primitives | Conceptual Button/Card/Metric overlap | Props, styling and states differ | Separate implementations; V2 has live consumers | Visual/interaction parity | merge after parity | high | adapter and visual approval | keep both families |
| Five definition-only components | None established | Unknown | Exact symbol/path has no tracked importer | Dynamic/external consumers | remove after evidence | low/medium | build plus 30-day observation | restore files |

## Disposition groups

1. **Eligible after minimum verification:** the two backups, `/api/admin/test`, and the five definition-only components. “High” confidence describes static evidence only; none is `verified`.
2. **Hide only:** `/settings/modules` and `/ui-lab`, after owner confirmation. This PR does not hide either route.
3. **Merge after parity:** Customers V2, both customer-creation endpoints, both medical-certificate families, and overlapping V2/UI primitives. Use adapters rather than deletion.
4. **Observe with telemetry:** every candidate, especially externally callable APIs. Static absence is never proof of zero production use.
5. **Protected:** `/test-gate`, `/access`, `/access/check`, `/pass/[token]`, and `/mobile/[token]`.

## Future runtime evidence plan (not implemented here)

Record privacy-preserving counters for route/API invocation, response class, latency bucket, caller class (UI, Bridge, script, unknown), token validation outcome, and adapter fallback. Never record names, email, phone, token, badge/QR value, medical data, request bodies, or stable customer identifiers. Observe at least **30 consecutive production days including one billing boundary**; public-token and hardware paths require **90 days**, an issued-token inventory check, and representative device validation.

Removal requires zero legitimate calls throughout the window, no unknown callers, successful replacement parity at the 99.9th percentile, zero adapter fallbacks for 30 days, passing contract/rollback drills, and written approval. Design System approves UI assets; CRM owns customer/API parity; Platform owns diagnostics; Security and Access Control jointly approve access/hardware; Digital Credentials approves token compatibility. A production incident, unexpected caller, token failure, or device regression resets the observation window. No telemetry is added by this change.

## Conclusions bounded by current evidence

- Both backup files and five named components have no tracked static caller; this does not prove runtime absence.
- `/api/admin/test` has no tracked caller outside its definition; external requests remain unknown.
- Modules is demonstrably classified as a placeholder, but contains a rendered client shell and has a navigation reference.
- UI Lab routes are development-classified; Platinum remains a Foundation reference and is retained.
- Customers V2 is not removable because its API contract and component family have no proven parity replacement.
- `/access` is a compatibility surface whose external links, procedures and device dependencies need observation.
- `/access/check` and `/api/access/check` are separate contracts, not aliases.
- Previously distributed pass/mobile tokens are outside static visibility and require compatibility validation.
- UI overlap requires adapters because naming and intent do not establish prop, state or visual equivalence.
