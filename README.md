# WarrantyVault

WarrantyVault is a local-first product warranty vault for keeping ownership records, purchase documents, and warranty coverage organized. It supports private Spaces for homes or small teams, with role-based collaboration and in-app invitations.

## Features

- Organize products, bills, and optional warranty cards into Spaces.
- Share Spaces with owners, editors, and viewers.
- Track active, expiring-soon, and expired warranties, with dashboard lists for upcoming and recently expired coverage.
- Use browser-based OCR to suggest product details from an image.
- Work locally without cloud accounts or hosted services.

## Technology

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite, JavaScript |
| Backend | Java 21, Spring Boot |
| Local database | H2 file database with Flyway migrations |
| Optional deployed database | MySQL with Flyway migrations |
| Authentication | JWT access tokens and rotating refresh-token cookies |
| Image storage | Local filesystem |
| Optional deployment | One Railway service serves the API and built frontend |

The optional Railway demo stores images on the instance's local filesystem. Railway free instances have an **ephemeral filesystem**, so uploaded images can be lost after a redeploy or restart. This is acceptable for a demo/interview deployment; keep original documents elsewhere.
