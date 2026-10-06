import {apiJson} from '../api.js';
import {
  element,
  link,
  addField,
  addPasswordToggle,
  showFieldErrors,
  safeNext,
  showMessage
} from '../ui.js';

export function renderAuth(registration, runtime) {
  runtime.setPageTitle(registration ? 'Create account' : 'Sign in');
  const main = element('main', {className: 'page-content'});
  const layout = element('div', {className: 'auth-layout'});
  const statement = element('section', {className: 'auth-statement'});
  statement.append(
      element(
          'p', {className: 'eyebrow'},
          registration ? 'A place for every purchase' :
                         'Your records, ready when you are'),
      element(
          'h1', {},
          registration ? 'Keep the details that matter.' :
                         'Your warranties, kept close.'),
      element(
          'p', {},
          registration ?
              'Bring bills and coverage dates together in one private place.' :
              'Sign in to find the receipts and coverage dates you have saved.'));
  const form = element('form', {className: 'form-column', novalidate: ''});
  form.append(
      element('h2', {}, registration ? 'Create your vault' : 'Sign in'));
  const errorRegion = element('div', {
    id: 'auth-errors', 'aria-live': 'assertive', 'aria-atomic': 'true'
  });
  if (registration) {
    addField(
        form, 'Your name', 'name', 'text',
        {
          autocomplete: 'name',
          autofocus: '',
          minlength: '2',
          maxlength: '120',
          placeholder: 'Your name'
        });
  }
  addField(form, 'Email address', 'email', 'email', {
    autocomplete: 'email',
    autofocus: registration ? undefined : '',
    placeholder: 'you@example.com'
  });
  const passwordInput = addField(form, 'Password', 'password', 'password', {
    autocomplete: registration ? 'new-password' : 'current-password',
    minlength: registration ? '8' : undefined,
    maxlength: '72',
    placeholder: registration ? 'At least 8 characters' : 'Enter your password'
  });
  addPasswordToggle(passwordInput);
  if (registration)
    addPasswordToggle(addField(
        form, 'Confirm password', 'confirmPassword', 'password',
        {autocomplete: 'new-password', placeholder: 'Re-enter your password'}));
  if (registration) {
    form.append(element(
        'p', {className: 'muted password-guidance'},
        'Use at least 8 characters. A longer, unique passphrase is easier to remember and harder to guess. Avoid common passwords.'));
  }
  form.append(
      errorRegion,
      element(
          'button',
          {className: 'button button-primary form-submit', type: 'submit'},
          registration ? 'Create account' : 'Sign in'));
  form.append(element(
      'p', {className: 'form-switch'},
      registration ? 'Already have an account? ' : 'New to WarrantyVault? '));
  form.lastChild.append(link(
      registration ? 'Sign in' : 'Create an account',
      registration ? '/login' : '/register'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorRegion.replaceChildren();
    for (const input of form.querySelectorAll('[aria-invalid="true"]'))
      input.removeAttribute('aria-invalid');
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const password = String(values.get('password'));
    if (registration && new TextEncoder().encode(password).length > 72) {
      showMessage(errorRegion, 'Password must be no more than 72 UTF-8 bytes.');
      passwordInput.focus();
      return;
    }
    if (registration && password !== values.get('confirmPassword')) {
      showMessage(errorRegion, 'Passwords do not match.');
      form.elements.confirmPassword.focus();
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Please wait…';
    try {
      const nextSession = registration ?
          await apiJson('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              name: String(values.get('name')).trim(),
              email: String(values.get('email')).trim(),
              password,
              timezone:
                  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            })
          }) :
          await apiJson('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(
                {email: String(values.get('email')).trim(), password})
          });
      runtime.acceptSession(nextSession);
      const next = new URLSearchParams(window.location.search).get('next');
      runtime.navigate(safeNext(next), true);
    } catch (error) {
      const firstInvalid = showFieldErrors(form, error.fieldErrors, {
        name: 'Name',
        email: 'Email address',
        password: 'Password'
      });
      errorRegion.replaceChildren(element(
          'p', {className: 'form-error-summary-title'}, 'We could not sign you in.'));
      const summary = element('ul', {className: 'field-error-list'});
      if (error.fieldErrors && typeof error.fieldErrors === 'object') {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const input = form.elements.namedItem(field);
          const text = (Array.isArray(messages) ? messages : [messages])
              .map((message) => typeof message === 'string' ? message : message?.message)
              .filter(Boolean).join(' ');
          if (input && text) {
            const item = element('li');
            const anchor = element('a', {href: `#${input.id}`}, text);
            item.append(anchor);
            summary.append(item);
          }
        }
      }
      if (!summary.childElementCount)
        summary.append(element('li', {}, error.message));
      errorRegion.append(summary);
      (firstInvalid || form.querySelector('input')).focus();
    } finally {
      submit.disabled = false;
      submit.textContent = registration ? 'Create account' : 'Sign in';
    }
  });
  layout.append(statement, form);
  main.append(layout);
  runtime.renderShell(main);
}
