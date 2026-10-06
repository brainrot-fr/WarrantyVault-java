import {apiJson, apiRequest} from '../api.js';
import {
  element,
  link,
  formatDate,
  describeExpiry,
  errorBox,
  confirmDialog,
  statusBadge
} from '../ui.js';

export async function renderProduct(runtime, spaceId, productId) {
  const main = element('main', {className: 'page-content', 'aria-busy': 'true'});
  main.append(element('p', {role: 'status'}, 'Loading product…'));
  runtime.renderShell(main, true);
  try {
    const product =
        await apiJson(`/api/products/${encodeURIComponent(productId)}`);
    runtime.setPageTitle(`${product.brand} ${product.productType}`);
    main.removeAttribute('aria-busy');
    main.replaceChildren();
    const title = `${product.brand} ${product.productType}`;
    const heading = element('div', {className: 'page-heading'});
    heading.append(
        element('p', {className: 'eyebrow'}, product.spaceName),
        element('h1', {}, title));
    const actions = element('div', {className: 'toolbar-actions'});
    actions.append(link(
        'Back to Space', `/spaces/${encodeURIComponent(product.spaceId)}`,
        'button button-quiet'));
    if (product.permissions?.canEdit)
      actions.append(link(
          'Edit product',
          `/spaces/${encodeURIComponent(product.spaceId)}/products/${
              encodeURIComponent(productId)}/edit`,
          'button button-quiet'));
    if (product.permissions?.canDelete) {
      const remove = element(
          'button',
          {type: 'button', className: 'button button-quiet remove-link'},
          'Delete product');
      remove.addEventListener('click', async () => {
        if (!await confirmDialog({
          title: `Delete ${title}?`,
          body: 'The details and both images will be removed. This cannot be undone.',
          confirmLabel: 'Delete product',
          danger: true
        })) return;
        remove.disabled = true;
        try {
          await apiJson(
              `/api/products/${encodeURIComponent(productId)}`,
              {method: 'DELETE'});
          runtime.navigate(`/spaces/${encodeURIComponent(product.spaceId)}`, true);
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
    const billFigure =
        renderPrivateImage(runtime, product.id, 'bill', `Purchase bill for ${title}`);
    const cardFigure = product.hasWarrantyCard ?
        renderPrivateImage(
            runtime, product.id, 'warranty-card', `Warranty card for ${title}`) :
        null;
    documents.append(billFigure);
    if (cardFigure)
      documents.append(cardFigure);
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
             ['Model', product.modelName || 'Not provided'],
             ['Serial number', product.serialNumber || 'Not provided'],
             ['Added by', product.createdBy?.name || 'Not provided']]) {
      facts.append(element('dt', {}, label), element('dd', {}, value));
    }
    const detail = element('section', {className: 'product-facts'});
    detail.prepend(statusBadge(
        product.status.replaceAll('_', ' '),
        String(product.status).toLowerCase().replaceAll('_', '-')));
    const progress = element('section', {
      className: 'coverage-progress',
      'aria-label': 'Warranty coverage timeline'
    });
    const progressLabel = element(
        'p', {className: 'coverage-description'},
        describeExpiry(product.daysRemaining, product.expiresOn));
    const progressBar = element('progress', {
      max: '1',
      value: String(Math.max(0, Math.min(1, product.warrantyElapsedFraction))),
      'aria-label': 'Warranty period elapsed'
    });
    progress.append(progressLabel, progressBar);
    detail.append(progress);
    detail.append(facts);
    if (product.notes)
      detail.append(
          element('h2', {}, 'Notes'), element('p', {}, product.notes));
    layout.append(documents, detail);
    main.append(layout);
  } catch (error) {
    main.removeAttribute('aria-busy');
    main.replaceChildren(
        errorBox(error, () => renderProduct(runtime, spaceId, productId)));
  }
}

function renderPrivateImage(runtime, productId, type, label) {
  const figure = element('figure', {className: 'private-image'});
  figure.append(element('figcaption', {}, label));
  loadPrivateImage(runtime, figure, productId, type, label);
  return figure;
}

async function loadPrivateImage(runtime, figure, productId, type, label) {
  const content = element('div', {className: 'image-content', 'aria-busy': 'true'});
  content.append(element('p', {role: 'status'}, 'Loading private document…'));
  figure.replaceChildren(figure.querySelector('figcaption'), content);
  try {
    const response = await apiRequest(
        `/api/products/${encodeURIComponent(productId)}/images/${type}`);
    const blob = await response.blob();
    if (!figure.isConnected) return;
    const url = URL.createObjectURL(blob);
    runtime.trackImageUrl(url);
    const image = element('img', {src: url, alt: label});
    const fullSize = element(
        'a', {href: url, className: 'text-button', target: '_blank', rel: 'noopener'},
        'Open full size');
    content.replaceChildren(image, fullSize);
    content.removeAttribute('aria-busy');
  } catch (error) {
    const retry = element(
        'button', {type: 'button', className: 'button button-quiet'},
        'Retry loading document');
    retry.addEventListener('click', () => {
      retry.disabled = true;
      loadPrivateImage(runtime, figure, productId, type, label);
    });
    content.removeAttribute('aria-busy');
    content.replaceChildren(
        element(
            'p', {role: 'alert', className: 'form-error'},
            `Document unavailable: ${error.message}`),
        retry);
  }
}
