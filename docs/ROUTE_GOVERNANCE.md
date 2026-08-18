# BodyGate route governance

## Purpose and scope

The typed manifest in `architecture/route-manifest.mts` is the static inventory of
the UI routes that physically exist as `page.tsx` files under `app`. It is
architecture metadata only: it must not drive navigation, authorization,
redirects, feature flags, middleware, or any other runtime behavior.

`npm run qa:routes` recursively discovers pages, omits route-group (`(group)`)
and parallel-slot (`@slot`) segments from their URL, preserves dynamic segments,
and requires exact equality with the manifest. The check also rejects duplicate
filesystem paths, duplicate manifest paths, duplicate IDs, nonexistent entries,
missing entries, and any entry whose status is `planned`.

## Design-system boundary

BodyGate has four established UI layers:

- `components/bodygate-ui` is the public Platinum facade. Product code should
  consume Platinum components through this stable boundary.
- `components/ui` contains internal primitives. These are implementation details
  behind the facade rather than a second public product API.
- `app/components/ui` is the legacy UI layer and must be migrated toward the
  Platinum facade instead of expanded as a competing system.
- `app/components/bodygate-v2` is prototype-only and does not define production
  design-system conventions.

Do not introduce a fifth design system. Changes to these boundaries require an
explicit architecture review and a migration plan.

## Critical-area allowlist

Route governance is documentation and validation only. It grants no permission
to alter critical runtime areas. Changes in the following allowlisted areas must
be intentional, separately scoped, and explicitly reviewed by their owners:

- authentication and middleware;
- customers;
- payments, installments, balances, and receipts;
- access control and attendance;
- Bridge, DNake, and KT02.3 integrations;
- badges, QR, Mobile Pass, and turnstile behavior;
- hardware APIs and database/RPC code.

For a route-governance-only change, the expected protected-area diff is empty.
