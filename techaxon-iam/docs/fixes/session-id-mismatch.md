# Fix: Session ID Mismatch Between Refresh Token Payload and Database Record

## Overview
During the authentication flow (`POST /auth/login`), a subtle logic bug occurred where the `refreshToken` payload contained a temporary session ID (`tempSid`), while the session document in CouchDB was saved with a newly generated database document ID. 

As a result, when users attempted to refresh their token via `POST /auth/refresh`, bcrypt token comparisons failed, causing legitimate refresh requests to return `401 Unauthorized`.

---

## Cause of the Bug
The original login flow executed the following steps:
1. Generated a temporary session UUID (`tempSid`).
2. Signed a raw refresh token containing `sid: tempSid`.
3. Hashed the raw refresh token (`refreshTokenHash`).
4. Called `sessionService.createSession()`, which internally created a **new, independent** UUID (`session:uuid-new`) as the document ID.
5. Signed the final refresh token returned to the frontend with the new document ID (`sid: session:uuid-new`).

Because the token hash stored in CouchDB was derived from `tempSid`, but the token sent back by the client during token rotation contained `session:uuid-new`, `bcrypt.compare()` failed consistently:

```
Signed/Hashed Token (DB):   jwtPayload.sid === "temp-uuid-1"
Received Token (Client):   jwtPayload.sid === "session:uuid-2"
Result:                    bcrypt.compare() -> false (401 Unauthorized)
```

---

## Solution
1. **Deterministic Session ID Generation:** Updated `AuthService.login` to pre-generate a single, fixed `sessionId` (`session:${randomUUID()}`) before signing any tokens.
2. **Aligned Payload & Storage:** Used the exact same `sessionId` to:
   - Sign the refresh token payload (`sid`).
   - Hash the refresh token.
   - Save the session document into CouchDB.
3. **Flexible `SessionService` API:** Enhanced `SessionService.createSession()` to accept an optional `customSessionId` parameter, ensuring callers can enforce strict ID parity across JWT tokens and DB records.

---

## Verification
- Verified `POST /auth/login` yields a valid `refreshToken`.
- Verified `POST /auth/refresh` correctly extracts `sessionId`, matches the DB document, and returns a new `accessToken` without authorization errors.