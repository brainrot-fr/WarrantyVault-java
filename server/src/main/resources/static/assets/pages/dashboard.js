import {apiJson} from '../api.js';
import {
  element,
  link,
  errorBox,
  formatMoney,
  describeExpiry,
  statusBadge
} from '../ui.js';

function renderProductSummary(product) {
  const title = `${product.brand || ''} ${product.productType || 'Product'}`.trim();
  const label = String(product.status || '').toLowerCase().replaceAll('_', '-');
  const summary = element('span', {className: 'product-summary'});
  summary.append(element('strong', {}, title), element('small', {}, product.spaceName));
  const status = statusBadge(product.status?.replaceAll('_', ' ') || 'Warranty', label);
  const expiry = element('span', {className: 'product-summary-expiry'});
  expiry.append(
      element('small', {}, describeExpiry(product.daysRemaining, product.expiresOn)),
      status);
  const row = link(
      '',
      `/spaces/${encodeURIComponent(product.spaceId)}/products/${encodeURIComponent(product.id)}`,
      'line-item product-summary-link');
  row.append(summary, expiry);
  return row;
}

export async function renderDashboard(runtime) {
  runtime.setPageTitle('Overview');
  const main = element('main', {className: 'page-content', 'aria-busy': 'true'});
  const heading = element('div', {className: 'page-heading'});
  heading.append(
      element('p', {className: 'eyebrow'}, `Welcome${runtime.session?.name ? `, ${runtime.session.name}` : ''}`),
      element('h1', {}, 'Overview'),
      element('p', {className: 'section-intro'}, 'A clear view of your recorded warranty coverage.'));
  heading.append(link('Add product', '/add-product', 'button button-primary'));
  main.append(heading);
  const content = element('div', {className: 'dashboard-layout'});
  const primary = element('section', {className: 'dashboard-main'});
  primary.append(element('p', {role: 'status'}, 'Loading your warranty overview…'));
  content.append(primary);
  main.append(content);
  runtime.renderShell(main, true);
  try {
    const [dashboard, spaces] = await Promise.all([
      apiJson('/api/dashboard'), apiJson('/api/spaces')
    ]);
    runtime.refreshInvitations();
    main.removeAttribute('aria-busy');
    primary.replaceChildren();
    const counts = dashboard.counts || {};
    const soonCount = counts.expiringSoon || 0;
    const expiredCount = counts.expired || 0;
    primary.append(element(
        'p', {className: 'section-intro dashboard-summary'},
        summarySentence(soonCount, expiredCount)));
    const figures = element('div', {className: 'summary-figures'});
    for (const [label, value, tone, symbol] of [
      ['Active', counts.active || 0, '', ''],
      ['Expiring soon', soonCount, 'soon', '!'],
      ['Expired', expiredCount, 'expired', 'x']
    ]) {
      const figure = element('div', {className: `figure ${tone}`});
      figure.append(element('span', {}, label), element('strong', {}, value));
      if (symbol) {
        figure.append(element(
            'span', {'aria-hidden': 'true', className: 'status-symbol'}, symbol));
      }
      figures.append(figure);
    }
    primary.append(figures);
    if (runtime.invitationCount) {
      primary.append(link(
          `You have ${runtime.invitationCount} invitation${runtime.invitationCount === 1 ? '' : 's'} waiting. View invitations.`,
          '/invitations',
          'notice invitation-notice'));
    }

    const upcoming = dashboard.upcoming || [];
    const expiring = upcoming.filter((product) => product.status === 'EXPIRING_SOON');
    const active = upcoming.filter((product) => product.status === 'ACTIVE');
    const expired = dashboard.recentlyExpired || [];
    const hasProducts = spaces.some((space) => space.productCount > 0);
    if (!spaces.length) {
      primary.append(element('section', {className: 'first-run'}, [
        element('p', {}, 'Create a Space for a place, such as Home, then add a bill and its warranty period.'),
        link('Create your first Space', '/spaces', 'button button-primary')
      ]));
    } else if (!hasProducts) {
      primary.append(element(
          'p', {className: 'empty-note'}, 'No warranty records yet. Open a Space and choose Add product.'));
    } else {
      const attention = element('section', {className: 'needs-attention'});
      attention.append(element('h2', {className: 'section-title'}, 'Needs attention'));
      appendProductList(attention, 'Expiring soon', expiring);
      if (expired.length) {
          attention.append(element('h2', {className: 'section-title'}, 'Recently expired'));
          const list = element('div', {className: 'line-list'});
          expired.forEach((product) => list.append(renderProductSummary(product)));
          attention.append(list);
        }
      if (expiring.length || expired.length) primary.append(attention);
      appendProductList(primary, 'Active', active);
      const upcomingCount = (counts.active || 0) + soonCount;
      if (upcoming.length >= 50 && upcomingCount > upcoming.length) {
        primary.append(element(
            'p', {className: 'muted'},
            `Showing 50 of ${upcomingCount}. Open a Space to see all.`));
      }
      if (expiredCount > expired.length) {
        primary.append(element(
            'p', {className: 'muted'},
            `Showing the ${expired.length} most recent of the last 90 days.`));
      }
    }

    const side = element('aside', {className: 'dashboard-aside', 'aria-label': 'Value still under warranty'});
    side.append(
        element('h2', {}, 'Value still under warranty'),
        element('p', {className: 'muted'}, 'Purchase price of products whose warranty has not ended.'));
    const totals = Object.entries(dashboard.totalCoveredValue || {});
    side.append(totals.length ?
      element('ul', {}, totals.map(([currency, amount]) =>
        element('li', {}, formatMoney(currency, amount)))) :
      element('p', {className: 'muted'}, 'No product values yet.'));
    content.append(side);
  } catch (error) {
    main.removeAttribute('aria-busy');
    primary.replaceChildren(errorBox(error, () => renderDashboard(runtime)));
  }
}

function summarySentence(soon, expired) {
  if (!soon && !expired) return 'Nothing needs your attention.';
  const soonText = soon ? `${soon} product${soon === 1 ? '' : 's'} ${soon === 1 ? 'expires' : 'expire'} soon` : '';
  const expiredText = expired ? `${expired} ${expired === 1 ? 'has' : 'have'} expired` : '';
  if (soonText && expiredText) return `${soonText} and ${expiredText}.`;
  return `${soonText || expiredText}.`;
}

function appendProductList(parent, title, products) {
  if (!products.length) return;
  parent.append(element('h2', {className: 'section-title'}, title));
  const list = element('div', {className: 'line-list'});
  products.forEach((product) => list.append(renderProductSummary(product)));
  parent.append(list);
}
