import { h } from '../ui.js';
import { screen } from '../chrome.js';
import { getSets, countDue } from '../store.js';
import { fmtDate } from '../ui.js';

const FORMALITY = { casual: '캐주얼', neutral: '보통', formal: '격식' };

export function libraryView() {
  const sets = getSets();

  if (!sets.length) {
    return screen({
      title: '라이브러리',
      tab: 'library',
      children: h(
        'div',
        { class: 'empty' },
        h('div', { class: 'big' }, '📚'),
        h('p', null, '저장한 대화 팩이 여기 모여요.'),
        h('a', { class: 'btn sm', href: '#/' }, '상황 만들러 가기')
      ),
    });
  }

  const items = sets.map((s) => {
    const due = countDue(s.id);
    const exprN = (s.pack.expressions || []).length;
    const kwN = (s.pack.keywords || []).length;
    const countLabel = exprN ? `표현 ${exprN}` : kwN ? `키워드 ${kwN}` : null;
    return h(
      'a',
      { class: 'listitem', href: '#/set/' + s.id },
      h('h4', null, s.title),
      h(
        'div',
        { class: 'sub' },
        [
          s.situation.partner || null,
          FORMALITY[s.situation.formality] || null,
          countLabel,
          fmtDate(s.createdAt),
        ]
          .filter(Boolean)
          .join(' · ')
      ),
      due ? h('div', { style: 'margin-top:6px;' }, h('span', { class: 'pill-count' }, `복습 ${due}개`)) : null
    );
  });

  return screen({
    title: '라이브러리',
    tab: 'library',
    children: h('div', { class: 'stack' }, ...items),
  });
}
