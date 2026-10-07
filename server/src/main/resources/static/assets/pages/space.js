import {apiJson} from '../api.js';
import {
  element,
  link,
  addField,
  addSelect,
  addTextarea,
  showMessage,
  formatDate,
  errorBox,
  confirmDialog,
  statusBadge
} from '../ui.js';

export async function renderSpace(runtime, spaceId) {
  runtime.setPageTitle('Space');
  const main = element('main', {className: 'page-content', 'aria-busy': 'true'});
  main.append(element('p', {role: 'status'}, 'Loading Space…'));
  runtime.renderShell(main, true);
  try {
    const initialParams = new URLSearchParams(window.location.search);
    const initialProductParams = new URLSearchParams({
      size: '50', page: '0', sort: initialParams.get('sort') || 'expiry'
    });
    if (initialParams.get('q')?.trim())
      initialProductParams.set('q', initialParams.get('q').trim());
    if (initialParams.get('status'))
      initialProductParams.set('status', initialParams.get('status'));
    if (initialParams.get('type'))
      initialProductParams.set('type', initialParams.get('type'));
    const [space, facets, initialProducts] = await Promise.all([
      apiJson(`/api/spaces/${encodeURIComponent(spaceId)}`),
      apiJson('/api/products/facets'),
      apiJson(
          `/api/spaces/${encodeURIComponent(spaceId)}/products?${
              initialProductParams}`)
    ]);
    runtime.setPageTitle(space.name);
    main.removeAttribute('aria-busy');
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
    search.setAttribute('aria-controls', 'product-results');
    search.value = initialParams.get('q') || '';
    const status = addSelect(
        filterForm, 'Warranty status', 'status',
        [
          ['', 'All statuses'], ['ACTIVE', 'Active'],
          ['EXPIRING_SOON', 'Expiring soon'], ['EXPIRED', 'Expired']
        ],
        initialParams.get('status') || '',
        {required: false});
    const sort = addSelect(
        filterForm, 'Sort', 'sort',
        [
          ['expiry', 'Soonest expiry'], ['purchased', 'Recently purchased'],
          ['name', 'Product name']
        ],
        initialParams.get('sort') || 'expiry');
    const type = addSelect(
          filterForm, 'Product type', 'type',
          [['', 'All types'], ...(facets.types || []).map((value) => [value, value])],
          new URLSearchParams(window.location.search).get('type') || '',
          {required: false});
    const productRegion = element('section', {id: 'product-results'});
    const pageControls = element(
        'nav', {className: 'page-controls', 'aria-label': 'Product pages'});
    main.append(filterForm, productRegion, pageControls);

    let page = 0;
    let currentRequest = 0;
    const loadProducts = async (reset = true, initialResults = null) => {
      if (reset) page = 0;
      const request = ++currentRequest;
      productRegion.setAttribute('aria-busy', 'true');
      productRegion.replaceChildren(
          element('p', {role: 'status'}, 'Loading products…'));
      const params = new URLSearchParams(
          {size: '50', page: String(page), sort: sort.value});
      if (search.value.trim()) params.set('q', search.value.trim());
      if (status.value) params.set('status', status.value);
      if (type.value) params.set('type', type.value);
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      history.replaceState({}, '', nextUrl);
      try {
        const results = initialResults || await apiJson(
            `/api/spaces/${encodeURIComponent(spaceId)}/products?${params}`);
        if (request !== currentRequest) return;
        productRegion.removeAttribute('aria-busy');
        productRegion.replaceChildren();
        productRegion.append(element(
            'p',
            {role: 'status', className: 'sr-only'},
            `${results.totalItems} product${results.totalItems === 1 ? '' : 's'} found.`));
        if (!results.items.length) {
          productRegion.append(element(
              'p', {className: 'empty-note'},
              search.value || status.value ?
                  'No products match these filters.' :
                  'This Space has no products yet.'));
        } else {
          const list = element('div', {className: 'line-list'});
          for (const product of results.items) {
            const row = link(
                '',
                `/spaces/${encodeURIComponent(spaceId)}/products/${
                    encodeURIComponent(product.id)}`,
                'line-item product-row');
            const summary = element('span');
            summary.append(
                element(
                    'strong', {}, `${product.brand} ${product.productType}`),
                element(
                    'small', {},
                    `${product.modelName || 'No model'} · expires ${
                        formatDate(product.expiresOn)}`));
            row.append(summary, statusBadge(
                product.status.replaceAll('_', ' '),
                String(product.status).toLowerCase().replaceAll('_', '-')));
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
            `Page ${results.page + 1} of ${
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
        if (request === currentRequest) {
          productRegion.removeAttribute('aria-busy');
          productRegion.replaceChildren(
              errorBox(error, () => loadProducts(false)));
        }
      }
    };
    let filterTimer;
    search.addEventListener('input', () => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => loadProducts(), 250);
    });
    status.addEventListener('change', () => loadProducts());
    sort.addEventListener('change', () => loadProducts());
    type.addEventListener('change', () => loadProducts());
    filterForm.addEventListener('submit', (event) => {
      event.preventDefault();
      loadProducts();
    });
    await loadProducts(true, initialProducts);
  } catch (error) {
    main.removeAttribute('aria-busy');
    main.replaceChildren(errorBox(error, () => renderSpace(runtime, spaceId)));
  }
}

function openSpaceEditor(space, runtime) {
  const titleId = `space-edit-title-${crypto.randomUUID()}`;
  const dialog = element(
      'dialog', {className: 'app-dialog', 'aria-labelledby': titleId});
  const form = element('form', {className: 'form-column'});
  form.append(element('h2', {id: titleId}, 'Space settings'));
  const name = addField(form, 'Name', 'name', 'text', {
    maxlength: '80',
    required: '',
    placeholder: 'e.g. Home'
  });
  name.value = space.name;
  const description =
      addTextarea(form, 'Description', 'description', {
        maxlength: '255',
        placeholder: 'Add a short description'
      });
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
      if (!await confirmDialog({
        title: `Delete ${space.name}?`,
        body: `The Space, ${space.productCount} products, and their stored images will be removed. This cannot be undone.`,
        confirmLabel: 'Delete Space',
        danger: true
      })) return;
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
          description: String(values.get('description')).trim()
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
