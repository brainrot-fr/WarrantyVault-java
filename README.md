# WarrantyVault

WarrantyVault keeps the paperwork behind the things you own in one calm, searchable place. Organize products into Spaces such as Home, Farmhouse, or Office; keep purchase details and bills with each product; and see when warranty coverage ends.

## For households and small teams

- Keep product records and purchase documents organized by Space.
- Invite family members or colleagues as editors or viewers.
- Check coverage dates and keep warranty documents close when you need them.
- Choose a reminder window that fits the way you prefer to plan.

| What matters | How WarrantyVault helps |
| --- | --- |
| A bill that is hard to find | Keep the purchase document beside the product details it belongs to. |
| Different homes or workspaces | Separate records into private Spaces such as Home, Farmhouse, or Office. |
| Sharing without giving everyone the same control | Invite editors to maintain products and viewers to read records; Space owners keep management controls. |
| Missing a warranty end date | See active, expiring, and expired coverage, then choose when reminder emails should begin. |
| Keeping personal paperwork private | Viewers must be invited to a Space, and product images are served through the signed-in application. |

WarrantyVault is designed to make ownership records easier to find and share, not to replace a manufacturer’s warranty terms, purchase receipt, or service process. Keep your original documents where required by the seller or manufacturer.

## Technology built for dependable ownership records

| Layer | Technology | Why it matters |
| --- | --- | --- |
| Web experience | React, Vite, and JavaScript | A fast, responsive vault for organizing products, Spaces, coverage dates, and documents. |
| API and domain | Java 21 and Spring Boot | Clear server-side rules for accounts, shared Spaces, products, invitations, and reminders. |
| Data and migrations | MySQL in production, H2 locally, and Flyway | Durable production records with repeatable schema changes, plus a simple local development setup. |
| Account security | Signed access tokens, rotated refresh tokens, and HttpOnly cookies | Keeps sessions practical for the browser while avoiding long-lived access tokens in persistent browser storage. |
| Private documents | Cloudinary private assets served through the API | Keeps bills and warranty cards out of public image links and puts access behind the signed-in application. |
| Transactional reminders | Brevo HTTPS API | Delivers warranty reminders without relying on SMTP connectivity from the application host. |
| Hosting and delivery | Vercel, Render, Aiven, and GitHub Actions | Separates the customer-facing app, API, managed database, and automated verification into maintainable services. |

## Privacy

Spaces are private to their owner and invited members. A viewer can read records; an editor can maintain product details; only the owner can manage people or delete a Space. Uploaded bills and warranty cards are served through the authenticated API rather than public image links.

For information about account protection and data handling, contact the WarrantyVault administrator for your deployment.
