import {element, link, getTheme, setTheme} from './ui.js';

function navigationLink(label, href) {
  const anchor = link(label, href);
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === href ||
      (href === '/spaces' && pathname.startsWith('/spaces/')))
    anchor.setAttribute('aria-current', 'page');
  return anchor;
}

function renderHeader(authenticated, onLogout, invitationCount) {
  const header = element('header', {className: 'site-header'});
  header.append(
      link('WarrantyVault', authenticated ? '/dashboard' : '/', 'wordmark'));
  if (authenticated) {
    const nav = element(
        'nav', {'aria-label': 'Main navigation', className: 'primary-nav'});
    nav.append(
        navigationLink('Overview', '/dashboard'),
        navigationLink('Spaces', '/spaces'),
        link('Add product', '/add-product', 'button button-primary'),
        navigationLink(
            invitationCount == null ? 'Invitations' :
                                      `Invitations (${invitationCount})`,
            '/invitations'),
        navigationLink('Settings', '/settings'));
    const signOut = element(
        'button', {className: 'text-button', type: 'button'}, 'Sign out');
    signOut.addEventListener('click', onLogout);
    const themeToggle = element(
        'button', {className: 'text-button', type: 'button'},
        getTheme() === 'dark' ? 'Use light theme' : 'Use dark theme');
    themeToggle.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
      themeToggle.textContent = next === 'dark' ? 'Use light theme' : 'Use dark theme';
    });
    header.append(nav, themeToggle, signOut);
  } else {
    const nav = element(
        'nav', {'aria-label': 'Account navigation', className: 'primary-nav'});
    nav.append(
        navigationLink('Sign in', '/login'),
        link('Create account', '/register', 'button button-primary'));
    header.append(nav);
  }
  return header;
}

export function renderShell(
    root, content, {
      authenticated = false,
      bootstrapError = '',
      onLogout,
      invitationCount = null
    } = {}) {
  const page = element('div', {className: 'app-page'});
  page.append(renderHeader(authenticated, onLogout, invitationCount));
  if (authenticated) {
    const mobileNav = element(
        'nav', {'aria-label': 'Mobile navigation', className: 'mobile-tab-bar'});
    mobileNav.append(
        navigationLink('Overview', '/dashboard'),
        navigationLink('Spaces', '/spaces'),
        navigationLink('Add', '/add-product'),
        navigationLink('Invitations', '/invitations'),
        navigationLink('Settings', '/settings'));
    page.append(mobileNav);
  }
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
