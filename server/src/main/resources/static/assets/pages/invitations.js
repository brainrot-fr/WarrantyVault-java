import {apiJson} from '../api.js';
import {
  element,
  showMessage,
  formatDateTime,
  errorBox
} from '../ui.js';

export async function renderInvitations(runtime) {
  const main = element('main', {className: 'page-content'});
  main.append(element('p', {role: 'status'}, 'Loading invitations…'));
  runtime.renderShell(main, true);
  try {
    const invitations = await apiJson('/api/invitations');
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
      const actions = element('span', {className: 'member-actions'});
      for (const action of ['decline', 'accept']) {
        const button = element(
            'button', {
              type: 'button',
              className:
                  `text-button ${action === 'accept' ? 'accept-link' : ''}`
            },
            action === 'accept' ? 'Accept' : 'Decline');
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            const accepted = await apiJson(
                `/api/invitations/${encodeURIComponent(invitation.id)}/${
                    action}`,
                {method: 'POST', body: '{}'});
            if (action === 'accept')
              runtime.navigate(`/spaces/${encodeURIComponent(accepted.id)}`);
            else
              await renderInvitations(runtime);
          } catch (error) {
            showMessage(feedback, error.message);
            button.disabled = false;
          }
        });
        actions.append(button);
      }
      row.append(actions);
      list.append(row);
    }
    if (!invitations.length)
      list.append(element(
          'p', {className: 'empty-note'}, 'You have no pending invitations.'));
    main.append(feedback, list);
  } catch (error) {
    main.replaceChildren(errorBox(error, () => renderInvitations(runtime)));
  }
}
