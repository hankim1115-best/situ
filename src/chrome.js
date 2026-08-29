// Shared app chrome: top app bar + bottom tab bar.

import { h } from './ui.js';
import { navigate } from './router.js';
import { countDue } from './store.js';

const TABS = [
  { id: 'home', href: '#/', ic: '✏️', label: '상황' },
  { id: 'library', href: '#/library', ic: '📚', label: '라이브러리' },
  { id: 'review', href: '#/review', ic: '🔁', label: '복습' },
  { id: 'settings', href: '#/settings', ic: '⚙️', label: '설정' },
];

export function appbar({ title, back, actions = [] }) {
  return h(
    'header',
    { class: 'appbar' },
    back
      ? h('button', { class: 'iconbtn', onClick: () => (typeof back === 'string' ? navigate(back) : history.back()) }, '‹ 뒤로')
      : null,
    h('h1', null, title),
    h('div', { class: 'spacer' }),
    ...actions
  );
}

export function tabbar(active) {
  const due = countDue();
  return h(
    'nav',
    { class: 'tabbar' },
    ...TABS.map((t) =>
      h(
        'a',
        { href: t.href, 'aria-current': active === t.id ? 'page' : null },
        h('span', { class: 'ic' }, t.ic),
        h('span', null, t.id === 'review' && due ? `복습 ${due}` : t.label)
      )
    )
  );
}

// Compose a full screen. `tab` shows the bottom bar; omit it for pushed views.
export function screen({ title, back, actions, tab, children }) {
  const nodes = [appbar({ title, back, actions }), h('main', { class: 'wrap' }, ...[].concat(children))];
  if (tab) nodes.push(tabbar(tab));
  return h('div', { class: 'screen' + (tab ? '' : ' no-tabs') }, ...nodes);
}
