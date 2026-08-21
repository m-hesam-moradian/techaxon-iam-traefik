AuthController
       │
       ▼
AuthService (Login)
       │
       ├─────────────► UserRepository
       │
       ├─────────────► PasswordService (bcrypt)
       │
       ├─────────────► TokenService
       │
       └─────────────► SessionService
                             │
                             ▼
                     SessionRepository
                             │
                             ▼
                       CouchDB
