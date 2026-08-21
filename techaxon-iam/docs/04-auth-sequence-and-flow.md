# TechAxon Authentication: Detailed Textual Execution Pipeline

This document provides a highly detailed, step-by-step textual trace of every backend authentication pipeline. It defines how data, parameters, databases, and cryptographic functions interact across our NestJS, CouchDB, and Redis layers.

---

## 1. Pipeline: User Registration (`POST /api/auth/register`)

### 1.1 Request Entry & Validation

- **Trigger:** The client sends an HTTP `POST` request to `/api/auth/register`.
- **Payload:** A JSON body containing:
  - `username` (string)
  - `password` (string)
- **Validation Guard:** Inside `AuthController`, the route is guarded by `@UsePipes(new ValidationPipe())`. This pipe maps the incoming JSON to the `RegisterDto` class:
  - Checks that `username` and `password` are present and are strings.
  - Enforces `@MinLength(6)` on the `password` field.
  - If validation fails, NestJS halts execution immediately and returns `HTTP 400 Bad Request` with the validation error messages.

### 1.2 Controller Execution

- **Method:** `AuthController.register()`
- **Input Capture:** The validated JSON body is captured in the `dto` variable.
- **Action:** The Controller simply forwards these credentials to the Service layer by calling `this.authService.register(dto.username, dto.password)`. It performs no database or encryption logic itself.

### 1.3 Service & Cryptography Execution

- **Method:** `AuthService.register()`
- **Password Encryption:** The service receives the plaintext password and hashes it using `bcryptjs.hash(pass, 10)`. The salt factor is set to `10` rounds.
- **Document Compilation:** A NoSQL document object is created with the following schema:
  ```json
  {
    "type": "user",
    "username": "<username>",
    "password": "<scrambled_bcrypt_hash>",
    "createdAt": "<ISO_8601_timestamp>"
  }
  ```

### 1.4 Database Persistence

- **Database Service:** `CouchDbService`
- **Action:** The Service calls `this.userRepo.createUser(newUser)`, which delegates to CouchDB's `techaxon_core` database.
- **Operation:** CouchDB performs an `insert` write operation, permanently storing the user document, and assigns it a unique, random string `_id` and a starting revision `_rev`.
- **Output:** The database returns `{"ok": true, "id": "...", "rev": "..."}`.
- **Response:** `AuthController` receives this and returns an `HTTP 200 OK` JSON body to the client:
  ```json
  {
    "success": true,
    "id": "<new_user_uuid_from_couchdb>"
  }
  ```

---

## 2. Pipeline: User Login (`POST /api/auth/login`)

### 2.1 Request Entry & Validation

- **Trigger:** The client sends an HTTP `POST` request to `/api/auth/login`.
- **Payload:** JSON body containing `username` and `password`.
- **Validation:** Inspected by `ValidationPipe` against `RegisterDto` rules.

### 2.2 Controller Execution

- **Method:** `AuthController.login()`
- **Input Capture:**
  - Extracts the validated `dto` body.
  - Injects the Express `Request` object (`@Req() req`) to parse headers:
    - `userAgent` is extracted from `req.headers['user-agent']` (defaults to `"Unknown"`).
    - `ip` is extracted from `req.headers['x-forwarded-for']` or `req.ip` (defaults to `"Unknown"`).
  - Injects the Express `Response` object (`@Res({ passthrough: true }) res`) to allow cookie setting while preserving NestJS JSON responses.
- **Action:** Calls `this.authService.login(dto.username, dto.password, 'Codespace Terminal', userAgent, ip)`.

### 2.3 Service & Verification Execution

- **Method:** `AuthService.login()`
- **Database Lookup:** The service asks `CouchDbService` to find the user using a Mango query: `couchDb.find({ selector: { type: 'user', username } })`.
- **Credential Verification:**
  - If no document is returned, it throws an `HTTP 401 UnauthorizedException('Invalid credentials')`.
  - If a document exists, it runs `bcryptjs.compare(pass, user.password)`. If the passwords do not match, it throws an `HTTP 401 Unauthorized`.

### 2.4 Token Generation (TokenService)

- **Method:** `TokenService` is called to generate two tokens:
  1.  **Access Token (JWT):** Signed via `jwt.sign()` containing `{ userId: user._id, username: user.username }` using the `JWT_ACCESS_SECRET` with an expiration of `15m`.
  2.  **Refresh Token (JWT):** Signed via `jwt.sign()` containing only `{ userId: user._id }` using the `JWT_REFRESH_SECRET` with an expiration of `7d`.

### 2.5 Session Creation (SessionService)

- **Method:** `SessionService.createSession()`
- **Hash Generation:** The raw refresh token is hashed via `bcryptjs.hash(refreshToken, 10)` to secure it in case of a database leak.
- **UUID Generation:** A unique `sessionId` (v4 UUID) is generated.
- **Document Compilation:** A session document is compiled:
  ```json
  {
    "_id": "<session_uuid>",
    "type": "session",
    "userId": "<user_uuid>",
    "hashedRefreshToken": "<bcrypt_hash_of_refresh_token>",
    "deviceInfo": "Codespace Terminal",
    "userAgent": "<browser_user_agent>",
    "ip": "<client_ip>",
    "createdAt": "<ISO_8601_timestamp>",
    "isValid": true
  }
  ```
- **CouchDB Write:** The document is inserted into CouchDB's `techaxon_core` database. CouchDB returns the document's first revision ID (`rev`).
- **Revision Synchronization:** The returned `rev` is appended to the `sessionData` object as `sessionData._rev = response.rev`.
- **Redis Write:** The completed `sessionData` (containing `_rev`) is saved to Redis using the key `session:<session_uuid>` with a strict TTL of `7 days` (604,800 seconds).

### 2.6 Cookie & Response Assembly

- **Action:** The service returns the tokens and session metadata to `AuthController`.
- **Cookie Binding:** `AuthController` calls `setCookie()`. It creates a cookie named `techaxon_refresh_token` containing the concatenated string `${sessionId}:${rawRefreshToken}`.
- **Cookie Options:**
  - `httpOnly: true` (Blocks access from frontend client-side scripts).
  - `secure: true` (Only sent over HTTPS in production).
  - `sameSite: "lax"` (Provides CSRF security).
  - `domain: ".techaxon.localhost"` (Enables SSO across subdomains).
  - `maxAge: 604800000` (7 days in milliseconds).
- **JSON Response:** The Controller returns the following JSON response:
  ```json
  {
    "success": true,
    "accessToken": "<short_lived_jwt>",
    "user": { "id": "<user_uuid>", "username": "<username>" }
  }
  ```

---

## 3. Pipeline: Token Rotation (`POST /api/auth/refresh`)

### 3.1 Request Entry & Validation

- **Trigger:** The client browser silently sends a `POST` request to `/api/auth/refresh`.
- **Payload:** The browser automatically attaches the `techaxon_refresh_token` cookie.

### 3.2 Controller Execution

- **Method:** `AuthController.refresh()`
- **Cookie Extraction:** `req.cookies['techaxon_refresh_token']` is read. If empty, the controller throws `Error('No cookie provided')` resulting in a `500` error (handled by global error filters).
- **Action:** Calls `this.authService.refresh(cookie)`.

### 3.3 Service & Security Checks

- **Method:** `AuthService.refresh()`
- **Parsing:** Splits the cookie string by `:` into `sessionId` and `rawRefreshToken`.
- **JWT Verification:** `TokenService.verifyRefreshToken(rawRefreshToken)` is called. It verifies the cryptographic signature of the token against `JWT_REFRESH_SECRET`. If expired or tampered with, it throws an `HTTP 401 UnauthorizedException`.
- **Cache Fetch:** `SessionService.getSession(sessionId)` is executed:
  - Queries Redis first for `session:<sessionId>`.
  - If missing from Redis, it queries CouchDB's `techaxon_core` database.
- **Revocation Check:** Checks if the returned session has `isValid: false`. If so, throws `HTTP 401 Unauthorized`.
- **Hash Comparison:** Runs `bcryptjs.compare(rawRefreshToken, sessionData.hashedRefreshToken)`.
  - **🚨 BREACH DETECTION:** If the comparison fails, it means this specific refresh token was already used or leaked. The server instantly calls `sessionService.revokeSession(sessionId)` which deletes it from Redis, updates its state to `isValid: false` in CouchDB, and throws `HTTP 403 ForbiddenException('Security breach detected')`.

### 3.4 Token Rotation & Database Update

- **Token Signing:** `TokenService` signs a new Access Token and a brand-new Refresh Token.
- **Hash Generation:** The new refresh token is hashed via `bcryptjs.hash()`.
- **Document Update:** An updated session document is compiled, copying all existing properties but updating the `hashedRefreshToken` to the new hash and setting `updatedAt` to the current timestamp. Crucially, the **old `_rev` string** (pulled from the cache) is preserved in this object.
- **CouchDB Write:** `SessionService.updateSession(sessionId, updatedSession)` is called. Because the old `_rev` is present, CouchDB accepts the write, increments the revision tree, and returns a new revision ID (`rev`).
- **Redis Update:** The `updatedSession._rev` is updated with the new revision, and the Redis cache is overwritten with the new data.
- **SSO Cookie & JSON Response:** `AuthController` sets the brand-new rotated cookie containing `${sessionId}:${newRefreshToken}` and returns the new `accessToken` as JSON:
  ```json
  { "success": true, "accessToken": "<new_short_lived_jwt>" }
  ```

---

## 4. Pipeline: User Logout (`POST /api/auth/logout`)

### 4.1 Request Entry & Controller Execution

- **Trigger:** The client sends a `POST` request to `/api/auth/logout`.
- **Action:** `AuthController` extracts the `techaxon_refresh_token` cookie and passes it to `this.authService.logout(cookie)`.

### 4.2 Service Revocation

- **Method:** `AuthService.logout()`
- **Cache Deletion:** The service splits the cookie, extracts the `sessionId`, and calls `redis.del(session:sessionId)`.
- **CouchDB Deactivation:** It fetches the session document from CouchDB, sets `isValid: false`, and updates the document (which succeeds because CouchDB returns the latest `_rev` during the fetch step right before writing).

### 4.3 Cookie Clearing

- **Action:** `AuthController` clears the `techaxon_refresh_token` cookie from the client browser by writing a blank value with `maxAge: 0` bound to the `.techaxon.localhost` domain.
- **Response:** Returns `HTTP 200 OK`:
  ```json
  { "success": true, "message": "Logged out successfully" }
  ```

---

## 5. Pipeline: OIDC Authorization Endpoint (`GET /auth/authorize`)

### 5.1 Request Entry & Parameter Validation

- **Trigger:** The client redirects the user browser to `/auth/authorize`.
- **Query Parameters:**
  - `client_id` (string): The registered OIDC client identifier.
  - `redirect_uri` (string): Pre-registered callback URL for the client.
  - `state` (string): Opaque CSRF protection string.
  - `response_type` (`"code"`): Must be `code` for Authorization Code flow.
- **Validation Guard:** Validated by `AuthorizeQueryDto` using class-validator (`@IsNotEmpty()`, `@IsUrl()`, `@IsIn(['code'])`).

### 5.2 Client & Redirect URI Verification

- **Method:** `AuthService.validateClientRedirectUri(client_id, redirect_uri)`
- **Verification Logic:**
  - Checks if `client_id` exists in `clientsConfig` (`DEFAULT_CLIENTS` or `OIDC_CLIENTS_JSON`).
  - Checks if `redirect_uri` is strictly included in the registered client's `allowedRedirectUris`.
  - If invalid: Immediately halts execution and throws `HTTP 400 Bad Request` (`BadRequestException`). Per RFC 6749, the server **never** redirects to an unauthorized URI.

### 5.3 SSO Cookie & Session Detection

- **Method:** `AuthService.validateRefreshTokenCookie(cookie)`
- **Execution:**
  1. **JWT Verification:** `TokenService.verifyRefreshToken(cookie)` verifies signature against `JWT_REFRESH_SECRET`, issuer, audience, expiration, and ensures `type === 'refresh'`.
  2. **Session DB Lookup:** Extracts `payload.sid` and loads the session document via `SessionService.findSessionById(sid)`.
  3. **Status Check:** Confirms `session.status === 'active'`.
  4. **Subject Matching:** Confirms `session.userId === payload.sub`.
  5. **Expiration Check:** Confirms `new Date(session.expiresAt) >= new Date()`.
  6. **Result:** Returns `userId` if all checks pass; returns `null` on any failure.

### 5.4 Dual-Path Routing

- **Path A: Active SSO Session (`userId` found)**
  - Generates 60-second single-use Authorization Code via `AuthService.generateAuthorizationCode(userId, client_id)`.
  - Persists code document in CouchDB via `AuthCodeRepository` with `type: 'auth_code'`, `code`, `userId`, `clientId`, `expiresAt`, `used: false`.
  - Returns `HTTP 302 Found` redirecting the browser to `${redirect_uri}?code=${code}&state=${state}`.
- **Path B: No Active Session (`userId` is null)**
  - Renders the Handlebars login template `login.hbs` with `clientId`, `redirectUri`, and `state` context so the user can enter credentials.

