# Production deployment

This guide deploys the React app to Vercel Hobby, the Java API to a Render Free Docker Web Service, MySQL to Aiven, private images to Cloudinary, and transactional email through Brevo’s HTTPS API. Free plans and limits can change; check each provider’s current terms before relying on free capacity.

## 0. Prepare the project

1. Create a GitHub repository and push the WarrantyVault source.
2. Confirm `backend/mvnw`, `backend/.mvn/`, `frontend/package-lock.json`, `render.yaml`, and both GitHub Actions workflows are present.
3. Keep all credentials in provider environment-variable settings. Do not commit `.env` files, credentials, database exports, or uploaded images.
4. Decide the final frontend origin (for example `https://example.com`) and API host (`https://api.example.com`) before setting CORS and Vercel variables.

## 1. Set up GitHub CI

GitHub Actions runs backend verification on Java 21 and frontend lint, tests, and production build on pushes and pull requests that touch the corresponding project. Confirm both workflows pass before deployment. The backend should deploy from Render’s Git integration and the frontend from Vercel’s Git integration so both are built from the same reviewed commit.

## 2. Provision Aiven MySQL

1. Create an Aiven MySQL 8 service and a database for WarrantyVault.
2. Allow the Render service to reach the database, and choose the TLS-enabled connection details.
3. Record the hostname, port, database name, username, and password in a private password manager.
4. Build `DB_URL` from Aiven’s connection details, for example:

   ```text
   jdbc:mysql://DB_HOST:DB_PORT/DB_NAME?sslMode=REQUIRED
   ```

The production service runs Flyway migrations at startup. Do not create a separate schema by hand.

## 3. Provision Cloudinary

Create a Cloudinary account and record the cloud name, API key, and API secret. WarrantyVault uses authenticated/private asset delivery and proxies reads through its API; do not make warranty documents public or expose Cloudinary credentials to the frontend.

## 4. Configure Brevo transactional mail

Verify the sending address or domain in Brevo, then create an API key. WarrantyVault sends through `POST https://api.brevo.com/v3/smtp/email` over HTTPS; it does not use SMTP. Set the verified sender address and API key on Render. Render’s free tier may block outbound SMTP ports, which is why the HTTPS API is used.

## 5. Create the Render backend

1. Connect the GitHub repository to Render and create the service from the repository’s `render.yaml` blueprint.
2. Confirm the service uses the Docker runtime, `backend/` as its root, and `backend/Dockerfile`.
3. Keep `SPRING_PROFILES_ACTIVE=prod`; the Docker image also sets `prod` so the app cannot fall back to local demo infrastructure.
4. Set the backend environment variables in step 6, then deploy.
5. Confirm Render’s health check at `/api/health` passes. A sleeping free instance may take longer to answer its first request.

## 6. Add Render environment variables

| Variable | Required value |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `prod` (provided by the blueprint and Docker image) |
| `DB_URL` | Aiven JDBC URL with TLS required |
| `DB_USER` | Aiven database user |
| `DB_PASSWORD` | Aiven database password |
| `JWT_SECRET` | At least 32 random bytes; must not equal the local development secret |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact frontend origins, with no wildcard |
| `APP_BASE_URL` | Canonical frontend origin used in invitation links |
| `CRON_SECRET` | Independent high-entropy value for the external reminder request |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `BREVO_API_KEY` | Brevo transactional API key |
| `BREVO_SENDER` | Verified sender email address |
| `COOKIE_SAMESITE` | `Lax` for the recommended same-site domains; `None` only for a cross-site frontend over HTTPS |
| `COOKIE_DOMAIN` | Optional; leave unset for a host-only API cookie unless the chosen cookie-domain design requires otherwise |

Production configuration validation fails at startup if required properties are missing or invalid. Generate unrelated secrets, for example with `openssl rand -hex 32` on a trusted machine. Never paste secret values into CI output, tickets, or screenshots.

## 7. Configure the Vercel project

1. Import the repository in Vercel and set the project root to `frontend/`.
2. Use `npm run build` as the build command and `dist/` as the output directory. The project uses Vite; no server-side rendering is required.
3. Add this production environment variable and rebuild after changing it:

   ```text
   VITE_API_BASE_URL=https://api.example.com
   ```

4. `frontend/vercel.json` supplies the SPA fallback so deep links such as `/spaces/{id}` resolve to the React app.
5. Vercel’s preview and production origins must be included explicitly in `CORS_ALLOWED_ORIGINS` if those previews are expected to call the API.

A production build with no `VITE_API_BASE_URL` deliberately displays a configuration error rather than sending requests to an accidental host.

## 8. Attach the custom domain and align cookies

Add the apex domain and, if desired, `www` to Vercel and follow Vercel’s DNS instructions. Point the `api` subdomain to the Render service using the target Render provides. Set `APP_BASE_URL` to the one canonical frontend origin and list the exact frontend origins in `CORS_ALLOWED_ORIGINS`.

The recommended arrangement keeps the frontend and API under the same registrable domain (for example `example.com` and `api.example.com`) and uses `COOKIE_SAMESITE=Lax`. For a genuinely cross-site frontend, configure `COOKIE_SAMESITE=None`; production cookies are Secure. Check that the API’s CORS origin exactly matches the browser origin and that credentials are allowed.

## 9. Deploy in dependency order

1. Provision Aiven, Cloudinary, and Brevo.
2. Set Render variables and deploy the backend; wait for `/api/health`.
3. Set `VITE_API_BASE_URL` and the custom frontend domain in Vercel; deploy the frontend.
4. Confirm the final HTTPS origin, invitation links, and browser refresh-cookie flow before inviting real users.

## 10. Schedule daily reminders

Production’s internal scheduler is disabled. In a free external HTTPS cron service such as cron-job.org, create one daily `POST` request to:

```text
https://api.example.com/api/internal/reminders/run
```

Send the `X-Cron-Secret` header with the exact `CRON_SECRET` from Render. Schedule once daily (08:00 UTC is a practical starting point). A valid request returns `202 Accepted`; `skipped: true` means another run is already in progress. A missing or invalid secret receives an empty `401`. Keep the secret out of the URL and job name.

## 11. Run production smoke checks

1. Check `GET https://api.example.com/api/health`.
2. Open the Vercel deployment, register a non-demo account, and confirm a refresh restores the session after a browser reload.
3. Create a Space and add a product with a small JPEG, PNG, or WebP bill.
4. Confirm the product’s expiry and status, then check that the bill is only available through an authenticated API request.
5. Invite a second account, accept the invitation, and verify viewer/editor actions match their roles.
6. Confirm reminder preferences save and an authorized cron request returns `202`; confirm a request without the secret returns `401`.

## 12. Security notes

- Email verification is not implemented in v1. Registration does not require completing an email challenge.
- Password reset by email is not implemented in v1. Users who forget their password need help from the service operator; do not promise self-service recovery.
- Account deletion, ownership transfer, offline writes, social login, and push notifications are also out of scope for v1.
- Access JWTs live in browser memory. Refresh tokens are rotated, stored hashed in the database, and sent only in an HttpOnly cookie.
- Never log passwords, tokens, cron secrets, Cloudinary credentials, or production email bodies.
- Keep CORS origins explicit. Do not use `*` with credentialed requests.
- Uploaded images are private and proxied by the API. Cloudinary and Aiven credentials remain server-side.
- Rate-limit counters are in memory and per application instance, not shared between Render instances.
- Free hosting availability and limits are controlled by the providers and can change. Keep independent backups for data that must outlive a free service.

## 13. Cloudflare Pages alternative

Cloudflare Pages can host the frontend instead of Vercel. Set the project root to `frontend/`, build command to `npm run build`, and output directory to `dist`. Configure `VITE_API_BASE_URL` and an SPA fallback to `/index.html` (Vercel’s rewrite file is not consumed by Pages). Keep the backend, database, storage, and email setup unchanged. Add the exact Pages origin to `CORS_ALLOWED_ORIGINS`; use `COOKIE_SAMESITE=None` with HTTPS only when the chosen frontend/API arrangement is genuinely cross-site.
