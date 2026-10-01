# Local development

WarrantyVault is designed to run locally first. The `local` Spring profile uses a file-backed H2 database and local image storage. Registration, Spaces, products, uploads, OCR, JWT authentication, and collaboration work with **zero external accounts or cloud services**.

## Prerequisites

- Java 21
- Node.js 22 and npm
- Git

No system Maven installation is needed; the Maven wrapper is included. OCR language data is fetched once during frontend dependency installation when it is not already present.

## Run the application

Start the backend in one terminal from the repository root:

```sh
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Start the Vite frontend in another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. In development, the frontend sends API requests to `http://localhost:8080` by default. No environment variables are required. To start both processes together instead, run `make local` from the repository root.

## Demo accounts

The local profile seeds sample data on a new database:

| Email | Password | Access |
| --- | --- | --- |
| `demo@warrantyvault.local` | `Password123!` | Owner of the Home and Farmhouse Spaces |
| `family@warrantyvault.local` | `Password123!` | Viewer in Home with a pending Farmhouse invitation |

The sample products include active, expiring-soon, and expired coverage. Invitations are in-app and can be accepted from the invitee's Invitations screen. To test with a clean account, register another user in the application.

## Local data and reset

- H2 database: `backend/data/warrantyvault` (H2 creates the database files there).
- Uploaded bills and warranty cards: `backend/uploads/`.
- Generated demo images: stored in the same local uploads directory.

Stop the backend before resetting local data. From the repository root, run:

```sh
make clean-local
```

This removes only `backend/data/` and `backend/uploads/`. The demo seeder recreates its accounts and sample data the next time the backend starts with an empty database.

## OCR without a cloud account

Receipt OCR runs in the browser with Tesseract.js, its WASM worker, and English language data served by the frontend. OCR processing does not require an OCR provider account or send the image to a hosted recognition service. The first `npm ci` downloads the English trained data (about 23 MB) if it is not already present. Keep the Vite server running for local development; after installation the OCR assets are served from the local checkout, so recognition itself does not need an internet connection. In an installed production PWA, open the app and run OCR once while online so its service worker caches the Tesseract assets for later offline use. OCR results are suggestions that should be reviewed before saving.

## Tests and useful targets

Run the full project checks from the repository root:

```sh
make test
```

This runs `./mvnw -B verify` in the backend and frontend lint, tests, and production build. The individual checks are:

```sh
cd backend && ./mvnw -B verify
cd frontend && npm run lint
cd frontend && npm test
cd frontend && npm run build
```

Other targets are `make backend`, `make frontend`, and `make local`.
