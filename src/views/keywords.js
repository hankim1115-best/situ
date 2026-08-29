import { h, mount, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getDraft, setDraft, addSet } from '../store.js';
import { generatePack } from '../api.js';
import { speak, ttsSupported } from '../tts.js';

let ui = { mode: 'list', i: 0, show: false };

export function resetKeywordsView() {
  ui = { mode: 'list', i: 0, show: false };
}

function speakBtn(text) {
  if (!ttsSupported() || !text) return null;
  return h('button', { class: 'speak', title: '소리 듣기', onClick: (e) => { e.stopPropagation(); speak(text); } }, '🔊');
}

export function keywordsView() {
  const draft = getDraft();
  const kws = draft && draft.keywords ? draft.keywords : null;

  if (!kws || !kws.length) {
    return screen({
      title: '키워드 학습',
      back: '/',
      children: h('div', { class: 'empty' }, h('div', { class: 'big' }, '🔤'), h('p', null, '먼저 상황을 입력하고 "키워드 먼저 공부"를 눌러 주세요.')),
    });
  }

  const { situation } = draft;

  const toggle = h(
    'div',
    { class: 'segmented' },
    ...[['list', '목록'], ['card', '카드']].map(([v, label]) =>
      h('button', { type: 'button', 'aria-pressed': ui.mode === v, onClick: () => { ui.mode = v; ui.i = 0; ui.show = false; rerender(); } }, label)
    )
  );

  const makeBtn = h('button', { class: 'btn primary block', onClick: onMakePack }, '이 키워드로 대화 팩 만들기');
  const saveBtn = h('button', { class: 'btn ghost block', onClick: onSaveDeck }, '복습 덱에 저장');

  const head = h(
    'div',
    { class: 'stack' },
    h('section', { class: 'card' }, h('h3', null, situation.partner ? '상대 · ' + situation.partner : '상황'), h('p', { style: 'margin:6px 0 0;' }, situation.text)),
    draft.keywordsNote ? h('p', { class: 'small muted', style: 'margin:0 2px;' }, draft.keywordsNote) : null,
    toggle
  );

  const body = ui.mode === 'list' ? listMode(kws) : cardMode(kws);

  return screen({
    title: '키워드 학습',
    back: '/',
    children: h('div', { class: 'stack' }, head, body, makeBtn, saveBtn),
  });

  function rerender() {
    mount(keywordsView());
  }

  function listMode(items) {
    return h(
      'section',
      { class: 'card' },
      h('h3', null, `키워드 ${items.length}`),
      ...items.map((k) =>
        h(
          'div',
          { class: 'line' },
          h('div', { class: 'top' }, h('div', { class: 'en' }, k.term), speakBtn(k.term)),
          h('div', { class: 'ko' }, [k.pos ? '(' + k.pos + ') ' : '', k.ko].join('')),
          k.example_en ? h('div', { class: 'meta' }, k.example_en) : null,
          k.example_ko ? h('div', { class: 'meta' }, k.example_ko) : null,
          k.pron ? h('div', { class: 'meta' }, '발음 · ' + k.pron) : null,
          k.why ? h('div', { class: 'meta' }, '쓰임 · ' + k.why) : null
        )
      )
    );
  }

  function cardMode(items) {
    const k = items[ui.i];
    const face = h(
      'section',
      {
        class: 'card',
        style: 'min-height:200px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:10px; cursor:pointer;',
        onClick: () => { if (!ui.show) { ui.show = true; if (ttsSupported()) speak(k.term); rerender(); } },
      },
      h('div', { class: 'small muted' }, `${ui.i + 1} / ${items.length}`),
      h('div', { style: 'font-size:22px; font-weight:700;' }, k.term),
      ui.show
        ? h(
            'div',
            { class: 'stack', style: 'gap:8px;' },
            h('div', { style: 'font-size:16px;' }, [k.pos ? '(' + k.pos + ') ' : '', k.ko].join('')),
            k.example_en ? h('div', { class: 'muted small' }, k.example_en) : null,
            k.example_ko ? h('div', { class: 'muted small' }, k.example_ko) : null,
            k.pron ? h('div', { class: 'muted small' }, '발음 · ' + k.pron) : null,
            k.why ? h('div', { class: 'muted small' }, '쓰임 · ' + k.why) : null,
            ttsSupported() ? h('button', { class: 'btn sm', onClick: (e) => { e.stopPropagation(); speak(k.term); } }, '🔊 듣기') : null
          )
        : h('div', { class: 'small muted' }, '탭하면 뜻 보기')
    );

    const nav = h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn', style: 'flex:1;', disabled: ui.i === 0, onClick: () => { if (ui.i > 0) { ui.i--; ui.show = false; rerender(); } } }, '‹ 이전'),
      h('button', { class: 'btn primary', style: 'flex:1;', disabled: ui.i >= items.length - 1, onClick: () => { if (ui.i < items.length - 1) { ui.i++; ui.show = false; rerender(); } } }, '다음 ›')
    );

    return h('div', { class: 'stack' }, face, nav);
  }

  async function onMakePack() {
    makeBtn.disabled = true;
    saveBtn.disabled = true;
    makeBtn.textContent = '';
    makeBtn.append(h('span', { class: 'spinner' }), document.createTextNode(' 만드는 중… (10–20초)'));
    try {
      const { pack, usage, model } = await generatePack({ ...situation, keywords: kws });
      pack.keywords = kws;
      setDraft({ id: 'draft', situation, pack, usage, model, createdAt: Date.now() });
      navigate('/result');
    } catch (e) {
      console.error(e);
      toast(e.message || '생성에 실패했습니다.', 4000);
      makeBtn.disabled = false;
      saveBtn.disabled = false;
      makeBtn.textContent = '이 키워드로 대화 팩 만들기';
    }
  }

  function onSaveDeck() {
    const set = addSet({
      situation,
      pack: { title: draft.keywordsTitle || (situation.text || '키워드').slice(0, 40), note: draft.keywordsNote || '', keywords: kws },
    });
    toast('복습 덱으로 저장했어요.');
    navigate('/set/' + set.id);
  }
}
