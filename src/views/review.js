import { h, mount } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { collectDueCards, gradeCard, getSet } from '../store.js';
import { speak, ttsSupported } from '../tts.js';

let session = null;

function build(filter) {
  const cards = collectDueCards({ setId: filter || null, limit: 20 });
  session = { filter: filter || '', cards, i: 0, show: false, results: [] };
}

// Called by the router on a real navigation to #/review so each visit is fresh.
export function resetReviewSession() {
  session = null;
}

export function reviewView({ query }) {
  const filter = query.set || '';
  if (!session || session.filter !== filter) {
    build(filter);
  }

  const title = filter ? `복습 · ${getSet(filter)?.title || ''}` : '복습';

  if (!session.cards.length) {
    return screen({
      title,
      tab: filter ? undefined : 'review',
      back: filter ? '/set/' + filter : undefined,
      children: h(
        'div',
        { class: 'empty' },
        h('div', { class: 'big' }, '✅'),
        h('p', null, '지금 복습할 카드가 없어요.'),
        h('p', { class: 'small muted' }, '새 대화 팩을 저장하거나 나중에 다시 오세요.')
      ),
    });
  }

  // finished
  if (session.i >= session.cards.length) {
    const good = session.results.filter((r) => r === 2).length;
    const soso = session.results.filter((r) => r === 1).length;
    const bad = session.results.filter((r) => r === 0).length;
    const body = h(
      'div',
      { class: 'empty' },
      h('div', { class: 'big' }, '🎉'),
      h('p', null, `${session.cards.length}개 복습 완료`),
      h('p', { class: 'small muted' }, `잘 앎 ${good} · 애매 ${soso} · 모름 ${bad}`),
      h(
        'div',
        { class: 'row', style: 'justify-content:center; margin-top:14px;' },
        h('button', { class: 'btn', onClick: () => { session = null; mount(reviewView({ query })); } }, '한 번 더'),
        h('button', { class: 'btn ghost', onClick: () => navigate(filter ? '/set/' + filter : '/library') }, '끝내기')
      )
    );
    return screen({ title, tab: filter ? undefined : 'review', back: filter ? '/set/' + filter : undefined, children: body });
  }

  const card = session.cards[session.i];
  const progress = `${session.i + 1} / ${session.cards.length}`;

  const face = h(
    'section',
    { class: 'card', style: 'min-height:180px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:10px; cursor:pointer;', onClick: reveal },
    h('div', { class: 'small muted' }, card.setTitle),
    h('div', { style: 'font-size:20px; font-weight:700;' }, card.front),
    session.show ? h('div', { class: 'muted', style: 'font-size:16px;' }, card.back) : h('div', { class: 'small muted' }, '탭하면 뜻 보기'),
    ttsSupported() && session.show
      ? h('button', { class: 'btn sm', onClick: (e) => { e.stopPropagation(); speak(card.speak); } }, '🔊 듣기')
      : null
  );

  const controls = session.show
    ? h(
        'div',
        { class: 'grade-row' },
        h('button', { class: 'btn danger', onClick: () => grade(0) }, '모름'),
        h('button', { class: 'btn', onClick: () => grade(1) }, '애매'),
        h('button', { class: 'btn primary', onClick: () => grade(2) }, '잘 앎')
      )
    : h('button', { class: 'btn primary block', onClick: reveal }, '뜻 보기');

  const body = h(
    'div',
    { class: 'stack' },
    h('div', { class: 'center muted small' }, progress),
    face,
    controls
  );

  return screen({ title, tab: filter ? undefined : 'review', back: filter ? '/set/' + filter : undefined, children: body });

  function reveal() {
    if (session.show) return;
    session.show = true;
    if (ttsSupported()) speak(card.speak);
    mount(reviewView({ query }));
  }

  function grade(g) {
    gradeCard(card.setId, card.cardKey, g);
    session.results.push(g);
    session.i += 1;
    session.show = false;
    mount(reviewView({ query }));
  }
}
