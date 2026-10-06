export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className')
      node.className = value;
    else if (key.startsWith('on') && typeof value === 'function')
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null)
      node.setAttribute(key, value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child instanceof Node)
      node.append(child);
    else if (child !== undefined && child !== null)
      node.append(document.createTextNode(String(child)));
  }
  return node;
}

export function link(label, href, className = '') {
  return element('a', {href, className}, label);
}

export function safeNext(value) {
  if (typeof value !== 'string') return '/dashboard';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/') &&
        !value.includes('\\') && !value.startsWith('//') ?
        url.pathname + url.search : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export function showMessage(container, message, role = 'alert') {
  container.replaceChildren(element(
      'p', {role, className: role === 'alert' ? 'form-error' : 'notice'},
      message));
}

export function statusBadge(label, status = '') {
  return element('span', {className: 'status-badge', 'data-status': status, role: 'status'}, label);
}

export function toast(message, {duration = 4000, role = 'status'} = {}) {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = element('div', {className: 'toast-region', 'aria-live': role === 'alert' ? 'assertive' : 'polite', 'aria-atomic': 'true'});
    document.body.append(region);
  }
  const item = element('div', {className: 'toast', role}, message);
  region.append(item);
  if (duration > 0) window.setTimeout(() => item.remove(), duration);
  return item;
}

export function skeleton({width = '100%', height = '1rem', className = ''} = {}) {
  const node = element(
      'div',
      {className: `skeleton ${className}`.trim(), 'aria-hidden': 'true'});
  node.style.setProperty('--skeleton-width', width);
  node.style.setProperty('--skeleton-height', height);
  return node;
}

export function emptyState(title, message = '', action = null) {
  const children = [element('h2', {}, title)];
  if (message) children.push(element('p', {}, message));
  if (action instanceof Node) children.push(action);
  return element('section', {className: 'empty-state', role: 'status'}, children);
}

export function openDialog({title, content = '', actions = [], bottomSheet = false} = {}) {
  const titleId = `dialog-title-${crypto.randomUUID()}`;
  const dialog = element('dialog', {className: `ui-dialog${bottomSheet ? ' bottom-sheet' : ''}`, 'aria-labelledby': titleId});
  dialog.append(element('h2', {id: titleId}, title));
  if (content instanceof Node) dialog.append(content);
  else if (content) dialog.append(element('p', {}, content));
  if (actions.length) dialog.append(element('div', {className: 'dialog-actions'}, actions));
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), {once: true});
  dialog.addEventListener('cancel', () => dialog.close(), {once: true});
  dialog.showModal();
  return dialog;
}

export function bottomSheet(options = {}) {
  return openDialog({...options, bottomSheet: true});
}

export function overflowMenu(label = 'More', items = []) {
  const menu = element('div', {className: 'overflow-menu'});
  const trigger = element('button', {type: 'button', className: 'button button-ghost', 'aria-expanded': 'false'}, label);
  const list = element('div', {role: 'menu', hidden: true});
  for (const item of items) {
    const action = typeof item === 'function' ? {label: 'Action', onSelect: item} : item;
    const button = element('button', {type: 'button', role: 'menuitem'}, action.label);
    button.addEventListener('click', () => { action.onSelect?.(button); list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); });
    list.append(button);
  }
  trigger.addEventListener('click', () => {
    const open = list.hidden;
    list.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) list.querySelector('[role="menuitem"]')?.focus();
  });
  menu.append(trigger, list);
  return menu;
}

export function chip(label, {removable = false, onRemove} = {}) {
  const node = element('span', {className: 'chip'}, label);
  if (removable) {
    const remove = element('button', {type: 'button', className: 'button button-ghost', 'aria-label': `Remove ${label}`}, '×');
    remove.addEventListener('click', () => { onRemove?.(label, node); node.remove(); });
    node.append(remove);
  }
  return node;
}

export function segmentedControl(options, selected, onChange) {
  const group = element('div', {className: 'segmented-control', role: 'group'});
  options.forEach((option) => {
    const value = Array.isArray(option) ? option[0] : option.value;
    const label = Array.isArray(option) ? option[1] : option.label;
    const button = element('button', {type: 'button', 'aria-pressed': String(value === selected)}, label);
    button.addEventListener('click', () => {
      group.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      onChange?.(value);
    });
    group.append(button);
  });
  return group;
}

export function setTheme(theme) {
  const value = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
  document.documentElement.dataset.theme = value;
  try { localStorage.setItem('warrantyvault-theme', value); } catch {}
  return value;
}

export function getTheme() {
  try {
    const saved = localStorage.getItem('warrantyvault-theme');
    if (saved && ['light', 'dark', 'system'].includes(saved)) return saved;
  } catch {}
  return document.documentElement.dataset.theme || 'system';
}

export function showToast(message, role = 'status') {
  let region = document.querySelector('#toast-region');
  if (!region) {
    region = element('div', {
      id: 'toast-region',
      className: 'toast-region',
      'aria-live': role === 'alert' ? 'assertive' : 'polite',
      'aria-atomic': 'true'
    });
    document.body.append(region);
  }
  const toast = element('p', {className: `toast toast-${role}`, role}, message);
  region.append(toast);
  window.setTimeout(() => toast.remove(), 4500);
}

export function confirmDialog({title, body, confirmLabel, danger = false}) {
  return new Promise((resolve) => {
    const trigger = document.activeElement;
    const titleId = `confirm-title-${crypto.randomUUID()}`;
    const dialog = element('dialog', {className: 'confirm-dialog', 'aria-labelledby': titleId});
    dialog.append(element('h2', {id: titleId}, title), element('p', {}, body));
    const actions = element('div', {className: 'dialog-actions'});
    const cancel = element('button', {type: 'button', className: 'button button-quiet'}, 'Cancel');
    const confirm = element(
        'button',
        {type: 'button', className: `button ${danger ? 'button-danger' : 'button-primary'}`},
        confirmLabel);
    actions.append(cancel, confirm);
    dialog.append(actions);
    document.body.append(dialog);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      if (trigger instanceof HTMLElement) trigger.focus();
      resolve(result);
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.showModal();
    cancel.focus();
  });
}

export function showFieldErrors(form, fieldErrors, labels = {}) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return null;
  let firstInvalid = null;
  for (const [name, rawMessages] of Object.entries(fieldErrors)) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLElement)) continue;
    const wrapper = input.closest('.field');
    if (!wrapper) continue;
    const id = `field-${name}-error`;
    let error = wrapper.querySelector(`#${CSS.escape(id)}`);
    if (!error) {
      error = element('p', {className: 'field-error', id});
      wrapper.append(error);
    }
    const messages = Array.isArray(rawMessages) ? rawMessages : [rawMessages];
    const text = messages.map((raw) => {
      const value = typeof raw === 'string' ? raw : raw?.message;
      if (typeof value !== 'string') return '';
      return value.replace(/^must not be blank$/i, 'is required')
          .replace(/^size must be between (.+) and (.+)$/i, 'must be between $1 and $2 characters');
    }).filter(Boolean).join(' ');
    error.textContent = text || 'Please check this value.';
    error.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    describedBy.add(id);
    input.setAttribute('aria-describedby', [...describedBy].join(' '));
    firstInvalid ||= input;
  }
  firstInvalid?.focus();
  return firstInvalid;
}
export function addField(form, labelText, name, type, attributes = {}) {
  const {required = true, hint, optionalTag = true, ...inputAttributes} = attributes;
  const wrapper = element('div', {className: 'field'});
  const id = `field-${name}`;
  const label = labelText.replace(/\s*\((required|optional)\)\s*$/i, '');
  const labelNode = element('label', {for: id}, label);
  if (required === false && optionalTag)
    labelNode.append(element('span', {className: 'field-optional'}, 'Optional'));
  wrapper.append(labelNode);
  const input = element('input', {id, name, type, ...inputAttributes});
  if (required !== false) input.required = true;
  if (hint) {
    const hintId = `field-${name}-hint`;
    input.setAttribute('aria-describedby', hintId);
    wrapper.append(input, element('small', {id: hintId}, hint));
  } else {
    wrapper.append(input);
  }
  form.append(wrapper);
  return input;
}

export function appendFieldErrors(container, form, fieldErrors) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return null;
  const list = element('ul', {className: 'field-error-list'});
  let firstField = null;
  for (const [name, rawMessages] of Object.entries(fieldErrors)) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLElement) {
      field.setAttribute('aria-invalid', 'true');
      firstField ||= field;
    }
    const messages = Array.isArray(rawMessages) ? rawMessages : [rawMessages];
    for (const rawMessage of messages) {
      const message =
          typeof rawMessage === 'string' ? rawMessage : rawMessage?.message;
      if (typeof message === 'string' && message.trim()) {
        list.append(element('li', {}, `${name}: ${message}`));
      }
    }
  }
  if (list.childElementCount) container.append(list);
  return firstField;
}

export function formatDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ?
      value :
      new Intl.DateTimeFormat(undefined, {dateStyle: 'medium'}).format(date);
}

export function formatDateTime(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ?
      value :
      new Intl
          .DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'})
          .format(date);
}

export function formatMoney(currency, amount) {
  try {
    return new Intl.NumberFormat(undefined, {style: 'currency', currency})
        .format(Number(amount));
  } catch {
    return `${currency} ${amount}`;
  }
}

export function describeExpiry(daysRemaining, expiresOn) {
  const date = expiresOn ? formatExpiryDate(expiresOn) : '';
  if (daysRemaining === 0) return 'Expires today';
  if (daysRemaining > 0) {
    const unit = daysRemaining === 1 ? 'day' : 'days';
    return `Expires in ${daysRemaining} ${unit}${date ? ` (${date})` : ''}`;
  }
  const elapsed = Math.abs(daysRemaining);
  const unit = elapsed === 1 ? 'day' : 'days';
  return `Expired ${elapsed} ${unit} ago${date ? ` (${date})` : ''}`;
}

function formatExpiryDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' :
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric', month: 'short', year: 'numeric'
      }).format(date);
}

export function addSelect(
    form, labelText, name, choices, selected, {required = true, optionalTag = true} = {}) {
  const wrapper = element('div', {className: 'field'});
  const id = `field-${name}`;
  const label = labelText.replace(/\s*\((required|optional)\)\s*$/i, '');
  const labelNode = element('label', {for: id}, label);
  if (!required && optionalTag) labelNode.append(element('span', {className: 'field-optional'}, 'Optional'));
  wrapper.append(labelNode);
  const select = element('select', {id, name});
  if (required) select.required = true;
  for (const [value, label] of choices) {
    const option = element('option', {value}, label);
    if (value === selected) option.selected = true;
    select.append(option);
  }
  wrapper.append(select);
  form.append(wrapper);
  return select;
}

export function addTextarea(form, labelText, name, attributes = {}) {
  const {required = false, optionalTag = true, ...textareaAttributes} = attributes;
  const wrapper = element('div', {className: 'field'});
  const id = `field-${name}`;
  const label = labelText.replace(/\s*\((required|optional)\)\s*$/i, '');
  const labelNode = element('label', {for: id}, label);
  if (!required && optionalTag) labelNode.append(element('span', {className: 'field-optional'}, 'Optional'));
  wrapper.append(labelNode);
  const input = element('textarea', {id, name, ...textareaAttributes});
  if (required) input.required = true;
  wrapper.append(input);
  form.append(wrapper);
  return input;
}

export function addPasswordToggle(input) {
  const button = element(
      'button',
      {type: 'button', className: 'password-toggle text-button'},
      'Show password');
  button.setAttribute('aria-controls', input.id);
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    const showing = input.type === 'password';
    input.type = showing ? 'text' : 'password';
    button.textContent = showing ? 'Hide password' : 'Show password';
    button.setAttribute('aria-pressed', String(showing));
  });
  input.after(button);
  return button;
}

export function errorBox(error, retry) {
  const box = element('div', {className: 'error-box'});
  box.append(element(
      'p', {role: 'alert', className: 'form-error'},
      error.message || String(error)));
  if (retry) {
    const button = element(
        'button', {className: 'button button-quiet', type: 'button'},
        'Try again');
    button.addEventListener('click', retry);
    box.append(button);
  }
  return box;
}
