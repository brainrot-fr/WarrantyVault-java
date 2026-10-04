import {apiJson} from '../api.js';
import {
  element,
  link,
  addField,
  addSelect,
  addTextarea,
  showMessage,
  formatDate,
  errorBox
} from '../ui.js';

export async function renderSpace(runtime, spaceId) {
  const main = element('main', {className: 'page-content'});
  main.append(element('p', {role: 'status'}, 'Loading Space…'));
  runtime.renderShell(main, true);
  try {
    const space = await apiJson(`/api/spaces/${encodeURIComponent(spaceId)}`);
    main.replaceChildren();
    const heading = element('div', {className: 'page-heading'});
    heading.append(
        element('p', {className: 'eyebrow'}, 'Space'),
        element('h1', {}, space.name),
        element(
            'p', {className: 'section-intro'},
            space.description || 'Products and their coverage details.'));
    const controls = element('div', {className: 'toolbar-actions'});
    controls.append(link(
        'Members', `/spaces/${encodeURIComponent(spaceId)}/members`,
        'button button-quiet'));
    if (space.permissions?.canEdit) {
      const editSpace = element(
          'button', {className: 'button button-quiet', type: 'button'},
          'Edit Space');
      editSpace.addEventListener('click', () => openSpaceEditor(space, runtime));
      controls.append(editSpace);
    }
    if (space.permissions?.canCreateProducts) {
      controls.append(link(
          'Add product', `/spaces/${encodeURIComponent(spaceId)}/products/new`,
          'button button-primary'));
    }
    heading.append(controls);
    main.append(heading);

    const filterForm =
        element('form', {className: 'product-filters', role: 'search'});
    const search = addField(
        filterForm, 'Search products', 'q', 'search',
        {placeholder: 'Name, brand, or model', required: false});
    const status = addSelect(
        filterForm, 'Warranty status', 'status',
        [
          ['', 'All statuses'], ['ACTIVE', 'Active'],
          ['EXPIRING_SOON', 'Expiring soon'], ['EXPIRED', 'Expired']
        ],
        '');
    const sort = addSelect(
        filterForm, 'Sort', 'sort',
        [
          ['expiry', 'Soonest expiry'], ['purchased', 'Recently purchased'],
          ['name', 'Product name']
        ],
        'expiry');
    const productRegion = element('section', {'aria-live': 'polite'});
    const pageControls = element('div', {className: 'page-controls'});
    main.append(filterForm, productRegion, pageControls);

    let page = 0;
    let currentRequest = 0;
    const loadProducts = async (reset = true) => {
      if (reset) page = 0;
      const request = ++currentRequest;
      productRegion.replaceChildren(
          element('p', {role: 'status'}, 'Loading products…'));
      const params = new URLSearchParams(
          {size: '50', page: String(page), sort: sort.value});
      if (search.value.trim()) params.set('q', search.value.trim());
      if (status.value) params.set('status', status.value);
      try {
        const results = await apiJson(
            `/api/spaces/${encodeURIComponent(spaceId)}/products?${params}`);
        if (request !== currentRequest) return;
        productRegion.replaceChildren();
        if (!results.items.length) {
          productRegion.append(element(
              'p', {className: 'empty-note'},
              search.value || status.value ?
                  'No products match these filters.' :
                  'This Space has no products yet.'));
        } else {
          const list = element('div', {className: 'line-list'});
          for (const product of results.items) {
            const row =
                element('article', {className: 'line-item product-row'});
            const summary = element('span');
            summary.append(
                element(
                    'strong', {}, `${product.brand} ${product.productType}`),
                element(
                    'small', {},
                    `${product.modelName || 'No model'} · expires ${
                        formatDate(product.expiresOn)}`));
            row.append(
                summary,
                element(
                    'span', {
                      className: `status-label status-${
                          String(product.status)
                              .toLowerCase()
                              .replaceAll('_', '-')}`
                    },
                    product.status.replaceAll('_', ' ')));
            row.append(link(
                'View',
                `/spaces/${encodeURIComponent(spaceId)}/products/${
                    encodeURIComponent(product.id)}`,
                'text-button'));
            list.append(row);
          }
          productRegion.append(list);
        }
        pageControls.replaceChildren();
        if (results.page > 0) {
          const previous = element(
              'button', {type: 'button', className: 'button button-quiet'},
              'Previous');
          previous.addEventListener('click', () => {
            page -= 1;
            loadProducts(false);
          });
          pageControls.append(previous);
        }
        pageControls.append(element(
            'span', {},
            `${results.totalItems} products · page ${results.page + 1} of ${
                Math.max(results.totalPages, 1)}`));
        if (results.page + 1 < results.totalPages) {
          const next = element(
              'button', {type: 'button', className: 'button button-quiet'},
              'Next');
          next.addEventListener('click', () => {
            page += 1;
            loadProducts(false);
          });
          pageControls.append(next);
        }
      } catch (error) {
        if (request === currentRequest)
          productRegion.replaceChildren(
              errorBox(error, () => loadProducts(false)));
      }
    };
    let filterTimer;
    search.addEventListener('input', () => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => loadProducts(), 250);
    });
    status.addEventListener('change', () => loadProducts());
    sort.addEventListener('change', () => loadProducts());
    filterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      loadProducts();
    });
    await loadProducts();
  } catch (error) {
    main.replaceChildren(errorBox(error, () => renderSpace(runtime, spaceId)));
  }
}

function openSpaceEditor(space, runtime) {
  const dialog = element('dialog', {className: 'app-dialog'});
  const form = element('form', {className: 'form-column'});
  form.append(element('h2', {}, 'Space settings'));
  const name =
      addField(form, 'Name', 'name', 'text', {maxlength: '80', required: ''});
  name.value = space.name;
  const description =
      addTextarea(form, 'Description', 'description', {maxlength: '255'});
  description.value = space.description || '';
  const feedback = element('div', {'aria-live': 'polite'});
  form.append(feedback);
  const actions = element('div', {className: 'dialog-actions'});
  const save = element(
      'button', {type: 'submit', className: 'button button-primary'},
      'Save changes');
  const cancel = element(
      'button', {type: 'button', className: 'button button-quiet'}, 'Cancel');
  cancel.addEventListener('click', () => dialog.close());
  actions.append(save, cancel);
  form.append(actions);
  if (space.permissions?.canDelete) {
    const remove = element(
        'button', {type: 'button', className: 'text-button remove-link'},
        'Delete Space and products');
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${
              space
                  .name}, its products, and stored images? This cannot be undone.`))
        return;
      remove.disabled = true;
      try {
        await apiJson(
            `/api/spaces/${encodeURIComponent(space.id)}`, {method: 'DELETE'});
        dialog.close();
        runtime.navigate('/spaces');
      } catch (error) {
        showMessage(feedback, error.message);
        remove.disabled = false;
      }
    });
    form.append(remove);
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    save.disabled = true;
    const values = new FormData(form);
    try {
      await apiJson(`/api/spaces/${encodeURIComponent(space.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: String(values.get('name')).trim(),
          description: String(values.get('description')).trim() || null
        })
      });
      dialog.close();
      await renderSpace(runtime, space.id);
    } catch (error) {
      showMessage(feedback, error.message);
      save.disabled = false;
    }
  });
  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  name.focus();
}
