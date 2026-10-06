# WarrantyVault UX changes

Implementation record for the redesign requested in the UX audit. The changes
preserve the existing API contracts. No additive endpoint was needed.

## Add-product journey

| Scenario | Before | After target |
| --- | ---: | ---: |
| From Overview to a saved first product when a Space already exists | 3 route loads / 3 clicks | 1 route / up to 8 interactions |
| From any authenticated screen to a saved product with a bill photo | No global entry; 3 route loads / 3 navigation clicks | 1 route / no more than 8 interactions |
| Add another product in the same Space | Return through the product detail route and reopen the form | Save and add another keeps Space, type, and currency |

The new `/add-product` route chooses the last-used permitted Space, offers a
picker when several Spaces can accept products, and gives a direct Create a
Space path when none exist. The backend remains unchanged.

## Decisions

- Use the existing `/api/spaces`, `/api/spaces/{spaceId}/products`,
  `/api/products/facets`, and product update endpoints rather than adding API
  routes.
- Use system dark mode by default with a manual light/dark preference stored in
  local storage.
- Keep pagination on Space product lists for now; URL-backed filters make
  reload, Back, and shared URLs reliable without changing response shape.
- Use the native file picker and existing private image endpoints. Client-side
  previews are object URLs only and are never written to local storage.
- Keep the existing confirmation guard for unsaved forms and add draft support
  only for text fields.

## Phase status

- Phase 0: audit complete.
- Phase 1: shared tokens, controls, feedback, theme, and field-label
  foundations implemented.
- Phase 2: global Add product route, permitted Space selection, bill-first
  ordering, warranty chips/date feedback, and add-another action implemented.
- Phase 3: Overview attention CTA, shared status badges, URL-backed type filter,
  and one-tap product rows implemented.
- Phase 4: member, invitation, settings, and auth improvements implemented.
- Phase 5: offline banner and responsive bottom navigation implemented; final
  visual QA remains a manual follow-up.

