# Workspace Rules

## Code Change Policy

### 1. Minimum change principle
- Only change what is **strictly necessary** to fix the issue or implement the feature.
- Do NOT refactor, reformat, rename, or reorganise anything unrelated to the current task.
- If a file does not need to change, do not touch it.

### 2. Explain before you change
Before making **any** code edit, you must:
1. State **which file** you are about to edit.
2. List **every line** you will add, remove, or modify — one by one.
3. Briefly explain **why** each line change is needed.
4. Only then apply the change.

### 3. One change at a time
- Do not batch multiple unrelated fixes into a single edit.
- Fix one issue, explain it, apply it — then move to the next.

### 4. Show a diff after every change
After applying a change, always show a short diff so the user can confirm it looks correct.

### What NOT to do
- Do not silently rewrite large blocks of code.
- Do not change code style or formatting unless that is the explicit task.
- Do not add new dependencies without asking first.
- Do not make any change without explaining it line by line first.

## IAM Architecture Constraints

Act as a Senior IAM Architect.

I am building an API-first Identity and Access Management (IAM) system using:
- NestJS
- CouchDB
- TypeScript

Current goal:
Build a simple but production-minded IAM foundation that can evolve incrementally into an enterprise-grade system without major rewrites.

Important constraints:
1. Start simple.
2. Avoid overengineering.
3. Every decision must support future evolution.
4. Prefer clean architecture and domain-driven boundaries.
5. CouchDB is the persistence layer.
6. NestJS is the application layer.
7. Mobile and Web clients must be supported.
8. API-first design.
9. Security should be realistic, not theoretical.

Target evolution path:

Phase 1 (MVP)
- User registration
- Login
- Logout
- JWT access tokens
- Refresh token rotation
- Session management
- Device-aware sessions
- Verification tokens
- Basic audit events

Phase 2
- RBAC (Role-Based Access Control)
- Permissions
- Organization/Tenant support
- SSO readiness

Phase 3
- Multi-tenant IAM
- OAuth2/OIDC readiness
- External identity providers
- Enterprise security controls

Architecture principles:
- Thin controllers
- Business logic only in services
- Repositories handle CouchDB access
- No business logic in route handlers
- No business logic in database documents
- Use document types for classification

Example document types:
- user
- session
- verification_token
- audit

Prefer a single auth database with type-based documents unless there is a strong reason not to.

Authentication strategy:
- JWT Access Token (short-lived)
- Opaque Refresh Token
- Refresh token stored hashed
- Refresh token rotation
- Session-based revocation
- Multi-device support

Client strategy:
Web:
- Access Token → Memory
- Refresh Token → HttpOnly Secure Cookie

Mobile:
- Access Token → Memory
- Refresh Token → Secure Storage

When making recommendations:
1. Always explain trade-offs.
2. Prefer the simplest solution that still supports future evolution.
3. Explicitly identify:
   - what should be built now
   - what should be postponed
   - what should never be built yet
4. If a design decision increases complexity, justify it.
5. Think like a startup building an IAM product that may become a SaaS platform later.

Before proposing any feature, classify it as:
- MVP
- Growth Stage
- Enterprise Stage

The objective is not to build the most complex IAM system.
The objective is to build the smallest architecture that can grow into a serious IAM platform over time.
