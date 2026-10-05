import {apiJson} from '../api.js';
import {element, link, errorBox} from '../ui.js';

function renderProductSummary(product) {
  const row = element('article', {className: 'line-item'});
  const summary = element('div', {className: 'product-summary'});
  summary.append(
      element(
          'strong', {},
          `${product.brand || ''} ${product.productType || 'Product'}`.trim()),
      element('small', {}, `${product.spaceName} · ${product.expiresOn}`));
  row.append(link(
      '',
      `/spaces/${encodeURIComponent(product.spaceId)}/products/${
          encodeURIComponent(product.id)}`,
      'product-summary-link'));
  row.firstChild.append(
      summary,
      element(
          'span', {
            className: `status-label status-${
                String(product.status || '')
                    .toLowerCase()
                    .replaceAll('_', '-')}`
          },
          product.status?.replaceAll('_', ' ') || 'Warranty'));
  return row;
}

export async function renderDashboard(runtime) {
  const main = element('main', {className: 'page-content'});
  const heading = element('div', {className: 'page-heading'});
  heading.append(
      element(
          'p', {className: 'eyebrow'},
          `Welcome${runtime.session?.name ? `, ${runtime.session.name}` : ''}`),
      element('h1', {}, 'Overview'),
      element(
          'p', {className: 'section-intro'},
          'A clear view of your recorded warranty coverage.'));
  main.append(heading);
  const content =
      element('div', {className: 'dashboard-layout', 'aria-live': 'polite'});
  content.append(
      element('p', {role: 'status'}, 'Loading your warranty overview…'));
  main.append(content);
  runtime.renderShell(main, true);
  try {
    const [dashboard, spaces, invitations] = await Promise.all([
      apiJson('/api/dashboard'), apiJson('/api/spaces'),
      apiJson('/api/invitations')
    ]);
    content.replaceChildren();
    const primary = element('section', {className: 'dashboard-main'});
    const figures = element('div', {className: 'summary-figures'});
    for (const [label, value, tone] of [
             ['Active', dashboard.counts?.active || 0, ''],
             ['Expiring soon', dashboard.counts?.expiringSoon || 0, 'soon'],
             ['Expired', dashboard.counts?.expired || 0, 'expired']]) {
      const figure = element('div', {className: `figure ${tone}`});
      figure.append(element('strong', {}, value), element('span', {}, label));
      figures.append(figure);
    }
    primary.append(figures);
    if (invitations.length) {
      primary.append(element(
          'p', {className: 'notice'},
          `You have ${invitations.length} invitation${
              invitations.length === 1 ? '' : 's'} waiting.`));
    }
    const products = dashboard.upcoming || [];
    const expiringSoon = products.filter(
        product => product.status === 'EXPIRING_SOON');
    const activeProducts =
        products.filter(product => product.status === 'ACTIVE');
    const recentlyExpired = dashboard.recentlyExpired || [];
    if (!spaces.length) {
      primary.append(element('section', {className: 'first-run'}, [
        element(
            'p', {},
            'Create a Space for a place, such as Home, then add a bill and its warranty period.'),
        link('Create your first Space', '/spaces', 'button button-primary')
      ]));
    } else if (!products.length && !recentlyExpired.length) {
      primary.append(element(
          'p', {className: 'empty-note'},
          'No warranty records need your attention yet.'));
    } else {
      if (expiringSoon.length) {
        primary.append(element('h2', {}, 'Expiring soon'));
        const expiringSoonList = element('div', {className: 'line-list'});
        for (const product of expiringSoon)
          expiringSoonList.append(renderProductSummary(product));
        primary.append(expiringSoonList);
      }
      if (activeProducts.length) {
        primary.append(
            element('h2', {className: 'section-title'}, 'Active products'));
        const activeList = element('div', {className: 'line-list'});
        for (const product of activeProducts)
          activeList.append(renderProductSummary(product));
        primary.append(activeList);
      }
      if (recentlyExpired.length) {
        primary.append(
            element('h2', {className: 'section-title'}, 'Expired products'));
        const expired = element('div', {className: 'line-list'});
        for (const product of recentlyExpired)
          expired.append(renderProductSummary(product));
        primary.append(expired);
      }
    }
    const side = element(
        'aside', {className: 'dashboard-aside', 'aria-label': 'Covered value'});
    side.append(element('h2', {}, 'Covered value'));
    const totals = Object.entries(dashboard.totalCoveredValue || {});
    side.append(
        totals.length ?
            element(
                'ul', {},
                totals.map(
                    ([currency, amount]) =>
                        element('li', {}, `${currency} ${amount}`))) :
            element('p', {className: 'muted'}, 'No product values yet.'));
    content.append(primary, side);
  } catch (error) {
    const retry = element(
        'button', {className: 'button button-quiet', type: 'button'},
        'Try again');
    retry.addEventListener('click', () => renderDashboard(runtime));
    content.replaceChildren(
        element('p', {role: 'alert', className: 'form-error'}, error.message),
        retry);
  }
}
