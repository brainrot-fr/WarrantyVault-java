import {apiJson} from '../api.js';
import {el} from '../core/dom.js';
import {clampMonthDate, formatDate} from '../core/format.js';
import {icon, productIcon} from '../core/icons.js';
import {storage} from '../core/storage.js';
import {button, chip, emptyState, ring} from '../components/index.js';

const commonTypes = ['Refrigerator', 'Washing machine', 'Air conditioner', 'Television', 'Microwave', 'Phone', 'Laptop', 'Camera', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);

export async function renderProductForm(runtime, spaceId, productId) {
  runtime.setPageTitle(productId ? 'Edit product' : 'Add product');
  const main = el('main', {className: 'page-content'});
  runtime.renderShell(main, true);
  main.append(el('div', {className: 'skeleton skeleton-card'}));
  try {
    const [spaceResult, product, facets] = await Promise.all([
      spaceId ? apiJson(`/api/spaces/${encodeURIComponent(spaceId)}`) : apiJson('/api/spaces'),
      productId ? apiJson(`/api/products/${encodeURIComponent(productId)}`) : null,
      apiJson('/api/products/facets')
    ]);
    const spaces = Array.isArray(spaceResult) ? spaceResult : [spaceResult];
    const space = spaces.find(item => item?.id === spaceId) || spaces.find(item => item?.permissions?.canCreateProducts);
    if (!space) {
      main.replaceChildren(emptyState('Create a Space first', 'A product needs a Space to belong to.', button({label: 'Create a Space', variant: 'primary', onClick: () => runtime.navigate('/spaces')})));
      return;
    }
    main.replaceChildren(buildFlow(runtime, space, product, facets || {}));
  } catch (error) {
    main.replaceChildren(emptyState('Product form unavailable', error.message, button({label: 'Try again', variant: 'secondary', onClick: () => renderProductForm(runtime, spaceId, productId)})));
  }
}

function buildFlow(runtime, space, product, facets) {
  const draftKey = `warrantyvault:product-draft:${space.id}`;
  let draft = {};
  try { draft = JSON.parse(storage.get(draftKey) || '{}'); } catch { draft = {}; }
  const values = {
    productType: product?.productType || draft.productType || '',
    brand: product?.brand || draft.brand || '',
    modelName: product?.modelName || draft.modelName || '',
    serialNumber: product?.serialNumber || draft.serialNumber || '',
    purchasedOn: product?.purchasedOn || draft.purchasedOn || today(),
    warrantyMonths: product?.warrantyMonths || draft.warrantyMonths || 12,
    purchasePrice: product?.purchasePrice || draft.purchasePrice || '',
    currency: product?.currency || draft.currency || 'INR',
    notes: product?.notes || draft.notes || ''
  };
  let step = product ? 3 : 0;
  let bill;
  let card;
  const panel = el('section', {className: 'flow-panel'});
  const preview = el('aside', {className: 'preview-card'});
  const back = button({label: 'Back', variant: 'quiet', onClick: () => renderStep(step - 1)});
  const next = button({label: 'Next', variant: 'primary', iconName: 'arrow', onClick: () => step === 3 ? save() : renderStep(step + 1)});
  const steps = el('nav', {className: 'flow-stepper', 'aria-label': 'Product steps'});
  ['Bill', 'Product', 'Coverage', 'Review'].forEach((label, index) => steps.append(el('button', {type: 'button', className: 'step-dot', onClick: () => index <= step && renderStep(index)}, `${index + 1}. ${label}`)));
  const footer = el('div', {className: 'flow-footer'}, back, next);
  const shell = el('div', {className: 'product-flow-shell'}, el('div', {className: 'page-heading'}, el('div', {}, el('p', {className: 'eyebrow'}, product ? 'Edit record' : 'New record'), el('h1', {}, product ? 'Edit product' : 'Add product'), el('p', {}, `Adding to ${space.name}`))), steps, el('div', {className: 'form-flow'}, panel, preview), footer);

  function input(label, name, type = 'text', options = {}) {
    const control = el('input', {name, type, value: values[name] ?? '', ...options});
    control.addEventListener('input', () => {
      values[name] = control.value;
      runtime.setUnsavedChanges(true);
      if (!product) storage.set(draftKey, JSON.stringify(values));
      updatePreview();
    });
    return el('label', {className: 'field'}, el('span', {className: 'field-label'}, label), control);
  }
  function fileDrop(kind, required) {
    const control = el('input', {type: 'file', accept: 'image/jpeg,image/png,image/webp', capture: 'environment'});
    if (required) control.required = true;
    const drop = el('label', {className: 'dropzone'}, icon(kind === 'bill' ? 'receipt' : 'shield', {size: 36}), el('strong', {}, kind === 'bill' ? 'Choose a purchase bill' : 'Add a warranty card'), el('span', {}, 'Tap to choose or take a photo'), control);
    control.addEventListener('change', () => {
      const file = control.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        drop.append(el('small', {className: 'field-error'}, 'Use a JPEG, PNG, or WebP image under 10 MB.'));
        control.value = '';
        return;
      }
      if (kind === 'bill') bill = file;
      else card = file;
      drop.classList.add('has-file');
      drop.querySelector('strong').textContent = file.name;
    });
    return drop;
  }
  function renderStep(nextStep) {
    if (nextStep < 0) return;
    step = Math.min(3, nextStep);
    steps.querySelectorAll('.step-dot').forEach((node, index) => node.classList.toggle('is-current', index === step));
    back.disabled = step === 0;
    next.querySelector('.btn-label').textContent = step === 3 ? (product ? 'Save changes' : 'Save product') : 'Next';
    panel.replaceChildren();
    if (step === 0) panel.append(el('p', {className: 'eyebrow'}, 'Step 1 of 4'), el('h2', {}, 'Keep the proof'), el('p', {}, 'JPEG, PNG, or WebP up to 10 MB.'), fileDrop('bill', !product));
    if (step === 1) {
      const choices = [...new Set([...(facets.types || []), ...commonTypes])];
      panel.append(el('p', {className: 'eyebrow'}, 'Step 2 of 4'), el('h2', {}, 'Name the product'), el('div', {className: 'type-grid'}, ...choices.map(type => chip(type, values.productType === type, () => { values.productType = type; renderStep(step); }))), input('Brand', 'brand', 'text', {required: ''}), input('Model', 'modelName'), input('Serial number', 'serialNumber'));
    }
    if (step === 2) {
      panel.append(el('p', {className: 'eyebrow'}, 'Step 3 of 4'), el('h2', {}, 'Set the cover'), input('Purchased on', 'purchasedOn', 'date', {required: '', max: today()}), el('div', {className: 'chip-row'}, ...[6, 12, 24, 36, 60].map(months => chip(`${months} months`, Number(values.warrantyMonths) === months, () => { values.warrantyMonths = months; renderStep(step); }))), input('Warranty period in months', 'warrantyMonths', 'number', {required: '', min: 1, max: 120}), input('Purchase price', 'purchasePrice', 'number', {required: '', min: 0, step: '.01'}), input('Currency', 'currency', 'text', {required: '', maxlength: 3}), el('p', {className: 'coverage-hint'}, `Covered until ${formatDate(clampMonthDate(values.purchasedOn, Number(values.warrantyMonths) || 0))}`));
    }
    if (step === 3) panel.append(el('p', {className: 'eyebrow'}, 'Step 4 of 4'), el('h2', {}, 'Ready to file'), el('div', {className: 'review-list'}, el('div', {className: 'review-row'}, 'Product', `${values.brand || 'Brand'} ${values.productType || 'Product'}`), el('div', {className: 'review-row'}, 'Coverage', `${values.warrantyMonths} months`), el('div', {className: 'review-row'}, 'Price', values.purchasePrice ? `${values.currency} ${values.purchasePrice}` : 'Not set')), fileDrop('card', false), input('Notes', 'notes'));
    updatePreview();
  }
  function updatePreview() {
    preview.replaceChildren(el('p', {className: 'eyebrow'}, 'Warranty pass'), el('div', {className: 'preview-icon'}, icon(productIcon(values.productType), {size: 30})), el('h2', {}, `${values.brand || 'Your brand'} ${values.productType || 'product'}`), el('p', {}, values.modelName || 'Add a model number'), ring(Math.min(1, Number(values.warrantyMonths || 0) / 60), 'Coverage'), el('small', {}, values.purchasedOn && values.warrantyMonths ? `Covered until ${formatDate(clampMonthDate(values.purchasedOn, Number(values.warrantyMonths)))}` : 'Set a warranty period'));
  }
  async function save() {
    if (!values.productType || !values.brand || !values.purchasedOn || !values.warrantyMonths || !values.purchasePrice || (!product && !bill)) {
      renderStep(!values.productType || !values.brand ? 1 : 2);
      return;
    }
    next.setLoading(true);
    const payloadData = {productType: values.productType.trim(), brand: values.brand.trim(), modelName: values.modelName.trim() || null, serialNumber: values.serialNumber.trim() || null, purchasedOn: values.purchasedOn, warrantyMonths: Number(values.warrantyMonths), purchasePrice: String(values.purchasePrice), currency: values.currency.trim().toUpperCase(), notes: values.notes.trim() || null};
    if (product) { payloadData.version = product.version; payloadData.removeWarrantyCard = false; }
    const body = new FormData();
    body.append('data', new Blob([JSON.stringify(payloadData)], {type: 'application/json'}));
    if (bill) body.append('bill', bill);
    if (card) body.append('warrantyCard', card);
    try {
      const saved = await apiJson(product ? `/api/products/${encodeURIComponent(product.id)}` : `/api/spaces/${encodeURIComponent(space.id)}/products`, {method: product ? 'PUT' : 'POST', body, timeoutMs: 120000});
      runtime.setUnsavedChanges(false);
      storage.remove(draftKey);
      runtime.navigate(`/spaces/${encodeURIComponent(space.id)}/products/${encodeURIComponent(saved.id)}`, true);
    } catch (error) {
      next.setLoading(false);
      panel.append(el('p', {className: 'form-error'}, error.code === 'UPLOAD_TOO_LARGE' ? 'That file is too large. Choose an image under 10 MB.' : error.code === 'STORAGE_LIMIT' ? 'This vault has reached its storage limit.' : error.message));
    }
  }
  renderStep(step);
  return shell;
}
