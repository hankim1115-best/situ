import { h, mount, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { addPolish, getPolishLog } from '../store.js';
import { polishUtterance } from '../api.js';
import { speak, ttsSupported, sttSupported, listenOnce } from '../tts.js';

let session = null;

export function resetPolishView() {
  session = null;
}

function build() {
  session = { text: '', context: '', result: null, phase: 'idle', error: null, listening: false, stop: null };
}

export function polishView() {
  if (!session) build();
  const rerender = () => mount(polishView());
  const busy = session.phase === 'thinking';

  const contextInput = h('input', {
    type: 'text',
    placeholder: '무슨 상황에서 한 말인가요? (선택)',
    value: session.context,
    oninput: (e) => (session.context = e.target.value),
  });

  const ta = h('textarea', {
    placeholder: '영어로 말하거나 입력하세요',
    value: session.text,
    disabled: busy,
    oninput: (e) => (session.text = e.target.value),
  });

  const micBtn = sttSupported()
    ? h('button', { class: 'btn sm', disabled: busy, onClick: () => toggleMic(rerender) }, session.listening ? '● 듣는 중… 멈추기' : '🎤 말하기')
    : null;

  const runBtn = h('button', { class: 'btn primary', disabled: busy, onClick: () => doPolish(rerender) },
    busy ? '' : '다듬기');
  if (busy) runBtn.append(h('span', { class: 'spinner' }), document.createTextNode(' 다듬는 중…'));

  const cards = [];
  if (session.phase === 'error') {
    cards.push(
      h('section', { class: 'card' },
        h('p', { class: 'small', style: 'margin:0 0 10px;' }, session.error || '오류가 발생했어요.'),
        h('button', { class: 'btn sm', onClick: () => doPolish(rerender) }, '다시 시도'))
    );
  }

  const r = session.result;
  if (r) {
    cards.push(
      h('section', { class: 'card stack' },
        h('h3', null, '다듬은 문장'),
        h('div', { class: 'pron-target' }, r.cleaned),
        r.meaning_ko ? h('div', { class: 'muted small' }, r.meaning_ko) : null,
        r.register_note ? h('div', { class: 'meta' }, '톤 · ' + r.register_note) : null,
        h('div', { class: 'row' },
          ttsSupported() ? h('button', { class: 'btn sm', onClick: () => speak(r.cleaned) }, '🔊 듣기') : null,
          h('button', { class: 'btn sm', onClick: () => copy(r.cleaned) }, '복사')))
    );

    cards.push(
      h('section', { class: 'card' },
        h('h3', null, '고칠 부분'),
        r.issues && r.issues.length
          ? h('div', null, ...r.issues.map((i) =>
              h('div', { class: 'line' },
                h('div', { class: 'top' }, h('div', { class: 'en' }, '“' + i.span + '”'), h('span', { class: 'tag' }, i.type || '')),
                h('div', { class: 'ko' }, i.problem || ''),
                i.fix ? h('div', { class: 'meta' }, '→ ' + i.fix) : null)))
          : h('p', { class: 'small muted', style: 'margin:0;' }, '문법상 큰 문제는 없어요. 아래 표현을 참고하세요.'))
    );

    if (r.better && r.better.length) {
      cards.push(
        h('section', { class: 'card' },
          h('h3', null, '더 나은 표현'),
          ...r.better.map((b) =>
            h('div', { class: 'line' },
              h('div', { class: 'top' }, h('div', { class: 'en' }, b.en), ttsSupported() ? h('button', { class: 'speak', onClick: () => speak(b.en) }, '🔊') : null),
              b.ko ? h('div', { class: 'ko' }, b.ko) : null,
              b.note ? h('div', { class: 'meta' }, b.note) : null)))
      );
    }
  }

  const log = getPolishLog();
  const history = log.length
    ? h('details', { class: 'raw' },
        h('summary', { class: 'muted small' }, `최근 다듬기 ${log.length}개`),
        h('div', { class: 'stack', style: 'margin-top:8px;' },
          ...log.slice(0, 12).map((e) =>
            h('div', { class: 'line' },
              h('div', { class: 'meta' }, e.text),
              h('div', { class: 'en', style: 'font-size:14px;' }, e.cleaned)))))
    : null;

  const body = h('div', { class: 'stack' },
    h('p', { class: 'small muted', style: 'margin:0 2px;' }, '내가 한 영어를 문장으로 정리하고, 틀린 곳을 짚어 더 나은 표현을 알려줍니다.'),
    contextInput,
    ta,
    h('div', { class: 'row' }, micBtn, h('div', { style: 'flex:1;' }), runBtn),
    ...cards,
    history
  );

  return screen({ title: '말 다듬기', back: '/', children: body });
}

async function doPolish(rerender) {
  const text = session.text.trim();
  if (!text) { toast('다듬을 말을 입력하세요.'); return; }
  stopMic();
  session.phase = 'thinking';
  session.error = null;
  rerender();
  try {
    const data = await polishUtterance({ text, context: session.context });
    session.result = data;
    addPolish({ text, cleaned: data.cleaned });
    session.phase = 'idle';
  } catch (e) {
    console.error(e);
    session.phase = 'error';
    session.error = e.message;
  }
  rerender();
}

async function copy(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    toast('복사했어요.');
  } catch {
    toast('복사가 안 됐어요. 길게 눌러 선택하세요.', 3000);
  }
}

function toggleMic(rerender) {
  if (session.listening) { stopMic(); rerender(); return; }
  session.listening = true;
  session.stop = listenOnce({
    onResult: (t) => {
      session.text = t;
      const el = document.querySelector('main textarea');
      if (el) el.value = t;
    },
    onEnd: () => { session.listening = false; session.stop = null; rerender(); },
    onError: () => { session.listening = false; session.stop = null; rerender(); },
  });
  rerender();
}
function stopMic() {
  if (session && session.stop) { session.stop(); session.stop = null; session.listening = false; }
}
