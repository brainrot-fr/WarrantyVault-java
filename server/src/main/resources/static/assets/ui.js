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

export function showMessage(container, message, role = 'alert') {
  container.replaceChildren(element(
      'p', {role, className: role === 'alert' ? 'form-error' : 'notice'},
      message));
}
export function addField(form, labelText, name, type, attributes = {}) {
  const {required = true, ...inputAttributes} = attributes;
  const wrapper = element('div', {className: 'field'});
  const id = `field-${name}`;
  wrapper.append(element('label', {for: id}, labelText));
  const input = element('input', {id, name, type, ...inputAttributes});
  if (required !== false) input.required = true;
  wrapper.append(input);
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
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ?
      value :
      new Intl.DateTimeFormat(undefined, {dateStyle: 'medium'}).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ?
      value :
      new Intl
          .DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'})
          .format(date);
}

export function addSelect(form, labelText, name, choices, selected) {
  const wrapper = element('div', {className: 'field'});
  const id = `field-${name}`;
  wrapper.append(element('label', {for: id}, labelText));
  const select = element('select', {id, name, required: ''});
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
  const wrapper = element('div', {className: 'field'});
  const id = `field-${name}`;
  wrapper.append(element('label', {for: id}, labelText));
  const input = element('textarea', {id, name, ...attributes});
  wrapper.append(input);
  form.append(wrapper);
  return input;
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
