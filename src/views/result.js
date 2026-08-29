import { h, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getDraft, clearDraft, addSet } from '../store.js';
import { renderPack } from '../packview.js';

export function resultView() {
  const draft = getDraft();
  if (!draft) {
    return screen({
      title: '결과',
      back: '/',
      children: h('div', { class: 'empty' }, h('div', { class: 'big' }, '🗒️'), h('p', null, '아직 만든 대화 팩이 없어요.')),
    });
  }

  const { pack, situation } = draft;

  const saveBtn = h(
    'button',
    {
      class: 'btn primary block',
      onClick: () => {
        const set = addSet({ situation, pack });
        clearDraft();
        toast('라이브러리에 저장했어요.');
        navigate('/set/' + set.id);
      },
    },
    '저장하기'
  );

  const body = h(
    'div',
    { class: 'stack' },
    h('section', { class: 'card' }, h('h3', null, situation.partner ? '상대 · ' + situation.partner : '상황'), h('p', { style: 'margin:6px 0 0;' }, situation.text)),
    ...renderPack(pack),
    h('div', { class: 'row' }, saveBtn),
    h('button', { class: 'btn ghost block', onClick: () => navigate('/') }, '새 상황 만들기'),
    h(
      'details',
      { class: 'raw' },
      h('summary', { class: 'muted small' }, '원본 데이터(JSON) 보기'),
      h('pre', null, JSON.stringify(pack, null, 2))
    )
  );

  return screen({ title: '대화 팩', back: '/', children: body });
}
