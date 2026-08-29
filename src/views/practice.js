import { h, mount } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getSet } from '../store.js';
import { speak, ttsSupported, sttSupported, listenOnce } from '../tts.js';

let session = null;

export function resetPracticeSession() {
  session = null;
}

function build(setId, dialogue) {
  session = { setId, dialogue, t: 0, revealed: false, attempt: '', listening: false, stop: null };
}

export function practiceView({ params }) {
  const set = getSet(params.id);
  if (!set || !(set.pack.dialogue || []).length) {
    return screen({
      title: '역할극',
      back: set ? '/set/' + params.id : '/library',
      children: h('div', { class: 'empty' }, h('p', null, '이 대화 팩에는 예시 대화가 없어요.')),
    });
  }

  const dialogue = set.pack.dialogue;
  if (!session || session.setId !== set.id) build(set.id, dialogue);

  const back = '/set/' + set.id;

  if (session.t >= dialogue.length) {
    return screen({
      title: '역할극',
      back,
      children: h(
        'div',
        { class: 'empty' },
        h('div', { class: 'big' }, '🎬'),
        h('p', null, '대화 연습 완료!'),
        h(
          'div',
          { class: 'row', style: 'justify-content:center; margin-top:12px;' },
          h('button', { class: 'btn', onClick: () => { session = null; mount(practiceView({ params })); } }, '다시 하기'),
          h('button', { class: 'btn ghost', onClick: () => navigate(back) }, '끝내기')
        )
      ),
    });
  }

  const turn = dialogue[session.t];
  const isYou = turn.speaker === 'You';
  const progress = `${session.t + 1} / ${dialogue.length}`;

  // history (previous turns, compact)
  const history = h(
    'div',
    null,
    ...dialogue.slice(0, session.t).map((tn) =>
      h(
        'div',
        { class: 'bubble ' + (tn.speaker === 'You' ? 'you' : 'them') },
        h('div', { class: 'body' }, h('div', { class: 'who' }, tn.speaker === 'You' ? '나' : '상대'), h('div', null, tn.en))
      )
    )
  );

  let current;
  if (!isYou) {
    current = h(
      'section',
      { class: 'card' },
      h('div', { class: 'who', style: 'margin-bottom:4px;' }, '상대'),
      h('div', { class: 'en', style: 'font-size:18px;' }, turn.en),
      turn.ko ? h('div', { class: 'ko' }, turn.ko) : null,
      h(
        'div',
        { class: 'row', style: 'margin-top:12px;' },
        ttsSupported() ? h('button', { class: 'btn sm', onClick: () => speak(turn.en) }, '🔊 다시 듣기') : null,
        h('button', { class: 'btn primary sm', onClick: next }, '다음 ›')
      )
    );
    if (ttsSupported()) speak(turn.en);
  } else {
    const ta = h('textarea', {
      placeholder: '영어로 말해 보세요 (또는 마이크 사용)',
      value: session.attempt,
      oninput: (e) => (session.attempt = e.target.value),
    });

    const micBtn = sttSupported()
      ? h(
          'button',
          { class: 'btn sm', onClick: toggleMic },
          session.listening ? '● 듣는 중… 멈추기' : '🎤 말하기'
        )
      : null;

    current = h(
      'section',
      { class: 'card' },
      h('div', { class: 'who', style: 'margin-bottom:4px;' }, '내 차례'),
      turn.ko ? h('div', { class: 'muted small', style: 'margin-bottom:8px;' }, '목표 뜻: ' + turn.ko) : null,
      ta,
      h('div', { class: 'row', style: 'margin-top:10px;' }, micBtn),
      session.revealed
        ? h(
            'div',
            { style: 'margin-top:12px; padding-top:12px; border-top:1px solid var(--border);' },
            h('div', { class: 'small muted' }, '제안 표현'),
            h('div', { class: 'en', style: 'font-size:17px;' }, turn.en),
            ttsSupported() ? h('button', { class: 'btn sm', style: 'margin-top:8px;', onClick: () => speak(turn.en) }, '🔊 듣기') : null
          )
        : null,
      h(
        'div',
        { class: 'row', style: 'margin-top:12px;' },
        !session.revealed
          ? h('button', { class: 'btn sm', style: 'flex:1;', onClick: reveal }, '제안 표현 보기')
          : null,
        h('button', { class: 'btn primary sm', style: 'flex:1;', onClick: next }, '다음 ›')
      )
    );
  }

  const body = h(
    'div',
    { class: 'stack' },
    h('div', { class: 'center muted small' }, progress),
    history,
    current
  );

  return screen({ title: '역할극 · ' + set.title, back, children: body });

  function reveal() {
    session.revealed = true;
    mount(practiceView({ params }));
  }

  function next() {
    if (session.stop) { session.stop(); session.stop = null; }
    session.t += 1;
    session.revealed = false;
    session.attempt = '';
    session.listening = false;
    mount(practiceView({ params }));
  }

  function toggleMic() {
    if (session.listening) {
      session.stop && session.stop();
      session.stop = null;
      session.listening = false;
      mount(practiceView({ params }));
      return;
    }
    session.listening = true;
    session.stop = listenOnce({
      onResult: (text) => {
        session.attempt = text;
        const ta = document.querySelector('textarea');
        if (ta) ta.value = text;
      },
      onEnd: () => {
        session.listening = false;
        session.stop = null;
        mount(practiceView({ params }));
      },
      onError: () => {
        session.listening = false;
        session.stop = null;
        mount(practiceView({ params }));
      },
    });
    mount(practiceView({ params }));
  }
}
