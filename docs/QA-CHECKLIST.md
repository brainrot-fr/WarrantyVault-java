# WarrantyVault QA checklist

## Automated

- [ ] Run `make test`.
- [ ] Check every frontend module with `node --check`.
- [ ] Confirm no `text-button`, raw storage access, inline style, inline script, user-data `innerHTML`, TODO, console logging, or em dash remains in static assets.
- [ ] Confirm `/assets/styles/base.css`, `/assets/pages/product-form.js`, and `/assets/app.js` are served.
- [ ] Confirm `/assets/app.css` and `/favicon.ico` are not created.

## Manual

- [ ] Test light, dark, and system themes.
- [ ] Test keyboard focus and dialogs.
- [ ] Test reduced motion.
- [ ] Test layouts at 360, 390, 768, 1024, 1280, and 1536 pixels.
- [ ] Test product creation with a valid bill and an invalid or oversized image.
- [ ] Test edit conflict handling and private document retry.
- [ ] Test invitations, members, settings, offline, and session expiry.
