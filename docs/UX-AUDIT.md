# WarrantyVault UX audit

Phase 0 audit of every file under `server/src/main/resources/static`, completed
2026-10-06. The counts below describe the current route-based SPA when starting
from the authenticated Overview page. A page load means a distinct route render,
not a browser refresh. A click means a navigation or submit/action click;
typing, selecting a field, and scrolling are not counted.

## Current journey counts

| Task | Page loads | Clicks | Current path |
| --- | ---: | ---: | --- |
| Create first Space and first product | 4 | 5 | Overview → Spaces → create Space in place → Space → Add product → save |
| Add another product | 3 | 3 | Space → Add product → save; the form returns to the product detail route |
| See what expires soon | 1 | 0 | Overview already contains the expiring-soon list |
| Find a specific product | 3 | 2 | Overview → Spaces → Space; search is an input interaction and View is the action click |
| Change a product | 3 | 3 | Space → product detail → Edit product → save |
| Invite someone and accept the invite | 4 | 3 | Space → Members → invitation created; invitee signs in on Invitations → accepts |

The first-product count assumes the user starts with no Space and uses the
visible controls. Creating a Space does not navigate away, but opening the new
Space and opening the product form are separate route loads. The add-another
count starts on an existing Space and includes the product detail route reached
after the previous save. These are conservative interaction counts: form entry
is deliberately excluded so navigation friction can be compared with the
redesign target.

## Findings and planned fixes

| Area | Evidence | Finding | Phase 0 decision / planned fix |
| --- | --- | --- | --- |
| Add product entry point | [app.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/app.js:21), [shell.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/shell.js:14), [space.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/space.js:42) | The only create route is `/spaces/:id/products/new`; the header has no Add product action. The practical first-product path is Overview → Spaces → Space → Add product, four route renders. | Confirmed. Add a persistent desktop header action and mobile Add tab. Open a preselected Space picker from any authenticated route. |
| Field labels | [ui.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/ui.js:109), [ui.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/ui.js:199), [ui.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/ui.js:218) | Shared field helpers append `(required)` or `(optional)` to every label. | Confirmed. Remove suffixes and use a quiet Optional tag only for optional fields. |
| Button language and styling | [shell.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/shell.js:28), [marketing.css](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/styles/marketing.css:29), [layout.css](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/styles/layout.css:20), [space.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/space.js:31) | The same action is represented by `text-button`, `button-quiet`, `button-primary`, and plain links. Destructive actions are also text buttons in several screens. | Confirmed. Define and apply one primary, secondary, quiet, danger, and icon-button system. |
| Status badges | [dashboard.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/dashboard.js:17), [dashboard.css](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/styles/dashboard.css:105), [space.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/space.js:126) | Overview adds symbols only for expiring and expired products; Space rows use text-only status labels. There is no shared status component. | Confirmed. Use one status badge implementation with icon and text everywhere, never color alone. |
| Loading states | [dashboard.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/dashboard.js:48), [spaces.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/spaces.js:21), [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:16) | Loading is communicated as standalone text such as “Loading…” while `aria-busy` is set. | Confirmed. Replace visual loading text with reusable skeletons while retaining accessible status text. |
| Success feedback | [ui.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/ui.js:36), [settings.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/settings.js:84), [members.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/members.js:62) | Success is inserted into local inline live regions. There is no toast system for save, invite, or accept outcomes. | Confirmed. Add an aria-live toast region and keep inline errors beside their fields. |
| Create Space placement | [spaces.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/spaces.js:48) | Create Space is appended below the Space list as an inline form, including on an empty page. | Confirmed. Move creation into an accessible dialog with a clear page-level action. |
| Product filtering | [space.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/space.js:47), [ProductController.java](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/java/com/warrantyvault/product/ProductController.java:39) | The UI has search, status, and sort but no type filter and does not write filters to the URL. The existing API already accepts `type`, so Back loses the client-side filter state rather than requiring an API change. | Confirmed. Add type filtering and serialize search, status, type, sort, and pagination in the query string. |
| Product form structure | [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:45) | The form is split into four fieldsets, not five: Product details, Purchase and coverage, Notes, and Documents. The required bill is in the fourth fieldset, after the long text and coverage sections. | Corrected. Keep one calm screen, but move the bill to the first task, collapse More details, and make the primary action persistent on mobile. |
| Product form effort | [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:76), [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:212) | Warranty length is a free numeric field and there is one save action. There is no live covered-until line, save-and-add-another path, or draft persistence. | Add warranty chips and date preview, preserve Space/type/currency for add-another, save text drafts only, and clear drafts after save. |
| Invitation creation | [members.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/members.js:147) | The one-time code is shown in a plain read-only input with Copy and Dismiss controls. There is no generated invitation message naming the Space and role. | Partially confirmed. Retain a one-time code but add a copyable human invitation message and clearer role explanations. |
| Invitation acceptance | [invitations.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/invitations.js:29), [invitations.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/invitations.js:66) | The invite code input accepts raw text with no uppercase-as-you-type, space/dash stripping, or formatting hint. Accept errors are inline and success navigates without a toast. | Confirmed. Normalize display input before submission and show accepted/declined outcomes as toasts. |
| Dark theme | [index.html](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/index.html:2), [base.css](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/styles/base.css:1) | The document is explicitly light and the token set has no dark theme or preference toggle. | Confirmed. Add system-driven dark tokens with a manual preference toggle. |
| Mobile navigation | [responsive.css](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/styles/responsive.css:1), [shell.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/shell.js:16) | Mobile only wraps the same horizontal header navigation; there is no fixed bottom navigation and no Add tab. | Confirmed. Add a 44px+ bottom tab bar for Overview, Spaces, Add, Invitations, and Settings. |
| Add flow Space permissions | [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:28) | The existing route checks `canCreateProducts` for one known Space, but the global flow does not exist and cannot choose among permitted Spaces or create one inline. | Add a picker listing only permitted Spaces, remember the last-used Space, and support inline first-Space creation without changing API contracts. |
| Date and currency defaults | [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:76), [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:112) | Purchase date has a timezone-aware max but no default; currency uses the account currency but does not remember the last-used currency. | Default the date in the user timezone and persist the last-used currency locally. |
| Validation and drafts | [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:191), [app.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/app.js:135) | Native submit validation is used, server errors can focus a field, and unsaved navigation is guarded. Blur validation, plain inline messages, and text-only draft restoration are missing. | Preserve the unsaved-changes guard and add blur validation, first-error focus, and local text drafts. Never persist image data. |
| Documents | [products.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/products.js:104), [product-form.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/product-form.js:172) | Images load one at a time with a text loading state; there is an “Open full size” fallback but no lightbox, tabs, or session-level blob URL reuse. | Add document tabs and a zoomable dialog, retain the full-size fallback, and reuse blob URLs during a session while revoking them on route change. |
| Dashboard hierarchy | [dashboard.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/dashboard.js:80) | Expiring soon is shown before recent expired records, but the page has no explicit Needs attention block and no persistent Add product CTA. Empty states use different copy and action patterns. | Make Needs attention the first block, make rows one-tap targets, add the CTA, and standardize single-action empty states. |
| Space summaries | [spaces.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/spaces.js:31) | Space rows show product and member counts but not the API’s expiring/expired summary. | Use cards with counts, compact status summary, and a visible Space switcher/breadcrumb. |
| Product rows and actions | [space.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/space.js:118), [products.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/products.js:20) | Rows require a separate View link, omit days remaining and coverage progress, and have no role-aware overflow menu. Pagination is separate Previous/Next controls. | Make each row one tap, show brand/type, days, and a thin progress bar, and use an overflow menu. Keep pagination unless usability testing supports Load more. |
| Product detail | [products.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/products.js:29) | Detail uses a button row for Back/Edit/Delete, a single facts list, and stacked documents without tabs or breadcrumbs. Status is plain text. | Add breadcrumbs, shared status header, key-fact grid, document tabs/lightbox, and an overflow menu for Edit/Delete. |
| Command palette | [app.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/app.js:266) | There is no keyboard command palette or Ctrl/Cmd+K handling. | Add navigation-only palette using already-loaded client data. |
| Auth and settings consistency | [auth.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/auth.js:34), [settings.js](/home/syed-jalal/dev/WarrantyVault-java/server/src/main/resources/static/assets/pages/settings.js:20) | Auth has autocomplete and password toggles, but no autofocus or error summary. Settings combines profile and password forms without grouped Preferences/Security sections, searchable timezone, or toast save feedback. | Add autofocus, a shared error summary, grouped settings, searchable timezone selection, and consistent toasts/password guidance. |

## Suspected-problem confirmation

- Adding a product requires four route renders from Overview and has no global entry point: **confirmed**.
- Every field label carries a required/optional suffix: **confirmed**.
- Buttons are inconsistent: **confirmed**.
- Dashboard and Space status badges differ: **confirmed**.
- Loading states are bare text: **confirmed**.
- Success feedback is inline and there are no toasts: **confirmed**.
- Create Space is a form at the bottom of Spaces: **confirmed**.
- Product type filtering is absent even though the API supports `type`, and filters are not in the URL: **confirmed**.
- The product form is a long scroll and the bill is buried: **confirmed**, with the suspected count corrected from five fieldsets to four.
- Invitation codes lack a shareable message and invitee formatting help: **confirmed**; a basic Copy button already exists for the raw code.
- There is no dark mode: **confirmed**.
- There is no bottom navigation on mobile: **confirmed**.

## Phase 0 implementation plan

1. Establish shared tokens, controls, feedback, form, dialog, sheet, menu, chip,
   segmented-control, skeleton, and empty-state primitives without changing API
   contracts.
2. Add the global Add product flow and reuse it for editing, including draft
   persistence, image validation, warranty date calculation, and mobile actions.
3. Improve Overview, Spaces, Space, and Product routes with URL-preserved
   filters, attention-first content, shared status, document viewing, and the
   navigation palette.
4. Improve invitations, members, settings, and auth, then add offline/slow
   network, error, and responsive polish.

The planned phases do not require an additive API at audit time. The existing
`type` query parameter and `/api/products/facets` endpoint are sufficient for
the planned product type filter and suggestions.
