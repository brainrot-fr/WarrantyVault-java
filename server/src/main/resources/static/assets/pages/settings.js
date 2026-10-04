import {apiJson} from '../api.js';
import {
  element,
  addField,
  addSelect,
  showMessage,
  appendFieldErrors,
  errorBox
} from '../ui.js';

export async function renderSettings(runtime) {
  const main = element('main', {className: 'page-content'});
  main.append(element('p', {role: 'status'}, 'Loading account settings…'));
  runtime.renderShell(main, true);
  try {
    const user = await apiJson('/api/me');
    runtime.setSession(user);
    main.replaceChildren();
    const heading = element('div', {className: 'page-heading'});
    heading.append(
        element('p', {className: 'eyebrow'}, 'WarrantyVault'),
        element('h1', {}, 'Your account'));
    main.append(heading);
    const profile = element('form', {className: 'settings-form'});
    profile.append(element('h2', {}, 'Profile'));
    profile.append(element(
        'p', {className: 'settings-row'},
        [element('span', {}, 'Email'), element('strong', {}, user.email)]));
    const name = addField(
        profile, 'Name', 'name', 'text',
        {required: '', minlength: '2', maxlength: '120'});
    name.value = user.name;
    const timezoneOptions = [...new Set([
      user.timezone || 'UTC', 'UTC', 'America/Los_Angeles', 'America/New_York',
      'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Singapore',
      'Asia/Tokyo', 'Australia/Sydney'
    ])];
    const timezone = addSelect(
        profile, 'Timezone', 'timezone',
        timezoneOptions.map((zone) => [zone, zone]), user.timezone || 'UTC');
    const currencies = [...new Set([
      user.currency || 'INR', 'INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'
    ])];
    addSelect(
        profile, 'Currency', 'currency',
        currencies.map((currency) => [currency, currency]),
        user.currency || 'INR');
    const profileFeedback = element('div', {'aria-live': 'polite'});
    profile.append(
        profileFeedback,
        element(
            'button', {type: 'submit', className: 'button button-primary'},
            'Save account details'));
    profile.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!profile.reportValidity()) return;
      const submit = profile.querySelector('[type="submit"]');
      submit.disabled = true;
      const values = new FormData(profile);
      try {
        const updated = await apiJson('/api/me', {
          method: 'PATCH',
          body: JSON.stringify({
            name: String(values.get('name')).trim(),
            timezone: timezone.value,
            currency: values.get('currency')
          })
        });
        runtime.setSession(updated);
        showMessage(profileFeedback, 'Account details saved.', 'status');
      } catch (error) {
        showMessage(profileFeedback, error.message);
        appendFieldErrors(profileFeedback, profile, error.fieldErrors);
      } finally {
        submit.disabled = false;
      }
    });
    main.append(profile);

    const password = element('form', {className: 'settings-form inline-form'});
    password.append(element('h2', {}, 'Change password'));
    addField(
        password, 'Current password', 'currentPassword', 'password',
        {required: '', autocomplete: 'current-password'});
    const newPassword =
        addField(password, 'New password', 'newPassword', 'password', {
          required: '',
          minlength: '8',
          maxlength: '72',
          autocomplete: 'new-password'
        });
    addField(password, 'Confirm new password', 'confirmPassword', 'password', {
      required: '',
      minlength: '8',
      maxlength: '72',
      autocomplete: 'new-password'
    });
    const passwordFeedback = element('div', {'aria-live': 'polite'});
    password.append(
        passwordFeedback,
        element(
            'button', {type: 'submit', className: 'button button-primary'},
            'Update password'));
    password.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!password.reportValidity()) return;
      const values = new FormData(password);
      const passwordText = String(values.get('newPassword'));
      if (new TextEncoder().encode(passwordText).length > 72) {
        showMessage(
            passwordFeedback, 'Password must be no more than 72 UTF-8 bytes.');
        newPassword.focus();
        return;
      }
      if (passwordText !== values.get('confirmPassword')) {
        showMessage(passwordFeedback, 'Passwords do not match.');
        password.elements.confirmPassword.focus();
        return;
      }
      const submit = password.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await apiJson('/api/me/password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: values.get('currentPassword'),
            newPassword: passwordText
          })
        });
        password.reset();
        showMessage(passwordFeedback, 'Password updated.', 'status');
      } catch (error) {
        showMessage(passwordFeedback, error.message);
        appendFieldErrors(passwordFeedback, password, error.fieldErrors);
      } finally {
        submit.disabled = false;
      }
    });
    main.append(password);
  } catch (error) {
    main.replaceChildren(errorBox(error, () => renderSettings(runtime)));
  }
}
