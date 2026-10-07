# WarrantyVault UI changes

## Foundation

- Added vault tokens for light, dark, and system themes.
- Added self-hosted Inter, Fraunces, and JetBrains Mono font files.
- Added semantic button, link, chip, badge, avatar, dialog, toast, skeleton, ring, and empty-state primitives.
- Added guarded local and session storage helpers.
- Replaced the blue favicon with the green shield mark.

## Navigation and screens

- Rebuilt the authenticated shell for desktop, tablet, and mobile.
- Added breadcrumbs, command palette entry point, account menu, theme controls, mobile tabs, offline messaging, and route error recovery.
- Rebuilt Overview, Spaces, Space, product detail, product creation, product editing, and Members layouts.
- Kept the existing API routes and access-token refresh behavior.

## Accessibility and reliability

- Actions use real buttons and navigation uses real links.
- Focus rings, minimum touch targets, status icons, reduced-motion handling, and screen-reader announcements are included.
- Documents use blob URLs and are released by the runtime on route changes.
- Form drafts are guarded and text-only.
- Month arithmetic clamps to the end of the target month.
