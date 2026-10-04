import {apiJson} from '../api.js';
import {
  element,
  link,
  addField,
  addSelect,
  showMessage,
  formatDateTime,
  errorBox
} from '../ui.js';

export async function renderMembers(runtime, spaceId) {
  const main = element('main', {className: 'page-content'});
  main.append(element('p', {role: 'status'}, 'Loading members…'));
  runtime.renderShell(main, true);
  try {
    const [space, listing] = await Promise.all([
      apiJson(`/api/spaces/${encodeURIComponent(spaceId)}`),
      apiJson(`/api/spaces/${encodeURIComponent(spaceId)}/members`)
    ]);
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
      details.append(
          element('strong', {}, member.name),
          element('small', {}, member.email));
      row.append(details);
      if (space.permissions?.canManageMembers && member.role !== 'OWNER') {
        const controls = element('div', {className: 'member-actions'});
        const role = addSelect(
            controls, `Role for ${member.name}`, `role-${member.userId}`,
            [['EDITOR', 'Editor'], ['VIEWER', 'Viewer']], member.role);
        role.addEventListener('change', async () => {
          try {
            await apiJson(
                `/api/spaces/${encodeURIComponent(spaceId)}/members/${
                    encodeURIComponent(member.userId)}`,
                {method: 'PATCH', body: JSON.stringify({role: role.value})});
          } catch (error) {
            showMessage(feedback, error.message);
            role.value = member.role;
          }
        });
        const remove = element(
            'button', {type: 'button', className: 'text-button remove-link'},
            'Remove');
        remove.addEventListener('click', async () => {
          if (!window.confirm(`Remove ${member.name} from ${
                  space
                      .name}? They will lose access to its products and documents.`))
            return;
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
      } else if (member.userId === runtime.session?.id && member.role !== 'OWNER') {
        const leave = element(
            'button', {type: 'button', className: 'text-button remove-link'},
            'Leave');
        leave.addEventListener('click', async () => {
          if (!window.confirm(`Leave ${
                  space
                      .name}? You will no longer see its products and documents.`))
            return;
          try {
            await apiJson(
                `/api/spaces/${encodeURIComponent(spaceId)}/members/${
                    encodeURIComponent(member.userId)}`,
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
      const inviteForm = element('form', {className: 'inline-form'});
      inviteForm.append(element('h2', {}, 'Invite someone'));
      addField(inviteForm, 'Email address', 'email', 'email', {required: ''});
      addSelect(
          inviteForm, 'Access', 'role',
          [['VIEWER', 'Viewer'], ['EDITOR', 'Editor']], 'VIEWER');
      inviteForm.append(element(
          'p', {className: 'muted'},
          'Invitations are accepted from the invitee’s Invitations page.'));
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
          await apiJson(
              `/api/spaces/${encodeURIComponent(spaceId)}/invitations`, {
                method: 'POST',
                body: JSON.stringify({
                  email: String(values.get('email')).trim(),
                  role: values.get('role')
                })
              });
          await renderMembers(runtime, spaceId);
        } catch (error) {
          showMessage(inviteFeedback, error.message);
          submit.disabled = false;
        }
      });
      main.append(inviteForm);
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
          if (!window.confirm(`Revoke the invitation for ${invitation.email}?`))
            return;
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
    main.replaceChildren(errorBox(error, () => renderMembers(runtime, spaceId)));
  }
}
