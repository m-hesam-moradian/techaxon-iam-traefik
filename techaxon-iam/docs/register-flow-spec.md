# Register Flow Specification (v1)

## 1. User Starts Registration

**Actor:** User

The user opens the registration page and fills in: - Username
(optional) - Email - Password

Then clicks **Create Account**.

------------------------------------------------------------------------

## 2. Frontend Sends Request

**Actor:** Next.js Frontend

**Request**

``` http
POST /auth/register
```

``` json
{
  "username": "saeed",
  "email": "Saeed@Example.com",
  "password": "password123"
}
```

------------------------------------------------------------------------

## 3. Request Validation

**Actor:** NestJS Controller

Validate the incoming request using `RegisterDto`.

Checks: - Valid email format - Password requirements - Username is
optional

If validation fails:

**HTTP 400 Bad Request**

Otherwise continue.

------------------------------------------------------------------------

## 4. Normalize Email

**Actor:** AuthService

Normalize the email before any lookup.

Example:

    "  Saeed@Example.COM "

↓

    saeed@example.com

Operations: - `trim()` - `toLowerCase()`

------------------------------------------------------------------------

## 5. Duplicate Email Check

Call:

``` ts
findByEmail(normalizedEmail)
```

If a user exists:

**HTTP 409 Conflict**

Message:

    A user with this email already exists.

Stop.

Otherwise continue.

------------------------------------------------------------------------

## 6. Generate User ID

Generate a UUID.

Example:

    user:d94f6e8f...

Used by: - User document - Email claim document

------------------------------------------------------------------------

## 7. Atomically Reserve Email

Call:

``` ts
claimEmail(email, userId)
```

Create:

    _id = email:saeed@example.com

Example:

``` json
{
  "_id":"email:saeed@example.com",
  "type":"email_claim",
  "email":"saeed@example.com",
  "userId":"user:uuid",
  "createdAt":"..."
}
```

Purpose:

Prevent race conditions.

If the claim already exists:

**HTTP 409 Conflict**

Otherwise continue.

------------------------------------------------------------------------

## 8. Hash Password

Hash the password using bcrypt.

``` ts
bcrypt(password, 10)
```

Never store plaintext passwords.

------------------------------------------------------------------------

## 9. Create User Document

``` json
{
  "_id":"user:uuid",
  "type":"user",
  "username":"...",
  "email":"saeed@example.com",
  "passwordHash":"...",
  "status":"pending_verification",
  "tenantId":null,
  "emailVerified":false,
  "createdAt":"...",
  "updatedAt":"..."
}
```

------------------------------------------------------------------------

## 10. Save User

Call:

``` ts
createUser(user)
```

Insert into CouchDB.

------------------------------------------------------------------------

## 11. User Creation Result

If successful:

Continue.

If failed:

Possible reasons: - Database error - Network error - Unexpected
exception

------------------------------------------------------------------------

## 12. Release Email Claim

Call:

``` ts
releaseEmailClaim(email)
```

Delete:

    email:saeed@example.com

Purpose:

Allow another registration attempt.

------------------------------------------------------------------------

## 13. Return Error

Return:

**HTTP 500 Internal Server Error**

End flow.

------------------------------------------------------------------------

## 14. Registration Successful

Return:

``` json
{
  "success": true,
  "id": "user:uuid"
}
```

Status:

**HTTP 201 Created**

End flow.

# CouchDB Documents

## User

    _id = user:{uuid}
    type = user

Fields: - username - email - passwordHash - status - tenantId -
emailVerified - createdAt - updatedAt

## Email Claim

    _id = email:{normalizedEmail}
    type = email_claim

Fields: - email - userId - createdAt

## Future Documents

-   session
-   refresh_token (optional)
-   verification_token
-   password_reset_token
-   migration
-   audit
-   tenant
-   role
-   permission

# HTTP Responses

  Status   Meaning
  -------- -----------------------------------------
  201      Registration completed
  400      Validation failed
  409      Email already exists or already claimed
  500      Unexpected server error

# Design Principles

-   Normalize email before any lookup.
-   Perform a fast duplicate lookup for better user experience.
-   Use CouchDB `_id` uniqueness for atomic email reservation.
-   Protect against race conditions.
-   Never store plaintext passwords.
-   Release the email claim if user creation fails.
-   Keep business logic inside `AuthService`.
-   Keep persistence logic inside `UserRepository`.
-   Keep CouchDB implementation inside `CouchDbService`.
