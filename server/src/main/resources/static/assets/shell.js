import {element, link} from './ui.js';

function renderHeader(authenticated, onLogout) {
  const header = element('header', {className: 'site-header'});
  header.append(
      link('WarrantyVault', authenticated ? '/dashboard' : '/', 'wordmark'));
  if (authenticated) {
    const nav = element(
        'nav', {'aria-label': 'Main navigation', className: 'primary-nav'});
    nav.append(
        link('Overview', '/dashboard'), link('Spaces', '/spaces'),
        link('Invitations', '/invitations'), link('Settings', '/settings'));
    const signOut = element(
        'button', {className: 'text-button', type: 'button'}, 'Sign out');
    signOut.addEventListener('click', onLogout);
    header.append(nav, signOut);
  } else {
    const nav = element(
        'nav', {'aria-label': 'Account navigation', className: 'primary-nav'});
    nav.append(
        link('Sign in', '/login'),
        link('Create account', '/register', 'button button-primary'));
    header.append(nav);
  }
  return header;
}

export function renderShell(
    root, content, {authenticated = false, bootstrapError = '', onLogout} = {}) {
  const page = element('div', {className: 'app-page'});
  page.append(renderHeader(authenticated, onLogout));
  if (bootstrapError)
    page.append(element(
        'p', {className: 'connection-banner', role: 'status'}, bootstrapError));
  content.id = 'main-content';
  content.tabIndex = -1;
  page.append(content);
  page.append(element(
      'footer', {className: 'site-footer'},
      'WarrantyVault · Your records, kept close.'));
  root.replaceChildren(page);
}
