import { h, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getSet, deleteSet, renameSet, countDue } from '../store.js';
import { renderPack } from '../packview.js';

export function setDetailView({ params }) {
  const set = getSet(params.id);
  if (!set) {
    return screen({
      title: '없음',
      back: '/library',
      children: h('div', { class: 'empty' }, h('p', null, '이 대화 팩을 찾을 수 없어요.')),
    });
  }

  const due = countDue(set.id);
  const hasDialogue = (set.pack.dialogue || []).length > 0;

  const actions = [
    h('button', { class: 'iconbtn', onClick: onRename }, '이름변경'),
  ];

  const body = h(
    'div',
    { class: 'stack' },
    h(
      'section',
      { class: 'card' },
      h('h3', null, set.situation.partner ? '상대 · ' + set.situation.partner : '상황'),
      h('p', { style: 'margin:6px 0 0;' }, set.situation.text),
      set.situation.goal ? h('p', { class: 'muted small', style: 'margin:6px 0 0;' }, '목표: ' + set.situation.goal) : null
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn primary', style: 'flex:1;', onClick: () => navigate('/review?set=' + set.id) }, due ? `복습 (${due})` : '복습'),
      hasDialogue ? h('button', { class: 'btn', style: 'flex:1;', onClick: () => navigate('/practice/' + set.id) }, '역할극 연습') : null
    ),
    ...renderPack(set.pack),
    h('button', { class: 'btn danger block', onClick: onDelete }, '이 대화 팩 삭제')
  );

  return screen({ title: set.title, back: '/library', actions, children: body });

  function onRename() {
    const next = window.prompt('새 이름', set.title);
    if (next && next.trim()) {
      renameSet(set.id, next.trim());
      navigate('/set/' + set.id);
    }
  }

  function onDelete() {
    if (window.confirm('삭제하면 되돌릴 수 없어요. 삭제할까요?')) {
      deleteSet(set.id);
      toast('삭제했어요.');
      navigate('/library');
    }
  }
}
