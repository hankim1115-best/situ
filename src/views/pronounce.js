import { h, mount } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getSet } from '../store.js';
import { speak, ttsSupported, sttSupported, listenOnce } from '../tts.js';
import { scorePronunciation } from '../pronounce.js';

let session = null;

export function resetPronounceSession() {
  session = null;
}

function build(set) {
  const items = [];
  (set.pack.expressions || []).forEach((e) => items.push({ text: e.en, ko: e.ko }));
  (set.pack.keywords || []).forEach((k) => items.push({ text: k.term, ko: k.ko }));
  (set.pack.vocab || []).forEach((v) => items.push({ text: v.term, ko: v.ko }));
  session = { setId: set.id, items, i: 0, phase: 'idle', heard: '', result: null, listening: false, stop: null };
}

export function pronounceView({ params }) {
  const set = getSet(params.id);
  if (!set) {
    return screen({ title: '발음 연습', back: '/library', children: h('div', { class: 'empty' }, h('p', null, '대화 팩을 찾을 수 없어요.')) });
  }
  if (!session || session.setId !== set.id) build(set);

  const back = '/set/' + set.id;
  const rerender = () => mount(pronounceView({ params }));

  if (!sttSupported()) {
    return screen({
      title: '발음 연습',
      back,
      children: h('div', { class: 'empty' }, h('div', { class: 'big' }, '🎤'), h('p', null, '이 브라우저는 음성 인식을 지원하지 않아요.'),
        h('p', { class: 'small muted' }, '안드로이드 크롬에서 잘 동작합니다.')),
    });
  }
  if (!session.items.length) {
    return screen({ title: '발음 연습', back, children: h('div', { class: 'empty' }, h('p', null, '연습할 표현이 없어요.')) });
  }

  const item = session.items[session.i];
  const progress = `${session.i + 1} / ${session.items.length}`;

  const targetCard = h(
    'section',
    { class: 'card stack' },
    h('div', { class: 'small muted' }, '이 문장을 소리 내어 읽어 보세요'),
    h('div', { class: 'pron-target' }, item.text),
    item.ko ? h('div', { class: 'muted small' }, item.ko) : null,
    h('div', { class: 'row' },
      ttsSupported() ? h('button', { class: 'btn sm', onClick: () => speak(item.text) }, '🔊 들어보기') : null,
      session.phase === 'listening'
        ? h('button', { class: 'btn sm', onClick: () => stopMic(rerender) }, '● 듣는 중… 멈추기')
        : h('button', { class: 'btn primary sm', onClick: () => startMic(rerender) }, '🎤 말해 보기')
    ),
    session.phase === 'listening' && session.heard ? h('div', { class: 'muted small' }, '들린 말: ' + session.heard) : null
  );

  let resultCard = null;
  if (session.phase === 'result' && session.result) {
    const r = session.result;
    if (r.heardEmpty) {
      resultCard = h('section', { class: 'card' }, h('p', { style: 'margin:0;' }, '소리가 잘 안 잡혔어요. 조용한 곳에서 조금 더 크고 또렷하게 다시 해보세요.'));
    } else {
      resultCard = h(
        'section',
        { class: 'card stack' },
        h('div', { class: 'pron-score' }, r.score + '%'),
        h('div', { class: 'pron-words' }, ...r.words.map((w) => h('span', { class: 'w ' + (w.ok ? 'ok' : 'miss') }, w.w + ' '))),
        r.missing.length
          ? h('div', { class: 'stack', style: 'gap:6px;' },
              h('div', { class: 'small muted' }, '안 들린 단어 — 눌러서 듣고 다시 시도'),
              h('div', { class: 'chips' }, ...[...new Set(r.missing)].map((w) =>
                h('button', { class: 'chip', onClick: () => speak(w) }, w))))
          : h('div', { class: 'small', style: 'color:var(--ok);' }, '전부 또렷하게 인식됐어요. 좋아요!'),
        h('button', { class: 'btn sm', onClick: () => { session.phase = 'idle'; session.heard = ''; session.result = null; rerender(); } }, '다시 말하기')
      );
    }
  }

  const nav = h(
    'div',
    { class: 'row' },
    h('button', { class: 'btn', style: 'flex:1;', disabled: session.i === 0, onClick: () => go(-1, rerender) }, '‹ 이전'),
    h('button', { class: 'btn primary', style: 'flex:1;', disabled: session.i >= session.items.length - 1, onClick: () => go(1, rerender) }, '다음 ›')
  );

  return screen({
    title: '발음 연습 · ' + set.title,
    back,
    children: h('div', { class: 'stack' }, h('div', { class: 'center muted small' }, progress), targetCard, resultCard, nav),
  });
}

function go(d, rerender) {
  stopMic();
  session.i = Math.min(Math.max(session.i + d, 0), session.items.length - 1);
  session.phase = 'idle';
  session.heard = '';
  session.result = null;
  rerender();
}

function startMic(rerender) {
  session.phase = 'listening';
  session.heard = '';
  session.stop = listenOnce({
    onResult: (text) => { session.heard = text; const el = document.querySelector('.pron-target'); void el; rerender(); },
    onEnd: (finalText) => {
      session.stop = null;
      session.result = scorePronunciation(session.items[session.i].text, finalText || session.heard);
      session.phase = 'result';
      rerender();
    },
    onError: () => { session.stop = null; session.phase = 'idle'; rerender(); },
  });
  rerender();
}

function stopMic(rerender) {
  if (session && session.stop) {
    session.stop();
    session.stop = null;
  }
  if (rerender) rerender();
}
