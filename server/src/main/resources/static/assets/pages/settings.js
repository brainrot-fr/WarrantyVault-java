import {apiJson} from '../api.js';
import {
  element,
  addField,
  addSelect,
  addPasswordToggle,
  showMessage,
  showToast,
  showFieldErrors,
  errorBox
} from '../ui.js';

export async function renderSettings(runtime) {
  runtime.setPageTitle('Settings');
  const main = element('main', {className: 'page-content', 'aria-busy': 'true'});
  main.append(element('p', {role: 'status'}, 'Loading account settings…'));
  runtime.renderShell(main, true);
  try {
    const user = runtime.session || await apiJson('/api/me');
    if (!runtime.session) runtime.setSession(user);
    main.removeAttribute('aria-busy');
    main.replaceChildren();
    const heading = element('div', {className: 'page-heading'});
    heading.append(
        element('p', {className: 'eyebrow'}, 'WarrantyVault'),
        element('h1', {}, 'Your account'));
    main.append(heading);
    const profile = element('form', {className: 'settings-form'});
    profile.append(element('h2', {}, 'Profile'));
    profile.append(element(
        'p', {className: 'section-intro'},
        'Keep your name and account details up to date.'));
    profile.append(element(
        'p', {className: 'settings-row'},
        [element('span', {}, 'Email'), element('strong', {}, user.email)]));
    const name = addField(
        profile, 'Name', 'name', 'text',
        {
          required: '',
          minlength: '2',
          maxlength: '120',
          placeholder: 'Your name'
        });
    name.value = user.name;
    profile.append(element('h2', {className: 'settings-subheading'}, 'Preferences'));
    const timezoneOptions = [...new Set([
      user.timezone || 'UTC', 'UTC',
      ...(typeof Intl.supportedValuesOf === 'function' ?
          Intl.supportedValuesOf('timeZone') : [
            'America/Los_Angeles', 'America/New_York', 'Europe/London',
            'Europe/Paris', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
            'Australia/Sydney'
          ])
    ])].sort();
    const timezoneSearch = addField(
        profile, 'Search time zones', 'timezoneSearch', 'search',
        {required: false, placeholder: 'Type a city or region'});
    const timezone = addSelect(
        profile, 'Timezone', 'timezone',
        timezoneOptions.map((zone) => [zone, zone]), user.timezone || 'UTC');
    timezoneSearch.addEventListener('input', () => {
      const query = timezoneSearch.value.trim().toLowerCase();
      for (const option of timezone.options)
        option.hidden = Boolean(query) &&
            !option.value.toLowerCase().includes(query);
      const selected = [...timezone.options].find((option) => !option.hidden);
      if (selected && timezone.options[timezone.selectedIndex]?.hidden)
        timezone.value = selected.value;
    });
    const currencies = [...new Set([
      user.currency || 'INR',
      ...(typeof Intl.supportedValuesOf === 'function' ?
          Intl.supportedValuesOf('currency') :
          ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'])
    ])].sort();
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
        showToast('Account details saved.');
      } catch (error) {
        showMessage(profileFeedback, error.message);
        showFieldErrors(profile, error.fieldErrors, {name: 'Name', timezone: 'Time zone', currency: 'Currency'});
      } finally {
        submit.disabled = false;
      }
    });
    main.append(profile);

    const password = element('form', {className: 'settings-form inline-form'});
    password.append(element('h2', {}, 'Security'));
    password.append(element(
        'p', {className: 'section-intro'},
        'Change your password regularly. Passwords must be 8–72 UTF-8 bytes and '
        + 'should be unique; avoid common passwords.'));
    addPasswordToggle(addField(
        password, 'Current password', 'currentPassword', 'password',
        {
          required: '',
          autocomplete: 'current-password',
          placeholder: 'Enter your current password'
        }));
    const newPassword =
        addField(password, 'New password', 'newPassword', 'password', {
          required: '',
          minlength: '8',
          maxlength: '72',
          autocomplete: 'new-password',
          placeholder: 'At least 8 characters',
          hint: 'Use at least 8 characters, choose a unique passphrase, and avoid common passwords.'
        });
    addPasswordToggle(newPassword);
    addPasswordToggle(addField(password, 'Confirm new password', 'confirmPassword', 'password', {
      required: '',
      minlength: '8',
      maxlength: '72',
      autocomplete: 'new-password',
      placeholder: 'Re-enter your new password'
    }));
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
        showToast('Password updated.');
      } catch (error) {
        showMessage(passwordFeedback, error.message);
        showFieldErrors(password, error.fieldErrors, {
          currentPassword: 'Current password',
          newPassword: 'New password'
        });
      } finally {
        submit.disabled = false;
      }
    });
    main.append(password);
  } catch (error) {
    main.removeAttribute('aria-busy');
    main.replaceChildren(errorBox(error, () => renderSettings(runtime)));
  }
}
