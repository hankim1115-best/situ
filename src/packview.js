// Renders a conversation pack into a list of cards. Shared by the result
// screen and saved-set detail.

import { h } from './ui.js';
import { speak, ttsSupported } from './tts.js';

const REG_LABEL = { casual: '캐주얼', neutral: '보통', formal: '격식' };

function speakBtn(text) {
  if (!ttsSupported() || !text) return null;
  return h('button', { class: 'speak', title: '소리 듣기', onClick: () => speak(text) }, '🔊');
}

function enLine(en, ko, meta) {
  return h(
    'div',
    { class: 'line' },
    h('div', { class: 'top' }, h('div', { class: 'en' }, en), speakBtn(en)),
    ko ? h('div', { class: 'ko' }, ko) : null,
    meta ? h('div', { class: 'meta' }, meta) : null
  );
}

function card(title, ...children) {
  return h('section', { class: 'card' }, h('h3', null, title), ...children.filter(Boolean));
}

function list(items) {
  return h('ul', { style: 'margin:6px 0 0; padding-left:18px;' }, ...items.map((t) => h('li', { style: 'margin:4px 0;' }, t)));
}

export function renderPack(pack) {
  const cards = [];

  if (pack.keywords?.length) {
    cards.push(
      card(
        '학습한 키워드',
        ...pack.keywords.map((k) =>
          enLine(
            k.term,
            k.ko,
            [k.pos, k.example_en].filter(Boolean).join(' · ')
          )
        )
      )
    );
  }

  if (pack.situation_read) {
    cards.push(card('상황 읽기', h('p', { style: 'margin:6px 0 0;' }, pack.situation_read)));
  }

  if (pack.smalltalk_openers?.length) {
    cards.push(card('스몰토크 오프너', ...pack.smalltalk_openers.map((o) => enLine(o.en, o.ko))));
  }

  if (pack.expressions?.length) {
    cards.push(
      card(
        '핵심 표현',
        ...pack.expressions.map((e) =>
          enLine(
            e.en,
            e.ko,
            [e.register ? REG_LABEL[e.register] || e.register : null, e.when].filter(Boolean).join(' · ')
          )
        )
      )
    );
  }

  if (pack.dialogue?.length) {
    cards.push(
      card(
        '예시 대화',
        h(
          'div',
          null,
          ...pack.dialogue.map((turn) => {
            const you = turn.speaker === 'You';
            return h(
              'div',
              { class: 'bubble ' + (you ? 'you' : 'them') },
              h(
                'div',
                { class: 'body' },
                h('div', { class: 'row', style: 'justify-content:space-between; gap:8px;' }, h('span', { class: 'who' }, you ? '나' : '상대'), speakBtn(turn.en)),
                h('div', { class: 'en' }, turn.en),
                turn.ko ? h('div', { class: 'ko' }, turn.ko) : null
              )
            );
          })
        )
      )
    );
  }

  if (pack.their_questions?.length) {
    cards.push(
      card(
        '상대가 물어볼 것 · 대답',
        ...pack.their_questions.map((q) =>
          h(
            'div',
            { class: 'line' },
            h('div', { class: 'top' }, h('div', { class: 'en' }, 'Q. ' + q.q_en), speakBtn(q.q_en)),
            q.q_ko ? h('div', { class: 'ko' }, q.q_ko) : null,
            h('div', { class: 'top', style: 'margin-top:8px;' }, h('div', { class: 'en' }, 'A. ' + q.a_en), speakBtn(q.a_en)),
            q.a_ko ? h('div', { class: 'ko' }, q.a_ko) : null,
            q.tip ? h('div', { class: 'meta' }, '💡 ' + q.tip) : null
          )
        )
      )
    );
  }

  if (pack.escalation?.length) {
    cards.push(
      card(
        '더 깊은 대화로',
        ...pack.escalation.map((e) => enLine(e.en, e.ko, e.note || null))
      )
    );
  }

  if (pack.vocab?.length) {
    cards.push(
      card(
        '단어 · 표현',
        ...pack.vocab.map((v) =>
          enLine(v.term, v.ko, v.example || null)
        )
      )
    );
  }

  if (pack.pronunciation?.length) {
    cards.push(
      card(
        '발음 주의',
        ...pack.pronunciation.map((p) => enLine(p.word, p.ko))
      )
    );
  }

  if (pack.culture_notes?.length) {
    cards.push(card('캐나다 문화 노트', list(pack.culture_notes)));
  }

  if (pack.practice_next?.length) {
    cards.push(card('다음에 연습할 상황', list(pack.practice_next)));
  }

  return cards;
}
