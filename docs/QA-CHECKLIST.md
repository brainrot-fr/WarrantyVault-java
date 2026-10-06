# Manual QA checklist

## Phase 0 audit checks

- [ ] Starting from Overview with no Space, record four route renders and five navigation/action clicks to create the first Space and first product.
- [ ] Confirm the current add-product route is only reachable through Spaces → Space → Add product, and that the header has no global Add product action.
- [ ] Confirm the current product list has search, status, and sort controls but no type control, and that changing them does not update the URL.
- [ ] Confirm the product form has four fieldsets and that the required bill appears in the Documents fieldset after the other product fields.
- [ ] Confirm labels show `(required)` or `(optional)`, status rendering differs between Overview and Space, loading uses text, and successful saves use inline feedback rather than toasts.
- [ ] Confirm Create Space is below the Space list, invitation acceptance has a raw code input without normalization help, and mobile has no bottom tab bar or dark-theme toggle.

## Frontend behavior

## Redesign implementation checks

- [ ] From Overview, use the persistent Add product action and confirm it is available on desktop header and mobile bottom navigation.
- [ ] Confirm the Add product picker lists only Spaces where products can be created, remembers the last-used Space, and offers a first-Space path when no eligible Space exists.
- [ ] Choose a bill image and confirm preview, image type validation, and the 10 MB message happen before submission.
- [ ] Confirm warranty chips update the warranty length and the Covered until date; verify month-end dates such as January 31 plus one month.
- [ ] Confirm Save and add another keeps Space, type, and currency while clearing the bill and remaining fields.
- [ ] Confirm product search, status, type, sort, page, reload, and Back preserve URL query state.
- [ ] Confirm Overview and Space rows use the same status badge with icon/text semantics and that every product row opens the product.
- [ ] Toggle light/dark theme manually and confirm system preference is used when no manual preference is stored.
- [ ] Confirm offline status shows a non-color-only banner and returns to normal after reconnecting.
- [ ] Confirm invitation messages, normalized invite codes, settings saves, and auth errors use the updated accessible feedback.

- [ ] Open a product with a bill and select **Open full size**. Confirm the image opens in a new tab and the WarrantyVault page remains open.
- [ ] With the time zone set to Asia/Kolkata at 01:00, confirm today's date is selectable in the product form.
- [ ] Delete a product, then use Back. Confirm the Space page opens.
- [ ] Select a 12 MB image. Confirm the field shows the size message immediately and no request is sent.
- [ ] Submit an empty form. Confirm errors appear beside fields and identify the field in plain language.

## Responsive layout

- [ ] Review every route at 320 px, 768 px, and 1280 px wide.
- [ ] Confirm no page has horizontal scrolling, clipped content, or overlapping controls.
- [ ] Repeat at 200 percent zoom.
- [ ] Confirm keyboard focus is visible on every interactive control.

## Accessibility and keyboard flow

- [ ] Using only the keyboard, register, create a Space, add a product with a bill, view and edit it, and delete it.
- [ ] Invite a second user, accept the invitation with its code, then sign out.
- [ ] Confirm Escape closes each dialog and focus returns to the control that opened it.
- [ ] Confirm page titles and route announcements update after navigation.
- [ ] Confirm field errors are announced beside their fields and use a readable message.
