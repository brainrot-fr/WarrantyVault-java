# WarrantyVault UI audit

## Current experience

WarrantyVault uses a vault-inspired visual system with paper and ink surfaces, deep green actions, brass emphasis, self-hosted typography, and responsive layouts for desktop, tablet, and mobile.

## Implemented behavior

- Authenticated views render inside a sidebar shell, icon rail, or mobile bottom navigation.
- Overview uses a bento layout with coverage health, count-up stats, value totals, expiry attention cards, and an upcoming timeline.
- Spaces use responsive navigational cards with health bars, roles, member counts, pluralized labels, and a create dialog.
- A Space supports URL-backed search and status filters with product cards and empty and retry states.
- Product detail uses a coverage panel, key facts, private image loading, and action buttons.
- Product creation and editing use a four-step flow with a live preview, guarded drafts, file validation, and server-compatible multipart requests.
- Members, invitations, authentication, and settings remain available through the shared shell.
- Theme preference is applied before first paint and can be selected as light, dark, or system.
- Static badges are not live regions. Async regions use live announcements where appropriate.
- Motion has a reduced-motion path and pauses looping effects while the document is hidden.

## Known constraints

The backend is intentionally unchanged. Calendar export, full lightbox gestures, and server-side product facet filtering beyond the existing endpoints are not required for the current client contract.
