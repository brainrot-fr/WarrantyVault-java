import {apiJson, clearAccessToken, restoreSession, setAccessToken} from './api.js';
import {renderAuth} from './pages/auth.js';
import {renderDashboard} from './pages/dashboard.js';
import {renderInvitations} from './pages/invitations.js';
import {renderLanding} from './pages/landing.js';
import {renderMembers} from './pages/members.js';
import {renderProduct} from './pages/products.js';
import {renderProductForm} from './pages/product-form.js';
import {renderSettings} from './pages/settings.js';
import {renderSpace} from './pages/space.js';
import {renderSpaces} from './pages/spaces.js';
import {renderShell} from './shell.js';
import {element, link} from './ui.js';

const root = document.querySelector('#app');
const activeImageUrls = new Set();
const routes = [
  {pattern: /^\/$/, page: 'landing'}, {pattern: /^\/login\/?$/, page: 'login'},
  {pattern: /^\/register\/?$/, page: 'register'},
  {pattern: /^\/dashboard\/?$/, page: 'dashboard', protected: true},
  {pattern: /^\/spaces\/?$/, page: 'spaces', protected: true},
  {pattern: /^\/spaces\/([^/]+)\/?$/, page: 'space', protected: true}, {
    pattern: /^\/spaces\/([^/]+)\/products\/new\/?$/,
    page: 'product-new',
    protected: true
  },
  {
    pattern: /^\/spaces\/([^/]+)\/products\/([^/]+)\/edit\/?$/,
    page: 'product-edit',
    protected: true
  },
  {
    pattern: /^\/spaces\/([^/]+)\/products\/([^/]+)\/?$/,
    page: 'product',
    protected: true
  },
  {
    pattern: /^\/spaces\/([^/]+)\/members\/?$/,
    page: 'members',
    protected: true
  },
  {pattern: /^\/invitations\/?$/, page: 'invitations', protected: true},
  {pattern: /^\/settings\/?$/, page: 'settings', protected: true},
  {pattern: /^\/not-found\/?$/, page: 'not-found'}
];

let session = null;
let sessionState = 'loading';
let bootstrapError = '';

const runtime = {
  navigate,
  acceptSession,
  setSession(user) {
    session = user;
  },
  trackImageUrl(url) {
    activeImageUrls.add(url);
  },
  renderShell(content, authenticated = false) {
    renderShell(
        root, content, {authenticated, bootstrapError, onLogout: logout});
  },
  get session() {
    return session;
  }
};

function navigate(path, replace = false) {
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  releaseImageUrls();
  render();
  window.scrollTo(0, 0);
}

function releaseImageUrls() {
  for (const url of activeImageUrls) URL.revokeObjectURL(url);
  activeImageUrls.clear();
}

function currentRoute() {
  for (const route of routes) {
    const match = window.location.pathname.match(route.pattern);
    if (match) return {...route, params: match.slice(1)};
  }
  return {page: 'not-found', protected: false, params: []};
}

function acceptSession(nextSession) {
  session = nextSession?.user || null;
  if (nextSession?.accessToken)
    setAccessToken(nextSession.accessToken);
  else
    clearAccessToken();
  sessionState = session ? 'authenticated' : 'anonymous';
  bootstrapError = '';
}

async function logout() {
  try {
    await apiJson('/api/auth/logout', {
      method: 'POST',
      body: '{}',
      headers: {'X-Requested-With': 'warrantyvault'},
      skipRefresh: true
    });
  } catch (error) {
    bootstrapError = `Sign-out could not be confirmed: ${error.message}`;
    render();
    return;
  }
  acceptSession(null);
  navigate('/', true);
}

function renderLoading() {
  const main = element(
      'main',
      {className: 'page-content', role: 'status', 'aria-live': 'polite'});
  main.append(
      element('p', {className: 'eyebrow'}, 'WarrantyVault'),
      element('h1', {}, 'Restoring your session'),
      element('p', {}, 'Please wait while we securely reconnect.'));
  runtime.renderShell(main);
}

function renderNotFound() {
  const main = element('main', {className: 'page-content'});
  main.append(
      element('p', {className: 'eyebrow'}, '404'),
      element('h1', {}, 'That page isn’t here.'),
      element(
          'p', {}, 'Return to your warranty records or sign in to continue.'),
      link(
          'Go to WarrantyVault', session ? '/dashboard' : '/',
          'button button-primary'));
  runtime.renderShell(main, Boolean(session));
}

async function render() {
  const route = currentRoute();
  if (sessionState === 'loading') return renderLoading();
  if (route.protected && !session) {
    const next = `${window.location.pathname}${window.location.search}`;
    return navigate(`/login?next=${encodeURIComponent(next)}`, true);
  }
  if (session && ['landing', 'login', 'register'].includes(route.page))
    return navigate('/dashboard', true);

  switch (route.page) {
    case 'landing':
      return renderLanding(runtime);
    case 'login':
      return renderAuth(false, runtime);
    case 'register':
      return renderAuth(true, runtime);
    case 'dashboard':
      return renderDashboard(runtime);
    case 'spaces':
      return renderSpaces(runtime);
    case 'space':
      return renderSpace(runtime, route.params[0]);
    case 'product':
      return renderProduct(runtime, route.params[0], route.params[1]);
    case 'product-new':
      return renderProductForm(runtime, route.params[0], null);
    case 'product-edit':
      return renderProductForm(runtime, route.params[0], route.params[1]);
    case 'members':
      return renderMembers(runtime, route.params[0]);
    case 'invitations':
      return renderInvitations(runtime);
    case 'settings':
      return renderSettings(runtime);
    case 'not-found':
      return renderNotFound();
    default:
      return renderNotFound();
  }
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest('a[href]');
  if (!anchor || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return;
  event.preventDefault();
  navigate(`${destination.pathname}${destination.search}${destination.hash}`);
});

window.addEventListener('popstate', () => {
  releaseImageUrls();
  render();
});
window.addEventListener('warrantyvault:session-expired', () => {
  acceptSession(null);
  const next = `${window.location.pathname}${window.location.search}`;
  navigate(`/login?next=${encodeURIComponent(next)}`, true);
});
window.addEventListener('pagehide', releaseImageUrls);

restoreSession()
    .then((restored) => {
      acceptSession(restored);
      render();
    })
    .catch((error) => {
      clearAccessToken();
      session = null;
      sessionState = 'anonymous';
      bootstrapError = `Unable to restore your session: ${error.message}`;
      render();
    });
