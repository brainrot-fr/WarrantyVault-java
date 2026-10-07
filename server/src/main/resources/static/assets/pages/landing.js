import {element, link} from '../ui.js';

export function renderLanding(runtime) {
  runtime.setPageTitle('WarrantyVault');
  const main = element('main', {className: 'page-content'});
  const section = element('section', {className: 'landing'});
  const copy = element('div');
  copy.append(
      element(
          'p', {className: 'eyebrow'},
          'A considered place for the things you own'),
      element('h1', {}, 'Your warranties, kept close.'),
      element(
          'p', {className: 'landing-intro'},
          'Keep purchase bills and warranty dates together, organized by the places and people that matter.'));
  const actions = element('div', {className: 'landing-actions'});
  actions.append(
      link('Create your vault', '/register', 'button button-primary'),
      link('Sign in', '/login', 'btn btn-quiet'));
  copy.append(actions);
  section.append(
      copy,
      element(
          'aside', {className: 'landing-note'},
          'Every receipt, model number, and coverage date in one reliable record.'));
  main.append(section);
  runtime.renderShell(main);
}
