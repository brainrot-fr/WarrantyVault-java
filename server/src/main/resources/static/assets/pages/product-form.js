import {apiJson} from '../api.js';
import {
  element,
  link,
  addField,
  addSelect,
  addTextarea,
  showMessage,
  showFieldErrors,
  errorBox
} from '../ui.js';

export function renderProductForm(runtime, spaceId, productId) {
  runtime.setPageTitle(productId ? 'Edit product' : 'Add product');
  const main = element('main', {className: 'page-content', 'aria-busy': 'true'});
  main.append(element(
      'p', {role: 'status'},
      productId ? 'Loading product…' : 'Loading Space…'));
  runtime.renderShell(main, true);
  const spaceRequest = spaceId ?
      apiJson(`/api/spaces/${encodeURIComponent(spaceId)}`) :
      apiJson('/api/spaces');
  Promise
      .all([
        spaceRequest,
        productId ? apiJson(`/api/products/${encodeURIComponent(productId)}`) :
                    Promise.resolve(null),
        apiJson('/api/products/facets')
      ])
      .then(([space, product, facets]) => {
        if (!spaceId) {
          const available = (space || []).filter(
              (candidate) => candidate.permissions?.canCreateProducts);
          if (!available.length) {
            main.removeAttribute('aria-busy');
            main.replaceChildren(
                element('div', {className: 'empty-state'}, [
                  element('h1', {}, 'Create a Space first'),
                  element('p', {}, 'You need a Space before you can save a product.'),
                  link('Create a Space', '/spaces', 'button button-primary')
                ]));
            return;
          }
          if (available.length === 1) {
            return renderProductForm(runtime, available[0].id, productId);
          }
          main.removeAttribute('aria-busy');
          main.replaceChildren(
              element('div', {className: 'page-heading'}, [
                element('p', {className: 'eyebrow'}, 'New record'),
                element('h1', {}, 'Add product'),
                element('p', {className: 'section-intro'}, 'Choose where to keep this product.')
              ]));
          const picker = element('form', {className: 'form-column'});
          const select = addSelect(
              picker, 'Space', 'spaceId',
              available.map((candidate) => [candidate.id, candidate.name]),
              localStorage.getItem('warrantyvault:last-space') || available[0].id);
          picker.append(element(
              'button', {type: 'submit', className: 'button button-primary'},
              'Continue'));
          picker.addEventListener('submit', (event) => {
            event.preventDefault();
            localStorage.setItem('warrantyvault:last-space', select.value);
            renderProductForm(runtime, select.value, null);
          });
          main.append(picker);
          return;
        }
        if (!product && !space.permissions?.canCreateProducts)
          throw new Error(
              'You do not have permission to add products to this Space.');
        if (productId && !product.permissions?.canEdit)
          throw new Error('You do not have permission to edit this product.');
        runtime.setPageTitle(productId ? 'Edit product' : 'Add product');
        main.removeAttribute('aria-busy');
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
        localStorage.setItem('warrantyvault:last-space', spaceId);
      })
      .catch(
          (error) => {
            main.removeAttribute('aria-busy');
            main.replaceChildren(
                errorBox(error, () => renderProductForm(runtime, spaceId, productId)));
          });
}

function buildProductForm(runtime, spaceId, product, facets) {
  const form = element('form', {className: 'product-form'});
  const draftKey = `warrantyvault:product-draft:${spaceId || 'new'}`;
  const feedback = element('div', {'aria-live': 'polite'});
  const details = element('fieldset', {className: 'form-section'});
  details.append(element('legend', {}, 'Product details'));
  const productType = addField(
      details, 'Product type', 'productType', 'text',
      {
        maxlength: '60',
        required: '',
        list: 'product-types',
        placeholder: 'e.g. Refrigerator'
      });
  const typeList = element('datalist', {id: 'product-types'});
  for (const type of facets.types || [])
    typeList.append(element('option', {value: type}));
  productType.after(typeList);
  const brand = addField(
      details, 'Brand', 'brand', 'text',
      {
        maxlength: '60',
        required: '',
        list: 'product-brands',
        placeholder: 'e.g. Acme'
      });
  const brandList = element('datalist', {id: 'product-brands'});
  for (const value of facets.brands || [])
    brandList.append(element('option', {value}));
  brand.after(brandList);
  const model = addField(
      details, 'Model', 'modelName', 'text',
      {maxlength: '120', required: false, placeholder: 'e.g. XR-200'});
  const serial = addField(
      details, 'Serial number', 'serialNumber', 'text',
      {maxlength: '120', required: false, placeholder: 'Enter the serial number'});
  form.append(details);
  const coverage = element('fieldset', {className: 'form-section'});
  coverage.append(element('legend', {}, 'Purchase and coverage'));
  const purchased = addField(
      coverage, 'Purchased on', 'purchasedOn', 'date',
      {
        required: '',
        max: todayInTimezone(runtime.session?.timezone || 'UTC')
      });
  const months = addField(
      coverage, 'Warranty period (months)', 'warrantyMonths', 'number',
      {
        min: '1',
        max: '120',
        required: '',
        placeholder: 'e.g. 24',
        hint: 'From 1 to 120 months.'
      });
  const monthChips = element('div', {className: 'chip-group', 'aria-label': 'Common warranty periods'});
  for (const value of [6, 12, 24, 36, 60]) {
    const chip = element('button', {type: 'button', className: 'chip'}, `${value} months`);
    chip.addEventListener('click', () => {
      months.value = value;
      months.dispatchEvent(new Event('input', {bubbles: true}));
      updateCoverage();
    });
    monthChips.append(chip);
  }
  months.closest('.field').append(monthChips);
  const price = addField(
      coverage, 'Purchase price', 'purchasePrice', 'number',
      {
        min: '0',
        step: '0.01',
        required: '',
        placeholder: 'e.g. 499.00',
        hint: 'Enter the amount paid.'
      });
  addSelect(
      coverage, 'Currency', 'currency',
      [
        ...new Set([
          'INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', product?.currency
        ].filter(Boolean))
      ].map((currency) => [currency, currency]),
      product?.currency || runtime.session?.currency || 'INR');
  form.append(coverage);
  const notesField = element('fieldset', {className: 'form-section'});
  notesField.append(element('legend', {}, 'Notes'));
  addTextarea(notesField, 'Notes', 'notes', {
    maxlength: '1000',
    placeholder: 'Add useful details about this product'
  });
  form.append(notesField);
  const documents = element('fieldset', {className: 'form-section'});
  documents.append(element('legend', {}, 'Documents'));
  const bill = addField(
      documents,
      productIdExists(product) ? 'Replace purchase bill (optional)' :
                                 'Purchase bill (required)',
      'bill', 'file',
      {
        accept: 'image/jpeg,image/png,image/webp',
        required: !product,
        hint: 'JPEG, PNG, or WebP. Maximum 10 MB.'
      });
  const card = addField(
      documents, 'Warranty card (optional)', 'warrantyCard', 'file',
      {
        accept: 'image/jpeg,image/png,image/webp',
        required: false,
        hint: 'Optional. JPEG, PNG, or WebP. Maximum 10 MB.'
      });
  form.append(documents);
  let removeCard;
  if (product?.hasWarrantyCard) {
    const wrapper = element('label', {className: 'checkbox-field'});
    removeCard =
        element('input', {type: 'checkbox', name: 'removeWarrantyCard'});
    wrapper.append(removeCard, ' Remove current warranty card');
    documents.append(wrapper);
    removeCard.addEventListener('change', () => {
      card.disabled = removeCard.checked;
    });
  }
  form.insertBefore(documents, form.firstChild);
  card.addEventListener('change', () => {
    if (card.files.length && removeCard) removeCard.checked = false;
    if (removeCard) {
      removeCard.disabled = card.files.length > 0;
      card.disabled = removeCard.checked;
    }
  });
  const billError = element('p', {className: 'field-error', hidden: true});
  billError.id = 'field-bill-size-error';
  bill.after(billError);
  const cardError = element('p', {className: 'field-error', hidden: true});
  cardError.id = 'field-warrantyCard-size-error';
  card.after(cardError);
  addFilePreview(runtime, bill, 'Selected purchase bill preview');
  addFilePreview(runtime, card, 'Selected warranty card preview');
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
  if (!product) {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      for (const name of ['productType', 'brand', 'modelName', 'serialNumber',
                          'purchasedOn', 'warrantyMonths', 'purchasePrice',
                          'currency', 'notes']) {
        if (draft?.[name] != null && form.elements[name])
          form.elements[name].value = draft[name];
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
  }
  if (!purchased.value) purchased.value = todayInTimezone(runtime.session?.timezone || 'UTC');
  const coverageHint = element('p', {className: 'muted', 'aria-live': 'polite'});
  months.closest('.field').append(coverageHint);
  function updateCoverage() {
    if (!purchased.value || !months.value) {
      coverageHint.textContent = '';
      return;
    }
    const date = new Date(`${purchased.value}T00:00:00`);
    date.setMonth(date.getMonth() + Number(months.value));
    coverageHint.textContent = `Covered until ${new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium'
    }).format(date)}`;
  }
  purchased.addEventListener('input', updateCoverage);
  months.addEventListener('input', updateCoverage);
  updateCoverage();
  form.append(element(
      'p', {className: 'document-privacy-hint'},
      'Uploaded documents are private to this Space and available only to its members.'));
  const saveActions = element('div', {className: 'form-actions'});
  saveActions.append(
      feedback,
      element(
          'button', {className: 'button button-primary', type: 'submit'},
          product ? 'Save product' : 'Add product'));
  if (!product) {
    const another = element(
        'button', {className: 'button button-secondary', type: 'button'},
        'Save and add another');
    another.addEventListener('click', () => {
      form.dataset.addAnother = 'true';
      form.requestSubmit();
    });
    saveActions.append(another);
  }
  form.append(saveActions);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const chosenBill = bill.files[0];
    const chosenCard = card.files[0];
    billError.hidden = true;
    cardError.hidden = true;
    for (const [file, input, error] of [
             [chosenBill, bill, billError], [chosenCard, card, cardError]]) {
      if (file && file.size > 10 * 1024 * 1024) {
        error.textContent = 'This image is larger than 10 MB. Choose a smaller one.';
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        describedBy.add(error.id);
        input.setAttribute('aria-describedby', [...describedBy].join(' '));
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
    }
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
    if (product) payloadData.version = product.version;
    const payload = new FormData();
    payload.append(
        'data',
        new Blob([JSON.stringify(payloadData)], {type: 'application/json'}));
    if (chosenBill) payload.append('bill', chosenBill);
    if (chosenCard) payload.append('warrantyCard', chosenCard);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = product ? 'Saving product…' : 'Adding product…';
    try {
      const saved = await apiJson(
          product ? `/api/products/${encodeURIComponent(product.id)}` :
                    `/api/spaces/${encodeURIComponent(spaceId)}/products`,
          {method: product ? 'PUT' : 'POST', body: payload, timeoutMs: 120000});
      runtime.setUnsavedChanges(false);
      if (!product) localStorage.removeItem(draftKey);
      if (!product && form.dataset.addAnother === 'true') {
        const savedType = payloadData.productType;
        const savedCurrency = payloadData.currency;
        form.reset();
        purchased.value = todayInTimezone(runtime.session?.timezone || 'UTC');
        productType.value = savedType;
        form.elements.currency.value = savedCurrency;
        form.dataset.addAnother = '';
        updateCoverage();
        window.scrollTo(0, 0);
        showMessage(feedback, 'Product saved. Add another product.', 'status');
        submit.disabled = false;
        submit.textContent = 'Add product';
        return;
      }
      runtime.navigate(
          `/spaces/${encodeURIComponent(spaceId)}/products/${
              encodeURIComponent(saved.id)}`,
          true);
    } catch (error) {
      showMessage(feedback, error.message);
      if (error.code === 'CONCURRENT_UPDATE') {
        const reload = element(
            'button', {type: 'button', className: 'button button-quiet'},
            'Reload current product');
        reload.addEventListener('click', () => {
          runtime.setUnsavedChanges(false);
          runtime.navigate(
              `/spaces/${encodeURIComponent(spaceId)}/products/${
                  encodeURIComponent(product.id)}/edit`,
              true);
        });
        feedback.append(reload);
      }
      showFieldErrors(form, error.fieldErrors, {
        productType: 'Product type',
        brand: 'Brand',
        purchasedOn: 'Purchased on',
        warrantyMonths: 'Warranty period',
        purchasePrice: 'Purchase price',
        currency: 'Currency',
        bill: 'Purchase bill',
        warrantyCard: 'Warranty card'
      });
      submit.disabled = false;
      submit.textContent = product ? 'Save product' : 'Add product';
    }
  });
  form.addEventListener('input', () => runtime.setUnsavedChanges(true));
  form.addEventListener('change', () => runtime.setUnsavedChanges(true));
  form.addEventListener('input', () => {
    if (product) return;
    const draft = {};
    for (const name of ['productType', 'brand', 'modelName', 'serialNumber',
                        'purchasedOn', 'warrantyMonths', 'purchasePrice',
                        'currency', 'notes'])
      draft[name] = form.elements[name]?.value || '';
    localStorage.setItem(draftKey, JSON.stringify(draft));
  });
  return form;
}

function addFilePreview(runtime, input, label) {
  const preview = element('figure', {className: 'selected-image-preview', hidden: true});
  const caption = element('figcaption', {}, label);
  preview.append(caption);
  input.after(preview);
  let currentUrl = null;
  input.addEventListener('change', () => {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
    const file = input.files?.[0];
    if (!file) {
      preview.hidden = true;
      preview.replaceChildren(caption);
      clearSizeError(input);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      preview.hidden = false;
      const errorId = `${input.id}-size-error`;
      const describedBy =
          new Set((input.getAttribute('aria-describedby') || '')
                      .split(/\s+/).filter(Boolean));
      describedBy.add(errorId);
      input.setAttribute('aria-describedby', [...describedBy].join(' '));
      input.setAttribute('aria-invalid', 'true');
      preview.replaceChildren(
          caption,
          element(
              'p', {className: 'field-error', id: errorId, role: 'alert'},
              'This image is larger than 10 MB. Choose a smaller one.'));
      return;
    }
    clearSizeError(input);
    currentUrl = URL.createObjectURL(file);
    runtime.trackImageUrl(currentUrl);
    preview.hidden = false;
    preview.replaceChildren(
        caption,
        element('img', {src: currentUrl, alt: `Preview of ${file.name}`}));
  });
}

function clearSizeError(input) {
  const errorId = `${input.id}-size-error`;
  input.removeAttribute('aria-invalid');
  const describedBy = (input.getAttribute('aria-describedby') || '')
                          .split(/\s+/)
                          .filter((id) => id && id !== errorId);
  if (describedBy.length)
    input.setAttribute('aria-describedby', describedBy.join(' '));
  else
    input.removeAttribute('aria-describedby');
}

function todayInTimezone(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({type, value}) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function productIdExists(product) {
  return Boolean(product?.id);
}
