# API Testing Notes

## What is included

- Complete route implementation
- Input validation
- Middleware wiring
- Postman collection for all required endpoints

## Screenshots

API testing screenshots are not generated automatically by the backend code. To produce them for submission:

1. Start MongoDB locally.
2. Run the backend with `npm run dev`.
3. Import the Postman collection from `postman/auth-system.postman_collection.json`.
4. Execute each request and capture screenshots from Postman.

## OTP / reset token demo mode

If you do not configure `EMAIL_USER` and `EMAIL_PASS`, the backend returns a `preview` field in the response for email OTP and password reset flows.

This is intentional so you can test and demonstrate the system without paying for external providers.
