const focusTimers = new WeakMap();

export function mapServerFieldErrors(fieldErrors, setError) {
  if (!fieldErrors || typeof fieldErrors !== 'object') return [];
  const fields = [];
  for (const [name, message] of Object.entries(fieldErrors)) {
    if (typeof message !== 'string' || !message.trim()) continue;
    setError(name, { type: 'server', message });
    fields.push(name);
  }
  return fields;
}

export function focusFirstErrorAfterRender(errors, formElement) {
  const firstField = Object.keys(errors || {})[0];
  if (firstField) return focusFieldAfterRender(firstField, formElement);
  return () => {};
}

export function focusFieldAfterRender(name, formElement, delay = 300) {
  if (!formElement || !name) return () => {};
  const previous = focusTimers.get(formElement);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    const control = [...formElement.querySelectorAll('[name]')].find((element) => element.name === name);
    control?.focus();
    focusTimers.delete(formElement);
  }, delay);
  focusTimers.set(formElement, timer);
  return () => {
    clearTimeout(timer);
    if (focusTimers.get(formElement) === timer) focusTimers.delete(formElement);
  };
}
