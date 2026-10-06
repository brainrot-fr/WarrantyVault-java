import {apiJson} from '../api.js';
import {
  element,
  link,
  addField,
  addSelect,
  showMessage,
  showToast,
  formatDateTime,
  errorBox,
  confirmDialog
} from '../ui.js';

export async function renderMembers(runtime, spaceId) {
  const main = element('main', {className: 'page-content', 'aria-busy': 'true'});
  main.append(element('p', {role: 'status'}, 'Loading members…'));
  runtime.renderShell(main, true);
  try {
    const [space, listing] = await Promise.all([
      apiJson(`/api/spaces/${encodeURIComponent(spaceId)}`),
      apiJson(`/api/spaces/${encodeURIComponent(spaceId)}/members`)
    ]);
    runtime.setPageTitle('Members');
    main.removeAttribute('aria-busy');
    main.replaceChildren();
    const heading = element('div', {className: 'page-heading'});
    heading.append(
        element('p', {className: 'eyebrow'}, space.name),
        element('h1', {}, 'Members and invitations'),
        element(
            'p', {className: 'section-intro'},
            'Editors can add and edit products. Viewers can read products and documents.'));
    heading.append(link(
        'Back to Space', `/spaces/${encodeURIComponent(spaceId)}`,
        'text-button'));
    main.append(heading);
    const list = element('div', {className: 'line-list'});
    for (const member of listing.members || []) {
      const row = element('article', {className: 'line-item member-row'});
      const details = element('span');
      details.append(element('strong', {}, member.name));
      if (member.email) details.append(element('small', {}, member.email));
      row.append(details);
      if (space.permissions?.canManageMembers && member.role !== 'OWNER') {
        const controls = element('div', {className: 'member-actions'});
        const role = addSelect(
            controls, 'Role', `role-${member.userId}`,
            [['EDITOR', 'Editor'], ['VIEWER', 'Viewer']], member.role);
        role.closest('.field').append(element(
            'small', {className: 'muted'},
            member.role === 'EDITOR' ?
                'Can add, edit, and manage product records.' :
                'Can view products and documents.'));
        role.closest('.field').querySelector('label').append(
            element('span', {className: 'sr-only'}, ` for ${member.name}`));
        role.addEventListener('change', async () => {
          const previousRole = member.role;
          role.disabled = true;
          try {
            await apiJson(
                `/api/spaces/${encodeURIComponent(spaceId)}/members/${
                    encodeURIComponent(member.userId)}`,
                {method: 'PATCH', body: JSON.stringify({role: role.value})});
            member.role = role.value;
            showToast(`${member.name}'s role was updated.`);
          } catch (error) {
            showMessage(feedback, error.message);
            role.value = previousRole;
          } finally {
            role.disabled = false;
          }
        });
        const remove = element(
            'button', {type: 'button', className: 'text-button remove-link'},
            'Remove');
        remove.addEventListener('click', async () => {
          if (!await confirmDialog({
            title: `Remove ${member.name}?`,
            body: `They will lose access to ${space.name} and its documents.`,
            confirmLabel: 'Remove',
            danger: true
          })) return;
          try {
            await apiJson(
                `/api/spaces/${encodeURIComponent(spaceId)}/members/${
                    encodeURIComponent(member.userId)}`,
                {method: 'DELETE'});
            await renderMembers(runtime, spaceId);
          } catch (error) {
            showMessage(feedback, error.message);
          }
        });
        controls.append(remove);
        row.append(controls);
      } else if (member.isCurrentUser && member.role !== 'OWNER') {
        const currentMemberId = member.userId || runtime.session?.id;
        const leave = element(
            'button', {type: 'button', className: 'text-button remove-link'},
            'Leave');
        leave.addEventListener('click', async () => {
          if (!await confirmDialog({
            title: `Leave ${space.name}?`,
            body: 'You will no longer see its products and documents.',
            confirmLabel: 'Leave',
            danger: true
          })) return;
          try {
            await apiJson(
                `/api/spaces/${encodeURIComponent(spaceId)}/members/${
                    encodeURIComponent(currentMemberId)}`,
                {method: 'DELETE'});
            runtime.navigate('/spaces');
          } catch (error) {
            showMessage(feedback, error.message);
          }
        });
        row.append(leave);
      } else {
        row.append(element(
            'span', {className: 'role-label'}, member.role.toLowerCase()));
      }
      list.append(row);
    }
    main.append(list);
    const feedback = element('div', {'aria-live': 'polite'});
    main.append(feedback);
    if (space.permissions?.canManageMembers) {
      const inviteNotice = element('section', {className: 'notice invite-code-notice', hidden: true});
      const inviteForm = element('form', {className: 'inline-form'});
      inviteForm.append(element('h2', {}, 'Invite someone'));
      addField(inviteForm, 'Email address', 'email', 'email', {
        required: '',
        placeholder: 'invitee@example.com'
      });
      addSelect(
          inviteForm, 'Access', 'role',
          [['VIEWER', 'Viewer'], ['EDITOR', 'Editor']], 'VIEWER');
      inviteForm.append(element(
          'p', {className: 'muted'},
          'Viewers can read products and documents. Editors can add and edit them. '
          + 'The invitee enters the one-time code from their Invitations page.'));
      const inviteFeedback = element('div', {'aria-live': 'polite'});
      inviteForm.append(
          inviteFeedback,
          element(
              'button', {type: 'submit', className: 'button button-primary'},
              'Send invitation'));
      inviteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!inviteForm.reportValidity()) return;
        const values = new FormData(inviteForm);
        const submit = inviteForm.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          const created = await apiJson(
              `/api/spaces/${encodeURIComponent(spaceId)}/invitations`, {
                method: 'POST',
                body: JSON.stringify({
                  email: String(values.get('email')).trim(),
                  role: values.get('role')
                })
              });
          inviteNotice.hidden = false;
          inviteNotice.replaceChildren(
              element('h2', {}, 'Invitation code'),
              element('p', {}, 'Give this code to the invitee. They enter it on their Invitations page. It is shown only once.'));
          const codeInput = element('input', {
            type: 'text', value: created.inviteCode, readOnly: '',
            'aria-label': 'Invitation code'
          });
          const copy = element('button', {type: 'button', className: 'text-button'}, 'Copy');
          const copyFeedback = element('div', {'aria-live': 'polite'});
          copy.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(created.inviteCode);
              showToast('Invitation code copied.');
            } catch {
              codeInput.select();
              document.execCommand('copy');
              showMessage(copyFeedback, 'Select and copy the invitation code.', 'status');
            }
          });
          const dismiss = element('button', {type: 'button', className: 'text-button'}, 'Dismiss');
          dismiss.addEventListener('click', () => inviteNotice.remove());
          inviteNotice.append(codeInput, copy, copyFeedback, dismiss);
          inviteForm.reset();
          showToast('Invitation created. Share the code now; it is shown only once.');
        } catch (error) {
          showMessage(inviteFeedback, error.message);
          submit.disabled = false;
        }
      });
      main.append(inviteForm);
      main.append(inviteNotice);
      main.append(
          element('h2', {className: 'section-title'}, 'Pending invitations'));
      const pending = element('div', {className: 'line-list'});
      for (const invitation of listing.invitations || []) {
        const row = element('article', {className: 'line-item'});
        row.append(element('span', {}, [
          element('strong', {}, invitation.email),
          element(
              'small', {},
              `${invitation.role.toLowerCase()} · expires ${
                  formatDateTime(invitation.expiresAt)}`)
        ]));
        const revoke = element(
            'button', {className: 'text-button remove-link', type: 'button'},
            'Revoke');
        revoke.addEventListener('click', async () => {
          if (!await confirmDialog({
            title: 'Revoke this invitation?',
            body: `The invitation for ${invitation.email} will no longer work.`,
            confirmLabel: 'Revoke',
            danger: true
          })) return;
          try {
            await apiJson(
                `/api/spaces/${encodeURIComponent(spaceId)}/invitations/${
                    encodeURIComponent(invitation.id)}`,
                {method: 'DELETE'});
            await renderMembers(runtime, spaceId);
          } catch (error) {
            showMessage(feedback, error.message);
          }
        });
        row.append(revoke);
        pending.append(row);
      }
      if (!(listing.invitations || []).length)
        pending.append(
            element('p', {className: 'empty-note'}, 'No pending invitations.'));
      main.append(pending);
    }
  } catch (error) {
    main.removeAttribute('aria-busy');
    main.replaceChildren(errorBox(error, () => renderMembers(runtime, spaceId)));
  }
}
