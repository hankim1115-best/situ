import { h, mount, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getSet, appendExpressions, bumpWeakness, getWeakness } from '../store.js';
import { converseTurn, debriefConversation } from '../api.js';
import { speak, ttsSupported, sttSupported, listenOnce } from '../tts.js';

let session = null;

export function resetConverseSession() {
  session = null;
}

function build(set) {
  session = {
    setId: set.id,
    setTitle: set.title,
    situation: set.situation,
    mode: 'coach',
    transcript: [], // { who: 'user' | 'them', en, ko }
    phase: 'boot', // boot | thinking | await | debriefing | debrief | error
    input: '',
    feedback: null,
    reachedEnd: false,
    userTurns: 0,
    debrief: null,
    listening: false,
    stop: null,
    error: null,
    lastSend: null,
  };
}

export function converseView({ params }) {
  const set = getSet(params.id);
  if (!set) {
    return screen({
      title: '대화 연습',
      back: '/library',
      children: h('div', { class: 'empty' }, h('p', null, '이 대화 팩을 찾을 수 없어요.')),
    });
  }
  if (!session || session.setId !== set.id) build(set);

  const rerender = () => mount(converseView({ params }));
  const back = '/set/' + set.id;

  if (session.phase === 'boot') {
    session.phase = 'thinking';
    queueMicrotask(() => kickOff(rerender));
  }

  if (session.phase === 'debrief' && session.debrief) {
    return screen({ title: '대화 총평', back, children: debriefBody(session.debrief, set, rerender) });
  }
  if (session.phase === 'debriefing') {
    return screen({
      title: '대화 총평',
      back,
      children: h('div', { class: 'empty' }, h('div', { class: 'big' }, h('span', { class: 'spinner' })), h('p', null, '총평 만드는 중…')),
    });
  }

  // mode toggle
  const busy = session.phase === 'thinking';
  const modeCtl = h(
    'div',
    { class: 'segmented' },
    ...[['coach', '코치'], ['immersion', '몰입']].map(([v, label]) =>
      h('button', { type: 'button', 'aria-pressed': session.mode === v, disabled: busy, onClick: () => { session.mode = v; rerender(); } }, label)
    )
  );

  // transcript
  const log = h(
    'div',
    null,
    ...session.transcript.map((t) =>
      h(
        'div',
        { class: 'bubble ' + (t.who === 'user' ? 'you' : 'them') },
        h(
          'div',
          { class: 'body' },
          h('div', { class: 'row', style: 'justify-content:space-between; gap:8px;' },
            h('span', { class: 'who' }, t.who === 'user' ? '나' : '상대'),
            t.who === 'them' && ttsSupported() ? h('button', { class: 'speak', onClick: () => speak(t.en) }, '🔊') : null
          ),
          h('div', { class: 'en' }, t.en),
          t.ko ? h('div', { class: 'ko' }, t.ko) : null
        )
      )
    ),
    busy ? h('div', { class: 'bubble them' }, h('div', { class: 'body muted' }, '상대가 입력 중…')) : null
  );

  // feedback on the previous user turn (coach mode)
  const fb = session.feedback
    ? h(
        'section',
        { class: 'card fb ' + (session.feedback.rating || 'ok') },
        h('div', { class: 'row', style: 'justify-content:space-between;' },
          h('h3', { style: 'margin:0;' }, '직전 내 말 피드백'),
          h('span', { class: 'tag' }, ({ good: '자연스러움', ok: '보통', awkward: '어색' })[session.feedback.rating] || '보통')
        ),
        session.feedback.natural ? h('p', { class: 'small', style: 'margin:8px 0 0;' }, '👍 ' + session.feedback.natural) : null,
        ...(session.feedback.issues || []).map((i) => h('div', { class: 'meta', style: 'margin-top:4px;' }, `${i.type} · ${i.note}`)),
        session.feedback.rewrite
          ? h(
              'div',
              { style: 'margin-top:10px; padding-top:10px; border-top:1px solid var(--border);' },
              h('div', { class: 'small muted' }, '이렇게 말하면 더 자연스러워요'),
              h('div', { class: 'en' }, session.feedback.rewrite),
              h('div', { class: 'row', style: 'margin-top:8px;' },
                ttsSupported() ? h('button', { class: 'btn sm', onClick: () => speak(session.feedback.rewrite) }, '🔊') : null,
                h('button', { class: 'btn sm', onClick: () => { session.input = session.feedback.rewrite; session.feedback = null; rerender(); } }, '이 표현으로 고쳐 말하기')
              )
            )
          : null,
        h('button', { class: 'btn ghost sm', style: 'margin-top:10px;', onClick: () => { session.feedback = null; rerender(); } }, '계속')
      )
    : null;

  // error
  if (session.phase === 'error') {
    return screen({
      title: '대화 연습 · ' + set.title,
      back,
      children: h(
        'div',
        { class: 'stack' },
        log,
        h('section', { class: 'card' }, h('p', { class: 'small', style: 'margin:0 0 10px;' }, session.error || '오류가 발생했어요.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary sm', onClick: () => { session.lastSend ? retrySend(rerender) : kickOff(rerender); } }, '다시 시도'),
            h('button', { class: 'btn ghost sm', onClick: () => navigate(back) }, '나가기')
          )
        )
      ),
    });
  }

  // input area
  const ta = h('textarea', {
    placeholder: '영어로 답해 보세요 (또는 마이크)',
    value: session.input,
    disabled: busy,
    oninput: (e) => (session.input = e.target.value),
  });
  const micBtn = sttSupported()
    ? h('button', { class: 'btn sm', disabled: busy, onClick: () => toggleMic(rerender) }, session.listening ? '● 듣는 중… 멈추기' : '🎤 말하기')
    : null;
  const sendBtn = h('button', { class: 'btn primary', disabled: busy, onClick: () => doSend(rerender) }, '보내기');

  const endBtn =
    session.userTurns >= 1
      ? h('button', { class: 'btn ' + (session.reachedEnd ? 'primary' : 'ghost') + ' block', style: 'margin-top:4px;', onClick: () => endConversation(rerender) },
          session.reachedEnd ? '대화가 마무리됐어요 — 총평 보기' : '대화 끝내고 총평 보기')
      : null;

  const body = h(
    'div',
    { class: 'stack' },
    modeCtl,
    log,
    fb,
    session.phase === 'await'
      ? h('section', { class: 'card stack' }, ta, h('div', { class: 'row' }, micBtn, h('div', { style: 'flex:1;' }), sendBtn))
      : null,
    endBtn
  );

  return screen({ title: '대화 연습 · ' + set.title, back, children: body });
}

async function kickOff(rerender) {
  try {
    const { turn } = await converseTurn({ situation: session.situation, mode: session.mode, opener: true });
    session.transcript.push({ who: 'them', en: turn.reply, ko: turn.reply_ko });
    session.phase = 'await';
    if (ttsSupported()) speak(turn.reply);
  } catch (e) {
    session.phase = 'error';
    session.error = e.message;
  }
  rerender();
}

function doSend(rerender) {
  const latest = session.input.trim();
  if (!latest || session.phase === 'thinking') return;
  stopMic();
  const prior = session.transcript.slice();
  session.transcript.push({ who: 'user', en: latest });
  session.userTurns += 1;
  session.input = '';
  session.feedback = null;
  session.phase = 'thinking';
  session.lastSend = { prior, latest };
  rerender();
  runSend(rerender);
}

function retrySend(rerender) {
  session.phase = 'thinking';
  session.error = null;
  rerender();
  runSend(rerender);
}

async function runSend(rerender) {
  const { prior, latest } = session.lastSend;
  try {
    const { turn } = await converseTurn({
      situation: session.situation,
      transcript: prior,
      latest,
      mode: session.mode,
    });
    if (session.mode === 'coach' && turn.feedback) session.feedback = turn.feedback;
    session.transcript.push({ who: 'them', en: turn.reply, ko: turn.reply_ko });
    if (turn.done) session.reachedEnd = true;
    session.phase = 'await';
    if (ttsSupported()) speak(turn.reply);
  } catch (e) {
    session.phase = 'error';
    session.error = e.message;
  }
  rerender();
}

async function endConversation(rerender) {
  stopMic();
  session.phase = 'debriefing';
  rerender();
  try {
    const d = await debriefConversation({ situation: session.situation, transcript: session.transcript });
    bumpWeakness(d.error_tags || []);
    session.debrief = d;
    session.phase = 'debrief';
  } catch (e) {
    session.phase = 'error';
    session.error = e.message;
    session.lastSend = null; // route retry to endConversation
  }
  rerender();
}

function debriefBody(d, set, rerender) {
  const weak = getWeakness().slice(0, 6);
  return h(
    'div',
    { class: 'stack' },
    h('section', { class: 'card' }, h('h3', null, '총평'), h('p', { style: 'margin:6px 0 0;' }, d.summary || '')),
    d.fix_top?.length
      ? h('section', { class: 'card' }, h('h3', null, '먼저 고칠 것'),
          h('ol', { style: 'margin:6px 0 0; padding-left:20px;' }, ...d.fix_top.map((t) => h('li', { style: 'margin:4px 0;' }, t))))
      : null,
    d.best_rewrite && d.best_rewrite.after
      ? h('section', { class: 'card' }, h('h3', null, '한 문장 고쳐 보기'),
          h('div', { class: 'meta' }, '전: ' + (d.best_rewrite.before || '')),
          h('div', { class: 'en', style: 'margin-top:4px;' }, '후: ' + d.best_rewrite.after),
          d.best_rewrite.note ? h('div', { class: 'meta', style: 'margin-top:4px;' }, d.best_rewrite.note) : null)
      : null,
    d.strong_phrases?.length
      ? h('section', { class: 'card' }, h('h3', null, '이 표현을 썼다면'),
          ...d.strong_phrases.map((p) =>
            h('div', { class: 'line' },
              h('div', { class: 'top' }, h('div', { class: 'en' }, p.en), ttsSupported() ? h('button', { class: 'speak', onClick: () => speak(p.en) }, '🔊') : null),
              p.ko ? h('div', { class: 'ko' }, p.ko) : null)))
      : null,
    weak.length
      ? h('section', { class: 'card' }, h('h3', null, '자주 나오는 실수'),
          h('div', { class: 'chips' }, ...weak.map((w) => h('span', { class: 'chip' }, `${w.tag} ×${w.count}`))))
      : null,
    h('button', { class: 'btn primary block', onClick: () => {
        const n = appendExpressions(set.id, d.strong_phrases || []);
        toast(n ? `${n}개 표현을 복습에 추가했어요.` : '추가할 새 표현이 없어요.');
      } }, '추천 표현 복습에 저장'),
    h('button', { class: 'btn ghost block', onClick: () => { session = null; mount(converseView({ params: { id: set.id } })); } }, '다시 연습'),
    h('button', { class: 'btn ghost block', onClick: () => navigate('/set/' + set.id) }, '나가기')
  );
}

// ---- mic ----
function toggleMic(rerender) {
  if (session.listening) {
    stopMic();
    rerender();
    return;
  }
  session.listening = true;
  session.stop = listenOnce({
    onResult: (text) => {
      session.input = text;
      const ta = document.querySelector('textarea');
      if (ta) ta.value = text;
    },
    onEnd: () => { session.listening = false; session.stop = null; rerender(); },
    onError: () => { session.listening = false; session.stop = null; rerender(); },
  });
  rerender();
}
function stopMic() {
  if (session && session.stop) {
    session.stop();
    session.stop = null;
    session.listening = false;
  }
}
