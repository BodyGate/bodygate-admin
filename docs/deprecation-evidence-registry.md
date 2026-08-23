# Deprecation evidence registry

This registry records evidence and preserves tombstones for completed removals; it authorizes **no runtime change**. The reproducible scanner reads only `git ls-files`, performs no network, database or device access, writes nothing, emits sorted `file:line` evidence, and distinguishes definitions, imports, calls, documentation and other text. Run `npm run qa:deprecations`; run `node scripts/scan-deprecations.mjs` for JSON evidence.

## Safe Cleanup 1 disposition

The seven scoped files below were removed after independent, case-insensitive searches across Git-tracked files found no static importer, barrel export, dynamic import, `require`, JSX use, test, story, script, documentation consumer, route reference, generated loader, or cross-candidate dependency. The `@/*` alias resolves to the repository root, `package.json` declares no package exports, and no candidate was re-exported from a tracked `index` file. TypeScript graph compilation, scoped lint, and the production build are required post-removal gates.

| Historical path | Disposition | Static references found | Shared or runtime asset decision | Rollback |
|---|---|---|---|---|
| `app/components/CustomersTable.backup.tsx` | removed; tombstone retained | definition and registry evidence only; active `CustomersTable` JSX resolves to the separate non-backup module | embedded styles only; no shared asset removed | restore from the cleanup commit |
| `app/components/Sidebar.backup.tsx` | removed; tombstone retained | definition and registry evidence only; active `Sidebar` JSX resolves to the separate non-backup module | inline styles only; no shared asset removed | restore from the cleanup commit |
| `app/components/bodygate-v2/BGMetricCard.tsx` | removed; tombstone retained | definition and registry evidence only | shared `bodygate-v2.css` retained because the V2 family is active | restore from the cleanup commit |
| `app/components/ui/BGContentGrid.tsx` | removed; tombstone retained | definition and registry evidence only | shared CSS selectors retained because active markup uses `bg-content-grid` | restore from the cleanup commit |
| `app/components/ui/BGFormPanel.tsx` | removed; tombstone retained | definition and registry evidence only | shared CSS selectors retained because active markup uses `bg-form-panel` | restore from the cleanup commit |
| `app/components/ui/BGInlineAlert.tsx` | removed; tombstone retained | definition and registry evidence only | shared stylesheet retained | restore from the cleanup commit |
| `app/components/ui/BGPremiumTabs.tsx` | removed; tombstone retained | definition and registry evidence only | shared stylesheet retained | restore from the cleanup commit |

These are high-confidence **static** dispositions, not runtime verification: every `runtimeEvidence` list remains empty, every confidence remains `high` rather than `verified`, and the production-observation evidence gap remains recorded. No route, API, navigation entry, CSS file, or other runtime file was removed or modified.

## Decision matrix

| Candidate | Confirmed duplication | Functional difference | Static evidence | Missing runtime evidence | Proposed decision | Risk | Prerequisites | Rollback |
|---|---|---|---|---|---|---|---|---|
| `*.backup.tsx` (2 files) | Snapshot counterparts exist | Historical implementation may differ | Removed in Safe Cleanup 1 after no tracked caller was found | Deployment/import logs remain absent | removed; tombstones retained | medium/high | static gates completed; runtime evidence remains explicitly unclaimed | restore removal commit |
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
| Five definition-only components | None established | Unknown | Removed in Safe Cleanup 1 after exact symbol/path and loader scans found no tracked consumer | Dynamic/external consumers remain unobserved | removed; tombstones retained | low/medium | static gates completed; runtime evidence remains explicitly unclaimed | restore files |

## Disposition groups

1. **Removed with static tombstones:** the two backups and five definition-only components were removed by Safe Cleanup 1. `/api/admin/test` remains active and only eligible after its separate evidence gates. “High” confidence describes static evidence only; none is `verified`.
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
