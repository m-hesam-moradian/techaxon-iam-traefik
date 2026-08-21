
## 1. Repository & Dependency Rules

1. **Never add or modify dependencies directly on your own branch.** This
   project syncs from a maintainer-controlled **upstream** repo. If you need a
   new package (prod or dev), name it and ask for it to be added to
   `package.json` on upstream first. Only after that lands should you
   sync/pull from upstream and continue building on top of it. Installing a
   package yourself and committing it causes `package.json` drift and merge
   conflicts across contributors.
   - **CRITICAL:** Before proposing or installing any new package, you must explicitly state why the package is needed, why it is the best practice to use it, and wait for the user's explicit approval. Do not install it automatically.
2. Don't rebuild or fork the base project boilerplate independently — always
   sync from upstream's skeleton/boilerplate instead of generating a new one.

## 2. Git Branching Strategy

- `main` → production-ready code only.
- `develop` → integration branch for ongoing work.
- `feature/*` → one branch per feature, merged into `develop` via PR/MR.
- After review + QA, `develop` is merged into `main`.
- `hotfix/*` → urgent production fixes only; merge into `main`, then
  back-merge into `develop` so both stay in sync.
- No direct commits to `main` or `develop` — everything lands via PR/MR.
- **Always Sync Upstream First:** Before starting a new feature branch or task, always execute `git fetch upstream` and sync/rebase onto `upstream/main` (`https://github.com/saeedhei/techaxon-iam.git`) to ensure all work is built on top of the latest upstream code.

## 3. Type Safety

3. **No `any`.** If the project's goal is type safety, `any` — including
   `as any` — is banned. This includes "just for debugging" uses; if you add
   one temporarily, remove it before committing. Prefer real types/interfaces,
   generics, or `unknown` + narrowing.

## 4. Formatting & Linting

4. Prettier/ESLint must be installed and enforced — don't let unformatted,
   overly long lines land in the repo.
5. Configure format-on-save so files are auto-reorganized after every save
   (as long as the required editor modules are installed).
6. Resolve editor-reported lint/type errors before opening a PR. A project
   shouldn't show errors the moment it's opened.

## 5. Configuration

7. **Never hardcode config.** DB URLs, secrets, TTLs, ports, etc. all live in
   `.env`, loaded through one centralized config module (e.g.
   `src/config/*.config.ts`) — config is a central, single source of truth.
8. Design config/schemas ahead of known future needs even if unused today
   (e.g. keep a `tenantId: null` placeholder field now, ahead of multi-tenant
   support), so later changes don't require breaking migrations.

## 6. Database Rules (CouchDB)

9. **Every query pattern needs a matching index.** Don't ship a filter like
   `type + userId` or `type + expiresAt` without creating the corresponding
   Mango index for it.
10. **Never create indexes inside app runtime bootstrap** (e.g.
    `OnModuleInit`). If the app scales to several container replicas coming
    up at once, concurrent index creation causes race conditions and can lock
    the database. Index/schema setup belongs in a dedicated one-shot
    migration/init container or CI/CD step that runs once, before the API
    containers start.
11. **CouchDB only guarantees atomicity within a single document.** Never
    implement a multi-step "reserve, then create" flow split across two
    documents (e.g. claim an email in one doc, then create the user in
    another) — a crash between steps leaves orphaned state (a "locked" email
    with no account behind it). Preferred pattern:
    - Separate **Identity** (stable UUID, safe to keep even if e.g. the email
      changes later) from **Claim** (keyed by a natural key like
      `email:<value>`), relying on CouchDB's native `_id` uniqueness /
      `409 Conflict` to block duplicates instead of a manual check-then-write.
    - Keep a rollback/cleanup path in the service layer to release an orphaned
      claim if account creation fails.
12. Use a **single database with a `type` discriminator field** per document
    (`"user"`, `"session"`, `"email_claim"`, `"verification_token"`,
    `"migration"`, `"audit"`, `"device"`, …) rather than one database per
    entity.
13. Keep DB access behind a repository/interface abstraction (e.g.
    `UserRepository`) so business logic (`AuthService`) stays decoupled from
    CouchDB specifics and could migrate to another store later.
14. Reuse the single shared DB connection/service; don't open new ad-hoc
    `nano.ServerScope` / `nano.DocumentScope` connections per class — it wastes
    memory. Route all access through the existing connection-holding service.

## 7. Auth / Security Architecture

15. **Dual-token model:** short-lived JWT access tokens (~15m TTL, stateless,
    sent as `Authorization: Bearer`, kept client-side in memory only) + opaque
    (non-JWT) refresh tokens (~7–30d TTL).
16. **Refresh tokens are never stored in plaintext.** Hash them (e.g.
    bcryptjs) before persisting, and compare hashes on rotation/validation.
17. Rotate refresh tokens on every use. If a rotated-out token is reused,
    treat it as compromise and revoke the entire session ("reuse detection").
18. Refresh tokens live in an `HttpOnly`, `Secure`, `SameSite` cookie on web;
    in secure storage (Keychain/Keystore) on mobile. Never in
    `localStorage`/JS-readable storage.
19. Sessions must support multi-device (one user, many active sessions) and
    explicit revocation — provide `deleteSession()`, `invalidateSession()`,
    `invalidateAllUserSessions()`, `findByUserId()`, `cleanupExpiredSessions()`,
    not just `create/get/update`.
20. Session documents need a real expiry (`expiresAt`/TTL) and a `status`
    enum (`active | revoked | expired`) rather than a boolean flag.
21. Normalize emails (trim + lowercase) before using them as a uniqueness key,
    to prevent case-variant duplicate accounts.
22. Prefer framework-native building blocks over lower-level libraries when
    both exist in the stack (e.g. use Nest's `@nestjs/jwt` `JwtService` rather
    than calling `jsonwebtoken` directly) to stay idiomatic with the rest of
    the framework.

## 8. API Design / Error Handling

23. Use explicit, dedicated error codes/messages instead of a generic `500` —
    consuming teams (e.g. a separate frontend team) need to distinguish
    failure reasons.
24. Never leave a resource (like a claimed-but-unfinished email/username)
    locked with no cleanup path if a later step in the same operation fails.
25. Don't validate/accept DTOs field-by-field in a way that forces rewriting
    calling code every time a field is added — design DTOs so they're
    extensible without touching every call site.
26. Let the database enforce uniqueness natively where possible (rely on
    CouchDB's own `409 Conflict` on a duplicate `_id` rather than a manual
    check-then-write race).

## 9. Naming Conventions

27. A `_design/xxx` prefix alone doesn't tell you the index type — check the
    design doc's `language` field: `query` = Mango index, `javascript` =
    MapReduce view. Name design docs descriptively (e.g.
    `_design/order_indexes`) so purpose is clear from the name alone.
28. Prefer semantically clear names: `refreshTokenHash` over
    `hashedRefreshToken`; `userAgent` over a loosely-defined `deviceInfo`
    field (derive device/platform info from the user agent instead).
29. Session IDs are generated server-side by the service (e.g.
    `session:{uuidv7}`), never accepted as an arbitrary value passed in by
    the caller.

## 10. Documentation Rules

30. Every architectural decision or "gotcha" that could bite a future
    developer (or an AI agent working on the code) gets written down as a
    numbered rule in this file — one rule, one clear explanation — so it
    isn't rediscovered the hard way twice.
31. Keep flow/spec docs (register flow, API docs, DB indexes) up to date
    whenever the underlying code changes; treat stale docs as a bug.
32. Any new CouchDB index must be documented (name, type, fields, purpose,
    and a sample `curl` command to create it), not just implemented in code.
33. **Read documentation before coding:** Before starting any coding task,
    always explore the `docs/` folder and read all existing documentation and rules
    to ensure full alignment before writing any code.
34. **Sync upstream before new branch/task:** Before starting a new feature
    branch or task, always run `git fetch upstream` and pull/rebase from
    `upstream/main` (`https://github.com/saeedhei/techaxon-iam`) to build on top
    of the latest code updates and prevent merge friction.