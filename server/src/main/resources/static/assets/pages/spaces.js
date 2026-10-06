import {apiJson} from '../api.js';
import {element, link, addField, showMessage} from '../ui.js';

export async function renderSpaces(runtime) {
  runtime.setPageTitle('Spaces');
  const main = element('main', {className: 'page-content'});
  const heading = element('div', {className: 'page-heading'});
  heading.append(
      element('p', {className: 'eyebrow'}, 'Your collection'),
      element('h1', {}, 'Spaces'),
      element(
          'p', {className: 'section-intro'},
          'Organize products and warranty records by the places and people that matter.'));
  main.append(heading);
  const status = element('section', {'aria-live': 'polite', 'aria-busy': 'true'});
  main.append(status);
  runtime.renderShell(main, true);
  await loadSpaces(status);
}

async function loadSpaces(container) {
  container.replaceChildren(element('p', {role: 'status'}, 'Loading Spaces…'));
  try {
    const spaces = await apiJson('/api/spaces');
    container.removeAttribute('aria-busy');
    container.replaceChildren();
    if (!spaces.length) {
      container.append(element(
          'p', {className: 'empty-note'}, 'You haven’t created a Space yet.'));
    } else {
      const list = element('div', {className: 'line-list'});
      for (const space of spaces) {
        const row = element('article', {className: 'line-item space-row'});
        const details = element('div');
        details.append(
            element('strong', {}, space.name),
            element(
                'small', {},
                `${space.productCount} products · ${
                    space.memberCount} members`));
        row.append(
            details,
            link(
                'Open Space', `/spaces/${encodeURIComponent(space.id)}`,
                'text-button'));
        list.append(row);
      }
      container.append(list);
    }
    const form = element('form', {className: 'inline-form'});
    form.append(element('h2', {}, 'Create a Space'));
    addField(form, 'Name', 'name', 'text', {
      maxlength: '80',
      required: '',
      placeholder: 'e.g. Home'
    });
    addField(
        form, 'Description', 'description', 'text',
        {
          maxlength: '255',
          required: false,
          placeholder: 'Add a short description'
        });
    const feedback = element('div', {'aria-live': 'polite'});
    form.append(
        feedback,
        element(
            'button', {className: 'button button-primary', type: 'submit'},
            'Create Space'));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const values = new FormData(form);
      try {
        await apiJson('/api/spaces', {
          method: 'POST',
          body: JSON.stringify({
            name: String(values.get('name')).trim(),
            description: String(values.get('description')).trim()
          })
        });
        await loadSpaces(container);
      } catch (error) {
        container.removeAttribute('aria-busy');
        showMessage(feedback, error.message);
      } finally {
        submit.disabled = false;
      }
    });
    container.append(form);
  } catch (error) {
    const retry = element(
        'button', {className: 'button button-quiet', type: 'button'},
        'Try again');
    retry.addEventListener('click', () => loadSpaces(container));
    container.replaceChildren(
        element('p', {className: 'form-error', role: 'alert'}, error.message),
        retry);
  }
}
