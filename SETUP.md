# Production deployment

This guide deploys the React app to Vercel Hobby, the Java API to a Render Free Docker Web Service, MySQL to Aiven, private images to Cloudinary, and transactional email through Brevo’s HTTPS API. At the time of writing, the guide assumes these services and their free plans are available. Provider plans, free-tier limits, and product behavior can change, so check current terms before relying on free capacity.

## 0. Prepare the project

1. Create a GitHub repository and push the WarrantyVault source.
2. Confirm `backend/mvnw`, `backend/.mvn/`, `frontend/package-lock.json`, `render.yaml`, and both GitHub Actions workflows are present.
3. Keep all credentials in provider environment-variable settings. Do not commit `.env` files, credentials, database exports, or uploaded images.
4. Decide the final HTTPS frontend origin and API hostname before setting CORS and Vercel variables.

## 1. Set up GitHub CI

GitHub Actions runs backend verification on Java 21 and frontend lint, tests, and production build on pushes and pull requests that touch the corresponding project. Confirm both workflows pass before deployment. The backend should deploy from Render’s Git integration and the frontend from Vercel’s Git integration so both are built from the same reviewed commit.

## 2. Provision Aiven MySQL

1. Create an Aiven MySQL 8 service and a database for WarrantyVault.
2. Allow the Render service to reach the database, and choose the TLS-enabled connection details.
3. Download the CA certificate from the Aiven service connection information. Keep it in a protected location and do not commit it.
4. If the downloaded certificate is PEM, save it as `ca.pem` on a trusted machine and create a PKCS12 truststore:

   ```sh
   keytool -importcert -alias aiven-mysql -file ca.pem -keystore aiven-truststore.p12 -storetype PKCS12
   ```

   Choose a strong truststore password when prompted, accept the certificate after checking its fingerprint against Aiven’s published details, and upload `aiven-truststore.p12` to Render as a secret file. Render mounts secret files under `/etc/secrets/`.
5. Configure MySQL Connector/J to verify the Aiven certificate and server identity. Set `DB_URL` to use Connector/J `sslMode=VERIFY_IDENTITY` and the truststore file location, type, and password options. Keep the truststore password private in Render’s environment settings and percent-encode reserved characters if it is included in the JDBC URL. The Aiven Java connection guide and MySQL Connector/J TLS guide below describe the supported connection options.
6. Record the hostname, port, database name, username, and password in a private password manager.
7. Set `DB_URL`, `DB_USER`, and `DB_PASSWORD` in Render using the Aiven connection details. Do not put certificate or credential contents in source control.

The production service runs Flyway migrations at startup. Do not create a separate schema by hand.

## 3. Provision Cloudinary

Create a Cloudinary account and record the cloud name, API key, and API secret. WarrantyVault uses authenticated/private asset delivery and proxies reads through its API; do not make warranty documents public or expose Cloudinary credentials to the frontend.

## 4. Configure Brevo transactional mail

Verify the sending address or domain in Brevo, then create an API key. WarrantyVault sends through `POST https://api.brevo.com/v3/smtp/email` over HTTPS; it does not use SMTP. Set the verified sender address and API key on Render. Render’s free tier may block outbound SMTP ports, which is why the HTTPS API is used.

## 5. Create the Render backend

1. Connect the GitHub repository to Render and create the service from the repository’s `render.yaml` blueprint.
2. Confirm the service uses the Docker runtime, `backend/` as its root, and `backend/Dockerfile`.
3. Keep `SPRING_PROFILES_ACTIVE=prod`; the Docker image also sets `prod` so the app cannot fall back to local demo infrastructure.
4. Add the Aiven truststore as a Render secret file if certificate verification uses one. Reference its mounted file path and truststore settings in `DB_URL`.
5. Set the backend environment variables in step 6, then deploy.
6. Confirm the service health check at `/api/health` passes. A sleeping free instance can take longer to answer its first request.

## 6. Add Render environment variables

The production profile validates required settings during startup. `COOKIE_SAMESITE` and `COOKIE_DOMAIN` are optional. Render sets the production profile and cookie same-site default in the supplied blueprint.

| Variable | Required or optional | Local | Production |
| --- | --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | Optional locally, required for production | Defaults to `local` | Set to `prod`; the Docker image and blueprint provide it |
| `PORT` | Optional | Defaults to `8080` | Render provides the listening port |
| `DB_URL` | Optional locally, required in production | Uses the local H2 database | Aiven JDBC URL with certificate and server identity verification |
| `DB_USER` | Optional locally, required in production | Uses the local H2 account | Aiven database username |
| `DB_PASSWORD` | Optional locally, required in production | Uses the local H2 account | Aiven database password |
| `JWT_SECRET` | Optional locally, required in production | Uses a development-only default | At least 32 bytes, unique, and not the local development secret |
| `CORS_ALLOWED_ORIGINS` | Optional locally, required in production | Defaults to the Vite localhost origins | Comma-separated exact frontend origins, with no wildcard |
| `APP_BASE_URL` | Optional locally, required in production | Defaults to the Vite localhost origin | Canonical HTTPS frontend origin used in invitation links |
| `CRON_SECRET` | Optional locally, required in production | Uses a development-only default | Independent high-entropy value sent in the `X-Cron-Secret` header |
| `CLOUDINARY_CLOUD_NAME` | Optional locally, required in production | Not used by local image storage | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Optional locally, required in production | Not used by local image storage | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Optional locally, required in production | Not used by local image storage | Cloudinary API secret |
| `BREVO_API_KEY` | Optional locally, required in production | Not used by console mail | Brevo transactional API key |
| `BREVO_SENDER` | Optional locally, required in production | Uses the local console mail sender | Verified Brevo sender email address |
| `COOKIE_SAMESITE` | Optional | Defaults to `Lax` | Defaults to `Lax`; use `None` only for a genuinely cross-site frontend over HTTPS |
| `COOKIE_DOMAIN` | Optional | Leave unset for the localhost host-only cookie | Leave unset for a host-only API cookie unless the chosen cookie-domain design requires otherwise |

Generate independent secrets on a trusted machine, for example with `openssl rand -hex 32`. Never paste secret values into CI output, tickets, or screenshots. If a PKCS12 truststore is used, store it as a Render secret file and keep its password in a private Render environment setting referenced by the Aiven JDBC URL.

## 7. Configure the Vercel project

1. Import the repository in Vercel and set the project root to `frontend/`.
2. Use `npm run build` as the build command and `dist/` as the output directory. The project uses Vite; no server-side rendering is required.
3. Set this production environment variable to the deployed API’s full HTTPS base address, then rebuild after changing it:

   ```text
   VITE_API_BASE_URL
   ```

4. `frontend/vercel.json` supplies the SPA fallback so deep links to Space pages resolve to the React app.
5. Vercel’s preview and production origins must be included explicitly in `CORS_ALLOWED_ORIGINS` if those previews are expected to call the API.

A production build with no `VITE_API_BASE_URL` deliberately displays a configuration error rather than sending requests to an accidental host.

| Variable | Required or optional | Local | Production |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Optional locally, required in production | Defaults to `http://localhost:8080` during Vite development | Full HTTPS base address of the deployed API |

## 8. Attach the custom domain and align cookies

Add the chosen frontend domain and, if desired, its `www` hostname to Vercel and follow Vercel’s DNS instructions. Point the API hostname to the Render service using the target Render provides. Set `APP_BASE_URL` to the one canonical frontend origin and list the exact frontend origins in `CORS_ALLOWED_ORIGINS`.

The recommended arrangement keeps the frontend and API under the same registrable domain and uses `COOKIE_SAMESITE=Lax`. For a genuinely cross-site frontend, configure `COOKIE_SAMESITE=None`; production cookies are Secure. Check that the API’s CORS origin exactly matches the browser origin and that credentials are allowed.

## 9. Deploy in dependency order

### Moving from local development to production

Production uses a separate Aiven database and Cloudinary storage. The local H2 database and files in `backend/uploads/` are not migrated automatically, and copying the H2 database file to Aiven is not a supported migration. Recreate any records that need to move and upload their documents through the deployed app. Keep local settings and credentials separate from production settings.

1. Provision Aiven, Cloudinary, and Brevo.
2. Set Render variables and the Aiven truststore secret file, then deploy the backend. Wait for `/api/health`.
3. Set `VITE_API_BASE_URL` and the custom frontend domain in Vercel, then deploy the frontend.
4. Confirm the final HTTPS origin, invitation links, and browser refresh-cookie flow before inviting real users.

## 10. Schedule a wake-up request before daily reminders

Production’s internal scheduler is disabled. A Render Free service can sleep while idle, so configure two daily requests in an external HTTPS cron service such as cron-job.org. Keep both requests pointed at the API hostname assigned to the deployed service.

1. Create a wake-up request scheduled for **02:50 UTC** every day. Send `GET` to `/api/health`. This request is public and should return a healthy response.
2. Create the reminder request scheduled for **03:00 UTC** every day. Send `POST` to `/api/internal/reminders/run` with the `X-Cron-Secret` header set to the exact `CRON_SECRET` value from Render.

A valid reminder request returns `202 Accepted`; `skipped: true` means another run is already in progress. A missing or invalid secret receives an empty `401`. Keep the secret out of the URL and job name. Review the cron provider’s run history after configuring both schedules.

## 11. Run end-to-end production verification

1. Request `GET /api/health` at the deployed API hostname and confirm it returns a healthy response.
2. Open the Vercel deployment, register a test account with an email address you can access, and confirm a browser reload restores the session.
3. Create a Space and add a product with a small JPEG, PNG, or WebP bill. Confirm the product’s expiry and status, and confirm the bill is only available through an authenticated API request.
4. Invite a second test account, accept the invitation, and verify viewer and editor actions match their roles.
5. Set reminder preferences for the first test account. Add or edit a product so its expiry falls within that account’s reminder window, and confirm its reminder is eligible for the next daily run.
6. Confirm both scheduled cron requests appear as successful in the cron provider’s history. The reminder request should return `202`; a request without the secret should return `401`.
7. Wait for the reminder run to finish, confirm Brevo accepted the message in its transactional email logs, and confirm the reminder email arrives in the test inbox. Check spam folders and the sender’s verified status if it does not arrive.

## 12. Troubleshooting

### The first API request is slow or times out

The Render free service may be waking from an idle period. Wait for the instance to start, retry `/api/health`, and check Render’s service events and logs. Confirm the daily wake-up request runs before the reminder request.

### Render reports a database TLS or certificate error

Confirm `DB_URL` uses Aiven’s current host, port, and database, and that certificate verification is enabled. Check that the Aiven CA certificate is current, the truststore is in Render’s secret files, and its mounted path, format, type, and password match the JDBC URL settings. Re-download the CA after Aiven certificate rotation.

### The backend refuses to start with incomplete production configuration

Read the startup message for missing or invalid settings. Check the required production variables in step 6, especially the 32-byte `JWT_SECRET`, explicit `CORS_ALLOWED_ORIGINS`, Aiven connection settings, Cloudinary credentials, Brevo credentials, and `CRON_SECRET`. Redeploy after updating environment variables.

### The frontend shows a configuration error or calls the wrong API

Check that Vercel has `VITE_API_BASE_URL` set to the deployed API’s full HTTPS base address in the correct environment. Trigger a new Vercel build after changing it.

### Sign-in works but refresh, invitation acceptance, or API calls fail

Check the exact browser origin against `CORS_ALLOWED_ORIGINS`, confirm credentialed requests are allowed, and make sure the cookie same-site policy matches whether the frontend and API are same-site. Use `COOKIE_SAMESITE=None` only with HTTPS for a genuinely cross-site setup.

### Product images fail to upload or display

Check that the three Cloudinary settings are correct on Render and that the API service can reach Cloudinary. Confirm requests use the signed-in API and that the assets have not been made public.

### The reminder endpoint returns unauthorized or no email arrives

Check that the cron header is named `X-Cron-Secret` and its value exactly matches Render’s `CRON_SECRET`. A `202` acknowledges that work was accepted, not that email delivery completed. Confirm an account has an eligible expiring product and reminder preference, inspect Render logs and Brevo transactional logs, and verify the sender address or domain.

## 13. Security notes

- Email verification is not implemented in v1. Registration does not require completing an email challenge.
- Password reset by email is not implemented in v1. Users who forget their password need help from the service operator; do not promise self-service recovery.
- Account deletion, ownership transfer, offline writes, social login, and push notifications are also out of scope for v1.
- Access JWTs live in browser memory. Refresh tokens are rotated, stored hashed in the database, and sent only in an HttpOnly cookie.
- The refresh cookie uses `Path=/api` so password changes can identify and preserve the current refresh-token family. Keep the frontend and API on the same site where possible; use the documented `SameSite=None` setting only with HTTPS when they are genuinely cross-site.
- Never log passwords, tokens, cron secrets, Cloudinary credentials, or production email bodies.
- Keep CORS origins explicit. Do not use `*` with credentialed requests.
- Uploaded images are private and proxied by the API. Cloudinary and Aiven credentials remain server-side.
- Rate limiting uses the last `X-Forwarded-For` address appended by Render, rather than the client-controlled first hop. Do not expose the backend directly without a trusted proxy that appends this header. Counters are in memory and per application instance, not shared between Render instances.
- Free hosting availability and limits are controlled by the providers and can change. Keep independent backups for data that must outlive a free service.

## 14. Cloudflare Pages alternative

Cloudflare Pages can host the frontend instead of Vercel. Set the project root to `frontend/`, build command to `npm run build`, and output directory to `dist`. Configure `VITE_API_BASE_URL` and an SPA fallback to `/index.html` (Vercel’s rewrite file is not consumed by Pages). Keep the backend, database, storage, and email setup unchanged. Add the exact Pages origin to `CORS_ALLOWED_ORIGINS`; use `COOKIE_SAMESITE=None` with HTTPS only when the chosen frontend/API arrangement is genuinely cross-site.

## Provider documentation

- [Aiven Java connection guide for MySQL](https://aiven.io/docs/products/mysql/howto/connect-with-java)
- [MySQL Connector/J TLS properties](https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-security.html)
- [Render environment variables and secret files](https://render.com/docs/configure-environment-variables)
- [Render cron jobs](https://render.com/docs/cronjobs)
- [Render free web services](https://render.com/docs/free)
- [Vercel environment variables](https://vercel.com/docs/projects/environment-variables)
- [Cloudinary authenticated assets](https://cloudinary.com/documentation/control_access_to_media)
- [Brevo transactional email API](https://developers.brevo.com/docs/send-a-transactional-email)
- [cron-job.org request configuration](https://cron-job.org/en/)
