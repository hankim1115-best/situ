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
- Korean fields must be written in Korean. English fields in English.
- When a learner profile is provided, personalize everything to that person:
  the suggested answers ("A." lines, their_questions answers) must be built from
  the learner's real background — job, target role, family, city, immigration
  stream — not a generic invented persona. "their_questions" must be the
  questions THIS person would actually be asked in this situation.`;

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

const PROFILE_LABELS = {
  role: '현재 직무/경력',
  targetRole: '캐나다 목표 직무',
  industry: '업계',
  immigrationStream: '이민 스트림',
  city: '정착 예정 도시',
  family: '가족 상황',
  englishLevel: '영어 레벨',
  weakSpots: '내가 아는 내 약점',
  extra: '기타 배경',
};

// Renders the filled learner-profile fields into a labelled Korean block.
export function profileBlock(profile) {
  if (!profile) return '';
  const rows = Object.entries(PROFILE_LABELS)
    .filter(([k]) => profile[k] && String(profile[k]).trim())
    .map(([k, label]) => `- ${label}: ${String(profile[k]).trim()}`);
  if (!rows.length) return '';
  return ['[학습자 프로필 — 답변과 예상 질문을 이 사람에 맞게]', ...rows].join('\n');
}

function situationLines(input) {
  const depth = (input.depth && input.depth.length ? input.depth : ['스몰토크', '실무', '진지한 대화']).join(', ');
  const lines = [
    `상황/주제: ${input.text.trim()}`,
    input.partner ? `대화 상대: ${input.partner}` : null,
    `원하는 톤: ${FORMALITY_LABEL[input.formality] || FORMALITY_LABEL.neutral}`,
    `다뤄야 할 깊이: ${depth}`,
    input.goal ? `내가 바라는 결과: ${input.goal.trim()}` : null,
  ].filter(Boolean);
  const pb = profileBlock(input.profile);
  if (pb) lines.push('', pb);
  return lines;
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

// ===================== Live adaptive conversation =====================

export const CONVERSE_SYSTEM = `You run a LIVE English role-play for a Korean speaker preparing for life in
Canada. Play the OTHER person in the given situation — natural current Canadian
English, realistic, 1–3 sentences per turn, never a monologue. Stay in role and
keep the conversation moving toward the learner's goal.

Each turn, call respond_and_coach:
- reply / reply_ko: your next in-character line and a natural Korean gloss.
- feedback: coaching on the learner's LAST message. Omit the whole feedback
  object in 몰입(immersion) mode. Otherwise be concise and write it in Korean:
  set heard_cleaned to their message written out as one clean correct sentence,
  praise what sounded natural, flag Korean-transfer errors (articles,
  prepositions, tense, over-formality, word-for-word translation, unnatural word
  choice, word order), and give ONE improved rewrite of their line in English.
- done: true once the conversation has reached a natural close.

Use the learner profile so the scenario and your questions fit this specific
person.`;

export const CONVERSE_TOOL = {
  name: 'respond_and_coach',
  description: 'Reply in character and coach the learner on their last message.',
  input_schema: {
    type: 'object',
    required: ['reply', 'reply_ko', 'done'],
    properties: {
      reply: { type: 'string' },
      reply_ko: { type: 'string' },
      feedback: {
        type: 'object',
        required: ['rating', 'natural', 'rewrite'],
        properties: {
          heard_cleaned: {
            type: 'string',
            description: "The learner's last message written out as one clean, correct sentence (faithful to intent). Helps them see if a problem was pronunciation/STT or wording.",
          },
          rating: { type: 'string', enum: ['good', 'ok', 'awkward'] },
          natural: { type: 'string', description: 'Korean: what the learner did well this turn.' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type', 'note'],
              properties: {
                type: { type: 'string', description: 'Short Korean tag: 관사, 전치사, 시제, 격식, 직역, 어휘, 어순 …' },
                note: { type: 'string', description: 'Korean, one line.' },
              },
            },
          },
          rewrite: { type: 'string', description: "A more natural English version of the learner's last message." },
        },
      },
      done: { type: 'boolean' },
    },
  },
};

export const DEBRIEF_TOOL = {
  name: 'debrief_conversation',
  description: 'Summarize the finished role-play and give the learner priorities.',
  input_schema: {
    type: 'object',
    required: ['summary', 'fix_top', 'strong_phrases', 'error_tags'],
    properties: {
      summary: { type: 'string', description: 'Korean, 2–3 sentences: overall how it went.' },
      fix_top: {
        type: 'array',
        items: { type: 'string' },
        description: 'Korean, top 3 things to fix, most important first.',
      },
      strong_phrases: {
        type: 'array',
        description: '3 English phrases the learner could have used well in this conversation.',
        items: {
          type: 'object',
          required: ['en', 'ko'],
          properties: { en: { type: 'string' }, ko: { type: 'string' } },
        },
      },
      best_rewrite: {
        type: 'object',
        properties: {
          before: { type: 'string' },
          after: { type: 'string' },
          note: { type: 'string', description: 'Korean.' },
        },
      },
      error_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Korean tags for recurring mistakes in this conversation (관사, 전치사, 직역 …).',
      },
    },
  },
};

function scenarioHeader(situation, profile) {
  const lines = [
    `상황: ${(situation.text || '').trim()}`,
    situation.partner ? `상대(당신이 연기할 역할): ${situation.partner}` : null,
    situation.formality ? `톤: ${FORMALITY_LABEL[situation.formality] || FORMALITY_LABEL.neutral}` : null,
    situation.goal ? `학습자의 목표: ${situation.goal.trim()}` : null,
  ].filter(Boolean);
  const pb = profileBlock(profile);
  if (pb) lines.push('', pb);
  return lines.join('\n');
}

export function buildConverseMessage({ situation, profile, transcript = [], mode, latest, opener }) {
  const lines = [scenarioHeader(situation, profile), ''];
  lines.push(mode === 'immersion' ? '모드: 몰입 — 이번 응답에서 feedback 객체를 생략하세요.' : '모드: 코치 — feedback 포함.', '');
  if (opener) {
    lines.push('아직 대화가 시작되지 않았습니다. 상대(당신)가 먼저 자연스럽게 말을 겁니다. 이번 턴은 feedback을 생략하세요.');
  } else {
    lines.push('지금까지 대화:');
    for (const t of transcript) lines.push(`${t.who === 'user' ? '학습자' : '상대'}: ${t.en}`);
    lines.push('', `학습자가 방금 한 말: "${latest}"`, '', 'respond_and_coach로 이어서 응답하세요.');
  }
  return lines.join('\n');
}

export function buildDebriefMessage({ situation, profile, transcript = [] }) {
  const lines = [scenarioHeader(situation, profile), '', '완료된 대화 전체:'];
  for (const t of transcript) lines.push(`${t.who === 'user' ? '학습자' : '상대'}: ${t.en}`);
  lines.push('', 'debrief_conversation으로 이 대화를 총평해 주세요.');
  return lines.join('\n');
}

// ===================== Polish (clean up + correct + upgrade an utterance) =====================

export const POLISH_SYSTEM = `You help a Korean speaker learning English for life in Canada turn what they
just said (often messy speech-to-text) into correct, natural English, and show
them how to say it better.

Via polish_utterance:
- cleaned: their utterance written out as correct, natural sentence(s). Stay
  faithful to what they meant — fix grammar, word choice, and obvious
  speech-to-text noise, but do NOT add new ideas or inflate the message.
- meaning_ko: what "cleaned" means, in Korean, so they can confirm it matches
  their intent.
- issues: each real error in the ORIGINAL — the exact wrong span, a short Korean
  category tag (관사, 전치사, 시제, 어순, 어휘, 직역, 관용표현, 단복수 …), a
  one-line Korean explanation, and the corrected fragment in English. Empty
  array if the original was already fine.
- better: 2–3 stronger versions, from a safe upgrade to how a fluent Canadian
  speaker would actually put it. Each with a Korean gloss and a short Korean note
  on nuance / when to use it.
- register_note: Korean, only if tone/formality is worth flagging for the
  given context.
Canadian English. English fields in English, Korean fields in Korean.`;

export const POLISH_TOOL = {
  name: 'polish_utterance',
  description: "Clean up the learner's spoken English, flag errors, suggest better phrasing.",
  input_schema: {
    type: 'object',
    required: ['cleaned', 'meaning_ko', 'issues', 'better'],
    properties: {
      cleaned: { type: 'string' },
      meaning_ko: { type: 'string' },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['span', 'type', 'problem', 'fix'],
          properties: {
            span: { type: 'string', description: 'The exact wrong part of the original.' },
            type: { type: 'string', description: 'Short Korean category tag.' },
            problem: { type: 'string', description: 'Korean, one line — what is wrong and why.' },
            fix: { type: 'string', description: 'The corrected fragment, in English.' },
          },
        },
      },
      better: {
        type: 'array',
        items: {
          type: 'object',
          required: ['en', 'ko'],
          properties: {
            en: { type: 'string' },
            ko: { type: 'string' },
            note: { type: 'string', description: 'Korean: nuance / when to use.' },
          },
        },
      },
      register_note: { type: 'string' },
    },
  },
};

export function buildPolishMessage({ text, context, profile }) {
  const lines = [`학습자가 한 말 (음성 인식 결과일 수 있음): "${(text || '').trim()}"`];
  if (context && context.trim()) lines.push(`상황/의도: ${context.trim()}`);
  const pb = profileBlock(profile);
  if (pb) lines.push('', pb);
  lines.push('', 'polish_utterance로 다듬은 문장 · 오류 지적 · 더 나은 표현을 주세요.');
  return lines.join('\n');
}
