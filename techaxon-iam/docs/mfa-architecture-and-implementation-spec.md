# Multi-Factor Authentication (MFA / 2FA) Architecture & Specification

> **Status**: Design & Architecture Proposal  
> **Author**: TechAxon IAM Team  
> **Last Updated**: 2026-09-02  

---

## 1. Overview & Strategy

This document specifies the Multi-Factor Authentication (MFA / 2FA) system for TechAxon IAM. The goal is to provide high-grade security for user accounts across the TechAxon ecosystem with minimal user friction during onboarding and daily logins.

### Strategy Comparison:

| Strategy | Security Level | User Friction | Dependencies | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **TOTP (RFC 6238)** | **High** (SIM-swap immune, works offline) | **Low** (6-digit instant code, password manager autofill) | Zero (Native crypto / HMAC-SHA1) | **Primary (Recommended)** |
| **Email OTP** | **Medium** (Subject to email delays) | **Medium** (Switching to email inbox) | SMTP Mailer | **Fallback** |
| **WebAuthn / Passkeys** | **Highest** (Hardware / Biometric) | **Very Low** (TouchID / FaceID) | FIDO2 library | **Future Phase** |

### Selected Architecture:
1. **Primary**: Time-based One-Time Password (TOTP, RFC 6238) compatible with Google Authenticator, Microsoft Authenticator, 1Password, Bitwarden, and Apple Keychain.
2. **Safety Net**: 8 single-use hashed recovery backup codes generated upon activation.
3. **Friction Minimization**:
   - Standard `otpauth://` URI and QR code.
   - 30-second time window with ±1 step drift tolerance.
   - Seamless two-step login challenge flow.

---

## 2. Authentication Flow with MFA Challenge

```
User / App                      TechAxon IAM                    CouchDB
    │                                │                             │
    │── 1. POST /auth/login ────────>│                             │
    │   { email, password }          │── Validate credentials ────>│
    │                                │<── User Doc (mfa: true) ────│
    │                                │                             │
    │<── 2. HTTP 200 OK ─────────────│                             │
    │   { mfaRequired: true,         │ (Issues short-lived 5m      │
    │     mfaToken: "jwt_challenge" }│  JWT challenge token)       │
    │                                │                             │
    │── 3. POST /auth/mfa/authenticate─>                           │
    │   { mfaToken, code: "123456" } │── Verify TOTP window        │
    │                                │── Create Session ──────────>│
    │                                │── Set SSO Cookie            │
    │<── 4. HTTP 200 OK ─────────────│                             │
    │   { accessToken, refreshToken }│                             │
```

---

## 3. Database Schema Updates (`UserDocument`)

```typescript
export interface UserDocument extends BaseDocument {
  type: 'user';
  username?: string;
  email: string;
  passwordHash: string;
  status: 'active' | 'disabled' | 'pending_verification';
  tenantId: string | null;
  emailVerified: boolean;

  // ─── MFA Extension ───
  mfa?: {
    enabled: boolean;
    secret: string;              // Encrypted AES-256-GCM TOTP secret
    backupCodes: string[];       // Array of bcrypt hashes of single-use backup codes
    enrolledAt: string;          // ISO timestamp
    lastUsedAt?: string;
  };

  updatedAt: string;
}
```

---

## 4. API Endpoints

### 4.1 Enrolment (Authenticated User)
- **`POST /auth/mfa/setup`**: Generates TOTP secret and QR code URI.
- **`POST /auth/mfa/enable`**: Validates initial code, saves encrypted secret, returns 8 backup codes.
- **`POST /auth/mfa/disable`**: Requires current password and TOTP code to disable MFA.

### 4.2 Login Authentication (Public Challenge Flow)
- **`POST /auth/login`**: If `mfa.enabled === true`, returns `{ mfaRequired: true, mfaToken: "..." }`.
- **`POST /auth/mfa/authenticate`**: Accepts `mfaToken` + 6-digit TOTP code (or backup code), creates session, sets SSO cookie, and returns tokens.
