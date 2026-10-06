# Manual QA checklist

## Phase 0 audit checks

- [ ] Starting from Overview with no Space, record four route renders and five navigation/action clicks to create the first Space and first product.
- [ ] Confirm the current add-product route is only reachable through Spaces → Space → Add product, and that the header has no global Add product action.
- [ ] Confirm the current product list has search, status, and sort controls but no type control, and that changing them does not update the URL.
- [ ] Confirm the product form has four fieldsets and that the required bill appears in the Documents fieldset after the other product fields.
- [ ] Confirm labels show `(required)` or `(optional)`, status rendering differs between Overview and Space, loading uses text, and successful saves use inline feedback rather than toasts.
- [ ] Confirm Create Space is below the Space list, invitation acceptance has a raw code input without normalization help, and mobile has no bottom tab bar or dark-theme toggle.

## Frontend behavior

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
