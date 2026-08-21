"verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyOjM0YzNmYTNmLWQyNTktNDBmYi05YWI1LThkODlhZjkyZmJjYyIsInNpZCI6IiIsInR5cGUiOiJ2ZXJpZmljYXRpb24iLCJpYXQiOjE3ODU0MjM5ODEsImV4cCI6MTc4NTQyNzU4MSwiYXVkIjoidGVjaGF4b24tYXBpIiwiaXNzIjoidGVjaGF4b24taWRwIn0.3xJi3IqbXvXexau76I58c41AZzOZocqxq27ig9pvQIk"

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyOjM0YzNmYTNmLWQyNTktNDBmYi05YWI1LThkODlhZjkyZmJjYyIsInNpZCI6InNlc3Npb246ZDcxZDBlYzMtYzBhYi00ZWJmLTgxY2MtNWE4ZGNlNWE2YTE2IiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc4NTQyNDA4NSwiZXhwIjoxNzg1NDI0OTg1LCJhdWQiOiJ0ZWNoYXhvbi1hcGkiLCJpc3MiOiJ0ZWNoYXhvbi1pZHAifQ.W1dY-5Ub7ecdBHVDr_ddscvPtPgL94_xnVIyX10VuLA",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyOjM0YzNmYTNmLWQyNTktNDBmYi05YWI1LThkODlhZjkyZmJjYyIsInNpZCI6InNlc3Npb246ZDcxZDBlYzMtYzBhYi00ZWJmLTgxY2MtNWE4ZGNlNWE2YTE2IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3ODU0MjQwODQsImV4cCI6MTc4ODAxNjA4NCwiYXVkIjoidGVjaGF4b24tYXBpIiwiaXNzIjoidGVjaGF4b24taWRwIn0.mAjMgq11eqAmzduf58Si2SU6XW6QyDJ5KoTyBSEBs6k",
  "user": {
    "id": "user:34c3fa3f-d259-40fb-9ab5-8d89af92fbcc",
    "email": "saeed@example.com",
    "username": "saeed"
  }
}



۱. ثبت‌نام کاربر (POST /auth/register)
یک درخواست به اندپوئینت ثبت‌نام بفرستید:

URL: http://localhost:3000/auth/register

Method: POST

Body (JSON):

JSON
{
  "username": "saeed",
  "email": "saeed@example.com",
  "password": "Password123!"
}
نتیجه مورد انتظار: پاسخ 201 Created شامل verificationToken.

بررسی دیتابیس: سند کاربر در CouchDB باید وضعیت pending_verification و emailVerified: false داشته باشد.

۲. تست تلاش برای ورود قبل از تایید ایمیل (تست امنیت)
قبل از زدن توکن تایید، سعی کنید لاگین کنید:

URL: http://localhost:3000/auth/login

Method: POST

Body (JSON):

JSON
{
  "email": "saeed@example.com",
  "password": "Password123!"
}
نتیجه مورد انتظار: پاسخ 401 Unauthorized با پیام:

"Please verify your email address first."

۳. تایید ایمیل (GET /auth/verify-email)
توکنی که در مرحله ۱ دریافت کردید را به عنوان Query Parameter ارسال کنید:

URL: http://localhost:3000/auth/verify-email?token=<VERIFICATION_TOKEN>

Method: GET

نتیجه مورد انتظار: پاسخ 200 OK با پیام موفقیت.

بررسی دیتابیس: وضعیت کاربر در دیتابیس باید به active و emailVerified: true تغییر کرده باشد.

۴. ورود کاربر (POST /auth/login)
حالا مجدداً لاگین کنید:

URL: http://localhost:3000/auth/login

Method: POST

Body (JSON): همان ایمیل و پسوورد مرحله ۲.

نتیجه مورد انتظار: پاسخ 200 OK شامل accessToken و refreshToken.

بررسی دیتابیس: یک سند جدید در دیتابیس sessions با وضعیت active ایجاد شده است.

۵. دسترسی به Route محافظت‌شده (Protected Route)
یک اندپوئینت تست مانند GET /auth/me یا هر اندپوئینت دارای @UseGuards(JwtAuthGuard) بسازید:

URL: http://localhost:3000/auth/me

Method: GET

Headers:

Authorization: Bearer <ACCESS_TOKEN>

نتیجه مورد انتظار: پاسخ 200 OK شامل اطلاعات userId و sessionId.
(اگر توکن نفرستید یا توکن منقضی شده باشد، باید 401 Unauthorized بگیرید).

۶. دریافت Access Token جدید (POST /auth/refresh)
وقتی Access Token منقضی شد:

URL: http://localhost:3000/auth/refresh

Method: POST

Body (JSON):

JSON
{
  "refreshToken": "<REFRESH_TOKEN>"
}
نتیجه مورد انتظار: دریافت یک accessToken جدید.

۷. خروج از حساب (POST /auth/logout)
URL: http://localhost:3000/auth/logout

Method: POST

Body (JSON):

JSON
{
  "sessionId": "session:..."
}
نتیجه مورد انتظار: پاسخ 200 OK.

بررسی دیتابیس: وضعیت Session در دیتابیس به revoked تغییر می‌کند. پس از این مرحله، دیگر با Access Token قبلی یا Refresh Token نمی‌توانید وارد شوید.