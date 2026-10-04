import {apiJson} from '../api.js';
import {
  element,
  link,
  addField,
  addSelect,
  addTextarea,
  showMessage,
  appendFieldErrors,
  errorBox
} from '../ui.js';

export function renderProductForm(runtime, spaceId, productId) {
  const main = element('main', {className: 'page-content'});
  main.append(element(
      'p', {role: 'status'},
      productId ? 'Loading product…' : 'Loading Space…'));
  runtime.renderShell(main, true);
  Promise
      .all([
        apiJson(`/api/spaces/${encodeURIComponent(spaceId)}`),
        productId ? apiJson(`/api/products/${encodeURIComponent(productId)}`) :
                    Promise.resolve(null),
        apiJson('/api/products/facets').catch((error) => {
          console.error(
              'Product facets could not be loaded:', error.code || error.name);
          return {types: [], brands: []};
        })
      ])
      .then(([space, product, facets]) => {
        if (!product && !space.permissions?.canCreateProducts)
          throw new Error(
              'You do not have permission to add products to this Space.');
        if (productId && !product.permissions?.canEdit)
          throw new Error('You do not have permission to edit this product.');
        main.replaceChildren();
        const heading = element('div', {className: 'page-heading'});
        heading.append(
            element('p', {className: 'eyebrow'}, space.name),
            element('h1', {}, productId ? 'Edit product' : 'Add product'),
            link(
                'Back to Space',
                productId ? `/spaces/${encodeURIComponent(spaceId)}/products/${
                                encodeURIComponent(productId)}` :
                            `/spaces/${encodeURIComponent(spaceId)}`,
                'text-button'));
        main.append(heading);
        main.append(buildProductForm(runtime, spaceId, product, facets));
      })
      .catch(
          (error) => main.replaceChildren(
              errorBox(error, () => renderProductForm(runtime, spaceId, productId))));
}

function buildProductForm(runtime, spaceId, product, facets) {
  const form = element('form', {className: 'product-form'});
  const feedback = element('div', {'aria-live': 'polite'});
  const productType = addField(
      form, 'Product type', 'productType', 'text',
      {maxlength: '60', required: '', list: 'product-types'});
  const typeList = element('datalist', {id: 'product-types'});
  for (const type of facets.types || [])
    typeList.append(element('option', {value: type}));
  productType.after(typeList);
  const brand = addField(
      form, 'Brand', 'brand', 'text',
      {maxlength: '60', required: '', list: 'product-brands'});
  const brandList = element('datalist', {id: 'product-brands'});
  for (const value of facets.brands || [])
    brandList.append(element('option', {value}));
  brand.after(brandList);
  const model = addField(
      form, 'Model', 'modelName', 'text', {maxlength: '120', required: false});
  const serial = addField(
      form, 'Serial number', 'serialNumber', 'text',
      {maxlength: '120', required: false});
  const purchased = addField(
      form, 'Purchased on', 'purchasedOn', 'date',
      {required: '', max: new Date().toISOString().slice(0, 10)});
  const months = addField(
      form, 'Warranty period (months)', 'warrantyMonths', 'number',
      {min: '1', max: '120', required: ''});
  const price = addField(
      form, 'Purchase price', 'purchasePrice', 'number',
      {min: '0', step: '0.01', required: ''});
  addSelect(
      form, 'Currency', 'currency',
      [
        ...new Set([
          'INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', product?.currency
        ].filter(Boolean))
      ].map((currency) => [currency, currency]),
      product?.currency || runtime.session?.currency || 'INR');
  addTextarea(form, 'Notes', 'notes', {maxlength: '1000'});
  const bill = addField(
      form,
      productIdExists(product) ? 'Replace purchase bill (optional)' :
                                 'Purchase bill (required)',
      'bill', 'file',
      {accept: 'image/jpeg,image/png,image/webp', required: !product});
  const card = addField(
      form, 'Warranty card (optional)', 'warrantyCard', 'file',
      {accept: 'image/jpeg,image/png,image/webp', required: false});
  let removeCard;
  if (product?.hasWarrantyCard) {
    const wrapper = element('label', {className: 'checkbox-field'});
    removeCard =
        element('input', {type: 'checkbox', name: 'removeWarrantyCard'});
    wrapper.append(removeCard, ' Remove current warranty card');
    form.append(wrapper);
  }
  productType.value = product?.productType || '';
  brand.value = product?.brand || '';
  model.value = product?.modelName || '';
  serial.value = product?.serialNumber || '';
  purchased.value = product?.purchasedOn || '';
  months.value = product?.warrantyMonths || '';
  price.value = product?.purchasePrice || '';
  form.elements.currency.value =
      product?.currency || runtime.session?.currency || 'INR';
  form.elements.notes.value = product?.notes || '';
  form.append(element(
      'p', {className: 'document-privacy-hint'},
      'Uploaded documents are private to this Space and available only to its members.'));
  form.append(
      feedback,
      element(
          'button', {className: 'button button-primary', type: 'submit'},
          product ? 'Save product' : 'Add product'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const chosenBill = bill.files[0];
    const chosenCard = card.files[0];
    for (const [file, label] of [
             [chosenBill, 'bill'], [chosenCard, 'warranty card']]) {
      if (file &&
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showMessage(
            feedback, `Choose a JPEG, PNG, or WebP image for the ${label}.`);
        return;
      }
    }
    const values = new FormData(form);
    const payloadData = {
      productType: String(values.get('productType')).trim(),
      brand: String(values.get('brand')).trim(),
      modelName: String(values.get('modelName')).trim() || null,
      serialNumber: String(values.get('serialNumber')).trim() || null,
      purchasedOn: String(values.get('purchasedOn')),
      warrantyMonths: Number(values.get('warrantyMonths')),
      purchasePrice: String(values.get('purchasePrice')),
      currency: String(values.get('currency')),
      notes: String(values.get('notes')).trim() || null
    };
    if (product) payloadData.removeWarrantyCard = Boolean(removeCard?.checked);
    const payload = new FormData();
    payload.append(
        'data',
        new Blob([JSON.stringify(payloadData)], {type: 'application/json'}));
    if (chosenBill) payload.append('bill', chosenBill);
    if (chosenCard) payload.append('warrantyCard', chosenCard);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const saved = await apiJson(
          product ? `/api/products/${encodeURIComponent(product.id)}` :
                    `/api/spaces/${encodeURIComponent(spaceId)}/products`,
          {method: product ? 'PUT' : 'POST', body: payload});
      runtime.navigate(
          `/spaces/${encodeURIComponent(spaceId)}/products/${
              encodeURIComponent(saved.id)}`,
          true);
    } catch (error) {
      showMessage(feedback, error.message);
      appendFieldErrors(feedback, form, error.fieldErrors);
      submit.disabled = false;
    }
  });
  return form;
}

function productIdExists(product) {
  return Boolean(product?.id);
}
