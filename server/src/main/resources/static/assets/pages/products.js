import {apiJson, apiRequest} from '../api.js';
import {el, link} from '../core/dom.js';
import {formatDate, formatMoney, expiryText} from '../core/format.js';
import {icon, productIcon} from '../core/icons.js';
import {button, confirmDialog, emptyState, ring, skeleton, statusBadge} from '../components/index.js';

export async function renderProduct(runtime, spaceId, productId) {
  const main = el('main', {className: 'page-content'});
  runtime.renderShell(main, true);
  main.append(el('div', {className: 'skeleton skeleton-card'}));
  try {
    const product = await apiJson(`/api/products/${encodeURIComponent(productId)}`);
    runtime.setPageTitle(`${product.brand} ${product.productType}`);
    const title = `${product.brand || ''} ${product.productType || 'Product'}`.trim();
    const actions = [];
    if (product.permissions?.canEdit) actions.push(link('Edit', `/spaces/${encodeURIComponent(product.spaceId)}/products/${encodeURIComponent(product.id)}/edit`, 'btn btn-primary'));
    if (product.permissions?.canDelete) actions.push(button({label: 'Delete', variant: 'danger', iconName: 'trash', onClick: async () => {
      if (!await confirmDialog({title: `Delete ${title}?`, body: 'This removes the product and its private documents.', confirmLabel: 'Delete product', danger: true})) return;
      await apiJson(`/api/products/${encodeURIComponent(product.id)}`, {method: 'DELETE'});
      runtime.navigate(`/spaces/${encodeURIComponent(product.spaceId)}`, true);
    }}));
    const hero = el('section', {className: 'product-hero'},
        el('div', {className: 'product-hero-icon'}, icon(productIcon(product.productType), {size: 42})),
        el('div', {className: 'product-hero-copy'}, el('p', {className: 'eyebrow'}, product.spaceName), el('h1', {}, title), el('p', {}, [product.modelName, product.serialNumber].filter(Boolean).join(' · ') || 'No model or serial number provided'), statusBadge(product.status)),
        el('div', {className: 'toolbar-actions'}, ...actions));
    const coverage = el('section', {className: 'coverage-panel'}, ring(product.daysRemaining > 0 ? Math.min(1, product.daysRemaining / 365) : 0, expiryText(product.daysRemaining, product.expiresOn)), el('div', {}, el('p', {className: 'eyebrow'}, 'Coverage'), el('h2', {}, expiryText(product.daysRemaining, product.expiresOn)), el('p', {}, `Covered until ${formatDate(product.expiresOn)}`), el('div', {className: 'coverage-line'}, el('span', {}))));
    const facts = el('dl', {className: 'fact-grid'});
    for (const [label, value] of [['Purchased', formatDate(product.purchasedOn)], ['Warranty', `${product.warrantyMonths} months`], ['Expires', formatDate(product.expiresOn)], ['Price', formatMoney(product.currency, product.purchasePrice)], ['Added by', product.createdBy?.name || 'Not set']]) facts.append(el('dt', {}, label), el('dd', {}, value));
    const documents = el('section', {className: 'documents-panel'}, el('div', {className: 'section-title-row'}, el('div', {}, el('p', {className: 'eyebrow'}, 'Private documents'), el('h2', {}, 'Your paperwork')), el('span', {className: 'muted'}, 'Members only')));
    const bill = documentCard(runtime, product.id, 'bill', `Purchase bill for ${title}`);
    documents.append(bill);
    if (product.hasWarrantyCard) documents.append(documentCard(runtime, product.id, 'warranty-card', `Warranty card for ${title}`));
    const notes = product.notes ? el('section', {className: 'notes-panel'}, el('p', {className: 'eyebrow'}, 'Notes'), el('p', {}, product.notes)) : null;
    main.replaceChildren(hero, coverage, el('section', {className: 'facts-panel'}, el('p', {className: 'eyebrow'}, 'Key facts'), facts), documents, notes);
  } catch (error) {
    main.replaceChildren(emptyState('Product unavailable', error.message, button({label: 'Try again', variant: 'secondary', onClick: () => renderProduct(runtime, spaceId, productId)})));
  }
}

function documentCard(runtime, id, type, label) {
  const figure = el('figure', {className: 'document-card'}, el('figcaption', {}, type === 'bill' ? 'Purchase bill' : 'Warranty card'), el('div', {className: 'document-image'}, skeleton('card')));
  loadImage(runtime, figure, id, type, label);
  return figure;
}
async function loadImage(runtime, figure, id, type, label) {
  try {
    const response = await apiRequest(`/api/products/${encodeURIComponent(id)}/images/${type}`);
    const url = URL.createObjectURL(await response.blob());
    runtime.trackImageUrl(url);
    figure.querySelector('.document-image').replaceChildren(el('img', {src: url, alt: label, width: 640, height: 480}), el('a', {href: url, target: '_blank', rel: 'noopener', className: 'inline-link'}, 'Open full size'));
  } catch (error) {
    figure.querySelector('.document-image').replaceChildren(el('p', {className: 'form-error'}, `Document unavailable: ${error.message}`));
  }
}
