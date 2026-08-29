// Prompt + structured-output schema for the conversation pack.

export const SYSTEM = `You are Situ, an English conversation coach for a Korean speaker who is
preparing to immigrate to Canada in about two years and wants to handle real
immigration, job-search, and workplace situations there.

The user gives you a situation or topic they want to be able to talk about in
English. Produce a practical "conversation pack" via the build_pack tool.

Principles:
- Canadian English and Canadian norms (politeness, indirectness, small talk,
  workplace culture, tipping, healthcare, tenancy, immigration interviews).
- Natural spoken phrasing that real people use today — not textbook English.
- Cover the whole range the user asked for, from light small talk to the
  serious / decisive part of the conversation.
- Every English item gets a natural Korean rendering (not word-for-word).
- Always include what the OTHER person is likely to say and how to respond.
- Call out pitfalls specific to Korean speakers (pronunciation, over-formality,
  direct translations that sound rude, missing articles, intonation).
- Keep each English line short enough to actually say out loud.
- Korean fields must be written in Korean. English fields in English.`;

export const TOOL = {
  name: 'build_pack',
  description: 'Return a structured English conversation pack for the given situation.',
  input_schema: {
    type: 'object',
    required: [
      'title',
      'situation_read',
      'expressions',
      'dialogue',
      'their_questions',
      'escalation',
      'vocab',
      'culture_notes',
      'practice_next',
    ],
    properties: {
      title: { type: 'string', description: 'Short label for saving/listing. Korean, <= 6 words.' },
      situation_read: {
        type: 'string',
        description:
          '2-4 sentences in Korean: what is culturally at stake in Canada here, and what tone to aim for.',
      },
      smalltalk_openers: {
        type: 'array',
        description: '3-5 natural ways to open or warm up this conversation.',
        items: {
          type: 'object',
          required: ['en', 'ko'],
          properties: { en: { type: 'string' }, ko: { type: 'string' } },
        },
      },
      expressions: {
        type: 'array',
        description: '8-14 lines the user can say, ordered from lighter to more serious.',
        items: {
          type: 'object',
          required: ['en', 'ko', 'register', 'when'],
          properties: {
            en: { type: 'string' },
            ko: { type: 'string' },
            register: { type: 'string', enum: ['casual', 'neutral', 'formal'] },
            when: { type: 'string', description: 'Korean: when / why to use this line.' },
          },
        },
      },
      dialogue: {
        type: 'array',
        description: 'A realistic 8-16 turn sample exchange for this situation.',
        items: {
          type: 'object',
          required: ['speaker', 'en', 'ko'],
          properties: {
            speaker: { type: 'string', enum: ['You', 'Them'] },
            en: { type: 'string' },
            ko: { type: 'string' },
          },
        },
      },
      their_questions: {
        type: 'array',
        description: '5-8 questions the other person is likely to ask, with strong answers.',
        items: {
          type: 'object',
          required: ['q_en', 'q_ko', 'a_en', 'a_ko'],
          properties: {
            q_en: { type: 'string' },
            q_ko: { type: 'string' },
            a_en: { type: 'string' },
            a_ko: { type: 'string' },
            tip: { type: 'string', description: 'Optional Korean tip.' },
          },
        },
      },
      escalation: {
        type: 'array',
        description:
          '3-6 phrases to take the conversation to a deeper / harder / more serious level (disagreeing, negotiating, pushing back politely, closing).',
        items: {
          type: 'object',
          required: ['en', 'ko'],
          properties: {
            en: { type: 'string' },
            ko: { type: 'string' },
            note: { type: 'string', description: 'Optional Korean note.' },
          },
        },
      },
      vocab: {
        type: 'array',
        description: '6-12 key words/phrases worth memorizing for this topic.',
        items: {
          type: 'object',
          required: ['term', 'ko'],
          properties: {
            term: { type: 'string' },
            ko: { type: 'string' },
            example: { type: 'string', description: 'Optional short English example sentence.' },
          },
        },
      },
      pronunciation: {
        type: 'array',
        description: '3-6 words from this pack that Korean speakers commonly mispronounce.',
        items: {
          type: 'object',
          required: ['word', 'ko'],
          properties: {
            word: { type: 'string' },
            ko: { type: 'string', description: 'Korean guidance on the sound / stress / common mistake.' },
          },
        },
      },
      culture_notes: {
        type: 'array',
        description: '3-6 Canada-specific etiquette points and Korean-speaker pitfalls. Korean.',
        items: { type: 'string' },
      },
      practice_next: {
        type: 'array',
        description: '3-5 follow-up situations to practice next. Korean.',
        items: { type: 'string' },
      },
    },
  },
};

const FORMALITY_LABEL = {
  casual: '캐주얼하게 (친구/동료끼리 편한 톤)',
  neutral: '보통 (정중하지만 자연스러운 톤)',
  formal: '격식 있게 (공식적인 자리, 면접, 관공서)',
};

function situationLines(input) {
  const depth = (input.depth && input.depth.length ? input.depth : ['스몰토크', '실무', '진지한 대화']).join(', ');
  return [
    `상황/주제: ${input.text.trim()}`,
    input.partner ? `대화 상대: ${input.partner}` : null,
    `원하는 톤: ${FORMALITY_LABEL[input.formality] || FORMALITY_LABEL.neutral}`,
    `다뤄야 할 깊이: ${depth}`,
    input.goal ? `내가 바라는 결과: ${input.goal.trim()}` : null,
  ].filter(Boolean);
}

export function buildUserMessage(input) {
  const lines = situationLines(input);
  const studied = (input.keywords || []).map((k) => k.term || k).filter(Boolean);
  if (studied.length) {
    lines.push('', '내가 미리 공부한 키워드 (대화에 자연스럽게 녹여 주세요): ' + studied.join(', '));
  }
  lines.push(
    '',
    '위 상황을 캐나다에서 영어로 잘 해내도록, build_pack 도구로 대화 팩을 만들어 주세요.',
    '표현은 가벼운 것부터 진지한 것 순서로 배열하고, 상대가 할 법한 말과 대응도 반드시 포함하세요.'
  );
  return lines.join('\n');
}

export const KEYWORDS_SYSTEM = `You are Situ, an English vocabulary coach for a Korean speaker preparing to
immigrate to Canada in about two years (immigration, local job search,
workplace life).

Given a situation or topic, return — via the build_keywords tool — the key
English words and set phrases the learner should study BEFORE trying to have
that conversation. Pick the vocabulary that actually unlocks the situation:
words they will hear or need to say, Canada-specific terms, and phrases whose
meaning a dictionary alone would not make usable. Order by importance.

- Natural, current, spoken usage — not rare or bookish words.
- Every English field in English; every Korean field in Korean.
- Give one short, situation-relevant example sentence per word.
- Flag pronunciation / stress traps for Korean speakers where relevant.`;

export const KEYWORDS_TOOL = {
  name: 'build_keywords',
  description: 'Return the key English vocabulary to study before this conversation.',
  input_schema: {
    type: 'object',
    required: ['title', 'keywords'],
    properties: {
      title: { type: 'string', description: 'Short label for saving/listing. Korean, <= 6 words.' },
      note: {
        type: 'string',
        description: '1-2 sentences in Korean: how this vocabulary set matters for the situation.',
      },
      keywords: {
        type: 'array',
        description: '10-16 words or set phrases, most important first.',
        items: {
          type: 'object',
          required: ['term', 'ko', 'example_en', 'example_ko'],
          properties: {
            term: { type: 'string' },
            ko: { type: 'string' },
            pos: { type: 'string', description: 'Short type label, Korean ok (명사, 동사, 표현 …).' },
            example_en: { type: 'string' },
            example_ko: { type: 'string' },
            pron: { type: 'string', description: 'Korean: pronunciation / stress tip or common Korean-speaker mistake.' },
            why: { type: 'string', description: 'Korean: why this word matters in this situation.' },
          },
        },
      },
    },
  },
};

export function buildKeywordsMessage(input) {
  const lines = situationLines(input);
  lines.push(
    '',
    '이 상황을 영어로 하기 전에 먼저 외워 두면 좋은 핵심 단어·표현을 build_keywords 도구로 정리해 주세요.',
    '중요한 순서대로, 상황에서 실제로 쓰이는 어휘 위주로요.'
  );
  return lines.join('\n');
}
