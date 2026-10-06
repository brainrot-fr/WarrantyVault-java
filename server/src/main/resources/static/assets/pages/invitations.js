import {apiJson} from '../api.js';
import {
  element,
  showMessage,
  showToast,
  formatDateTime,
  errorBox
} from '../ui.js';

export async function renderInvitations(runtime) {
  runtime.setPageTitle('Invitations');
  const main = element('main', {className: 'page-content', 'aria-busy': 'true'});
  main.append(element('p', {role: 'status'}, 'Loading invitations…'));
  runtime.renderShell(main, true);
  try {
    const invitations = await apiJson('/api/invitations');
    main.removeAttribute('aria-busy');
    main.replaceChildren(element('div', {className: 'page-heading'}, [
      element('p', {className: 'eyebrow'}, 'Shared with you'),
      element('h1', {}, 'Invitations')
    ]));
    const list = element('div', {className: 'line-list'});
    const feedback = element('div', {'aria-live': 'polite'});
    for (const invitation of invitations) {
      const row = element('article', {className: 'line-item invitation-row'});
      row.append(element('span', {}, [
        element('strong', {}, invitation.spaceName),
        element(
            'small', {},
            `${invitation.invitedByName} invited you as ${
                invitation.role.toLowerCase()} · expires ${
                formatDateTime(invitation.expiresAt)}`)
      ]));
      row.append(element('p', {className: 'muted role-explanation'},
          invitation.role === 'EDITOR' ?
              'Editors can add and edit products and documents.' :
              'Viewers can read products and documents.'));
      const actions = element('span', {className: 'member-actions'});
      const codeField = element('div', {className: 'field'});
      const codeInput = element('input', {
        id: `invite-code-${invitation.id}`,
        name: 'code',
        type: 'text',
        required: '',
        placeholder: 'Enter the invite code'
      });
      const codeLabel = element('label', {for: codeInput.id}, 'Invite code');
      const codeError = element('p', {
        className: 'field-error', id: `${codeInput.id}-error`, hidden: true
      });
      codeInput.setAttribute('aria-describedby', codeError.id);
      codeField.append(codeLabel, codeInput, codeError);
      row.append(codeField);
      for (const action of ['decline', 'accept']) {
        const button = element(
            'button', {
              type: 'button',
              className:
                  `text-button ${action === 'accept' ? 'accept-link' : ''}`
            },
            action === 'accept' ? 'Accept' : 'Decline');
        button.addEventListener('click', async () => {
          if (action === 'accept' && !codeInput.value.trim()) return;
          button.disabled = true;
          try {
            const accepted = await apiJson(
                `/api/invitations/${encodeURIComponent(invitation.id)}/${
                    action}`,
                {
                  method: 'POST',
                  body: action === 'accept' ?
                      JSON.stringify({
                        code: codeInput.value.trim().toUpperCase().replace(/[\s-]+/g, '')
                      }) : '{}'
                });
            await runtime.refreshInvitations(true);
            if (action === 'accept')
              runtime.navigate(`/spaces/${encodeURIComponent(accepted.id)}`);
            else {
              showToast('Invitation declined.');
              await renderInvitations(runtime);
            }
          } catch (error) {
            if (action === 'accept' && error.code === 'INVALID_INVITE_CODE') {
              codeError.textContent = error.message;
              codeError.hidden = false;
              codeInput.setAttribute('aria-invalid', 'true');
              codeInput.focus();
            } else {
              showMessage(feedback, error.message);
            }
            button.disabled = false;
          }
        });
        actions.append(button);
        if (action === 'accept') {
          button.disabled = true;
          codeInput.addEventListener('input', () => {
            button.disabled = codeInput.value.trim().length === 0;
            codeError.hidden = true;
            codeInput.removeAttribute('aria-invalid');
          });
        }
      }
      row.append(actions);
      list.append(row);
    }
    if (!invitations.length)
      list.append(element(
          'p', {className: 'empty-note'}, 'You have no pending invitations.'));
    main.append(feedback, list);
  } catch (error) {
    main.removeAttribute('aria-busy');
    main.replaceChildren(errorBox(error, () => renderInvitations(runtime)));
  }
}
