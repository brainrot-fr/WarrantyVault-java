import {apiJson, apiRequest} from '../api.js';
import {element, link, formatDate, errorBox} from '../ui.js';

export async function renderProduct(runtime, spaceId, productId) {
  const main = element('main', {className: 'page-content'});
  main.append(element('p', {role: 'status'}, 'Loading product…'));
  runtime.renderShell(main, true);
  try {
    const product =
        await apiJson(`/api/products/${encodeURIComponent(productId)}`);
    main.replaceChildren();
    const title = `${product.brand} ${product.productType}`;
    const heading = element('div', {className: 'page-heading'});
    heading.append(
        element('p', {className: 'eyebrow'}, product.spaceName),
        element('h1', {}, title));
    const actions = element('div', {className: 'toolbar-actions'});
    actions.append(link(
        'Back to Space', `/spaces/${encodeURIComponent(spaceId)}`,
        'button button-quiet'));
    if (product.permissions?.canEdit)
      actions.append(link(
          'Edit product',
          `/spaces/${encodeURIComponent(spaceId)}/products/${
              encodeURIComponent(productId)}/edit`,
          'button button-quiet'));
    if (product.permissions?.canDelete) {
      const remove = element(
          'button',
          {type: 'button', className: 'button button-quiet remove-link'},
          'Delete product');
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete ${
                title}, its details, and stored images? This cannot be undone.`))
          return;
        remove.disabled = true;
        try {
          await apiJson(
              `/api/products/${encodeURIComponent(productId)}`,
              {method: 'DELETE'});
          runtime.navigate(`/spaces/${encodeURIComponent(spaceId)}`);
        } catch (error) {
          main.prepend(errorBox(error));
          remove.disabled = false;
        }
      });
      actions.append(remove);
    }
    heading.append(actions);
    main.append(heading);
    const layout = element('div', {className: 'product-reader-layout'});
    const documents = element('section', {className: 'product-documents'});
    documents.append(await renderPrivateImage(
        runtime, product.id, 'bill', `Purchase bill for ${title}`));
    if (product.hasWarrantyCard)
      documents.append(await renderPrivateImage(
          runtime, product.id, 'warranty-card', `Warranty card for ${title}`));
    else
      documents.append(
          element('p', {className: 'empty-note'}, 'No warranty card added.'));
    const facts = element('dl', {className: 'facts-list'});
    for (const [label, value] of [
             ['Status', product.status.replaceAll('_', ' ')],
             ['Purchased on', formatDate(product.purchasedOn)],
             ['Warranty period', `${product.warrantyMonths} months`],
             ['Expires on', formatDate(product.expiresOn)],
             ['Purchase price', `${product.currency} ${product.purchasePrice}`],
             ['Model', product.modelName || '—'],
             ['Serial number', product.serialNumber || '—'],
             ['Added by', product.createdBy?.name || '—']]) {
      facts.append(element('dt', {}, label), element('dd', {}, value));
    }
    const detail = element('section', {className: 'product-facts'});
    detail.append(facts);
    if (product.notes)
      detail.append(
          element('h2', {}, 'Notes'), element('p', {}, product.notes));
    layout.append(documents, detail);
    main.append(layout);
  } catch (error) {
    main.replaceChildren(
        errorBox(error, () => renderProduct(runtime, spaceId, productId)));
  }
}

async function renderPrivateImage(runtime, productId, type, label) {
  const figure = element('figure', {className: 'private-image'});
  figure.append(element('figcaption', {}, label));
  try {
    const response = await apiRequest(
        `/api/products/${encodeURIComponent(productId)}/images/${type}`);
    const url = URL.createObjectURL(await response.blob());
    const image = element('img', {src: url, alt: label});
    runtime.trackImageUrl(url);
    figure.append(image, link('Open full size', url, 'text-button'));
  } catch (error) {
    figure.append(element(
        'p', {role: 'alert', className: 'form-error'},
        `Document unavailable: ${error.message}`));
  }
  return figure;
}
