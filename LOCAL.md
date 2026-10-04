# Local development

The `local` Spring profile uses a file-backed H2 database and local image storage. Registration, Spaces, products, uploads, authentication, and collaboration work without external accounts or cloud services.

## Prerequisites

- Java 21
- Git

The Maven wrapper is included; no system Maven installation is needed.

## Run the application

From the repository root, run:

```sh
make run
```

Open <http://localhost:8080>. Spring Boot serves the web app and API from this single origin.

Warranty status uses the configurable `app.expiring-soon-days` property, which defaults to `30`. Change it in `server/src/main/resources/application.properties` when testing a different attention window.

## Demo accounts

The local profile seeds sample data on a new database:

| Email | Password | Access |
| --- | --- | --- |
| `demo@warrantyvault.local` | `Password123!` | Owner of the Home and Farmhouse Spaces |
| `family@warrantyvault.local` | `Password123!` | Viewer in Home with a pending Farmhouse invitation |

The sample products include active, expiring-soon, and expired coverage. Invitations are in-app and can be accepted from the invitee's Invitations screen. To test with a clean account, register another user in the application.

## Local data and reset

- H2 database: `server/data/warrantyvault` (H2 creates the database files there).
- Uploaded bills and warranty cards: `server/uploads/`.
- Generated demo images: stored in the same local uploads directory.

Stop the application before resetting local data. From the repository root, run:

```sh
make clean-local
```

This removes only `server/data/` and `server/uploads/`. The demo seeder recreates its accounts and sample data the next time the application starts with an empty database.

## Web-only feature boundary

The web app is online-only. Product details are entered manually, and bill or warranty-card images are uploaded to the Java application.

## Tests and useful targets

Run the full project checks from the repository root:

```sh
make test
```

This runs the application checks:

```sh
cd server && ./mvnw -B verify
```

Other targets are `make run`, `make local`, and `make clean-local`.
