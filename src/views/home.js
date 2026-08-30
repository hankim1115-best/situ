import { h, mount, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getSettings, setDraft, profileFilled } from '../store.js';
import { generatePack, generateKeywords } from '../api.js';

const PARTNERS = [
  '이민관 (visa officer)',
  '채용 담당자',
  '직속 매니저',
  '새 동료',
  '집주인 / 부동산 중개인',
  '병원 접수처 / 의사',
  '은행 직원',
  '이웃',
  '고객',
];

const DEPTHS = ['스몰토크', '실무 대화', '진지한 대화'];

const PRESETS = [
  { label: '이민 인터뷰', text: '캐나다 영주권 인터뷰에서 나의 이민 경위와 정착 계획을 설명하기', partner: '이민관 (visa officer)', formality: 'formal', depth: ['진지한 대화'] },
  { label: '채용 면접', text: '캐나다 회사 면접에서 경력과 강점을 소개하고 역질문하기', partner: '채용 담당자', formality: 'formal', depth: ['실무 대화', '진지한 대화'] },
  { label: '매니저 1:1', text: '매니저와 첫 1:1 미팅에서 업무 진행 상황과 어려움을 공유하기', partner: '직속 매니저', formality: 'neutral', depth: ['실무 대화'] },
  { label: '동료와 스몰토크', text: '점심시간에 새 동료와 주말·취미·날씨로 가볍게 대화하기', partner: '새 동료', formality: 'casual', depth: ['스몰토크'] },
  { label: '집 구하기', text: '렌트할 집을 보러 가서 조건을 묻고 계약을 협의하기', partner: '집주인 / 부동산 중개인', formality: 'neutral', depth: ['실무 대화', '진지한 대화'] },
  { label: '병원 예약', text: '가정의에게 전화로 증상을 설명하고 진료 예약 잡기', partner: '병원 접수처 / 의사', formality: 'neutral', depth: ['실무 대화'] },
];

const form = {
  text: '',
  partner: '',
  formality: 'neutral',
  depth: ['스몰토크', '실무 대화', '진지한 대화'],
  goal: '',
};

export function homeView() {
  const hasKey = !!getSettings().apiKey;

  const textarea = h('textarea', {
    placeholder: '예: 새 팀에 합류한 첫날, 팀원들에게 나를 소개하고 자연스럽게 대화 나누기',
    value: form.text,
    oninput: (e) => (form.text = e.target.value),
  });

  const partnerInput = h('input', {
    type: 'text',
    placeholder: '대화 상대 (선택) — 예: 직속 매니저',
    value: form.partner,
    oninput: (e) => (form.partner = e.target.value),
  });

  const partnerChips = h(
    'div',
    { class: 'chips' },
    ...PARTNERS.map((p) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': form.partner === p,
          onClick: () => {
            form.partner = form.partner === p ? '' : p;
            partnerInput.value = form.partner;
            rerender();
          },
        },
        p
      )
    )
  );

  const formalityCtl = h(
    'div',
    { class: 'segmented' },
    ...[
      ['casual', '캐주얼'],
      ['neutral', '보통'],
      ['formal', '격식'],
    ].map(([v, label]) =>
      h(
        'button',
        {
          type: 'button',
          'aria-pressed': form.formality === v,
          onClick: () => {
            form.formality = v;
            rerender();
          },
        },
        label
      )
    )
  );

  const depthChips = h(
    'div',
    { class: 'chips' },
    ...DEPTHS.map((d) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': form.depth.includes(d),
          onClick: () => {
            form.depth = form.depth.includes(d) ? form.depth.filter((x) => x !== d) : [...form.depth, d];
            rerender();
          },
        },
        d
      )
    )
  );

  const goalInput = h('input', {
    type: 'text',
    placeholder: '내가 바라는 결과 (선택) — 예: 연봉 협상 여지 확인하기',
    value: form.goal,
    oninput: (e) => (form.goal = e.target.value),
  });

  const presetRow = h(
    'div',
    { class: 'chips' },
    ...PRESETS.map((p) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          onClick: () => {
            form.text = p.text;
            form.partner = p.partner;
            form.formality = p.formality;
            form.depth = [...p.depth];
            form.goal = '';
            rerender();
          },
        },
        p.label
      )
    )
  );

  const genBtn = h('button', { class: 'btn primary block', type: 'button', onClick: onGenerate }, '대화 팩 만들기');
  const kwBtn = h('button', { class: 'btn ghost block', type: 'button', onClick: onKeywords }, '키워드 먼저 공부');

  const keyNotice = hasKey
    ? null
    : h(
        'section',
        { class: 'card' },
        h('p', { style: 'margin:0 0 10px;' }, 'API 키가 아직 없어요. 대화 팩을 생성하려면 Claude API 키가 필요합니다.'),
        h('button', { class: 'btn sm', onClick: () => navigate('/settings') }, '설정에서 키 입력')
      );

  const profileNotice = hasKey && !profileFilled()
    ? h(
        'section',
        { class: 'card' },
        h('p', { style: 'margin:0 0 10px;' }, '내 프로필(직무·목표·가족 등)을 채우면 예상 질문과 모범답변이 내 상황에 맞게 나와요.'),
        h('button', { class: 'btn sm', onClick: () => navigate('/profile?from=home') }, '프로필 채우기')
      )
    : null;

  const polishCard = h(
    'section',
    { class: 'card', style: 'display:flex; align-items:center; gap:12px;' },
    h('div', { style: 'flex:1;' },
      h('div', { style: 'font-weight:600;' }, '말 다듬기'),
      h('div', { class: 'small muted' }, '내가 한 영어를 문장으로 정리하고 고쳐 드려요')),
    h('button', { class: 'btn sm', onClick: () => navigate('/polish') }, '열기')
  );

  const body = h(
    'div',
    { class: 'stack' },
    h('div', { class: 'hero' }, h('h2', null, '어떤 상황을 영어로?'), h('p', null, '상황이나 주제를 적으면 표현·예상 질문·대화문을 만들어 드려요.')),
    keyNotice,
    profileNotice,
    polishCard,
    h('div', { class: 'section-title' }, '빠른 시작'),
    presetRow,
    h('label', { class: 'field' }, h('span', null, '상황 / 주제'), textarea),
    h('label', { class: 'field' }, h('span', null, '대화 상대'), partnerInput),
    partnerChips,
    h('label', { class: 'field' }, h('span', null, '톤'), formalityCtl),
    h('label', { class: 'field' }, h('span', null, '다룰 깊이 (복수 선택)'), depthChips),
    h('label', { class: 'field' }, h('span', null, '목표'), goalInput),
    genBtn,
    kwBtn,
    h('p', { class: 'small muted center', style: 'margin:2px 0 0;' }, '키워드를 먼저 공부하면, 그 단어를 넣어 대화 팩을 만들어요.')
  );

  return screen({ title: 'Situ', tab: 'home', children: body });

  function rerender() {
    mount(homeView());
  }

  async function onGenerate() {
    if (!form.text.trim()) {
      toast('상황이나 주제를 입력하세요.');
      return;
    }
    if (!getSettings().apiKey) {
      navigate('/settings');
      return;
    }
    genBtn.disabled = true;
    genBtn.textContent = '';
    genBtn.append(h('span', { class: 'spinner' }), document.createTextNode(' 만드는 중… (10–20초)'));
    try {
      const { pack, usage, model } = await generatePack({ ...form });
      setDraft({ id: 'draft', situation: { ...form }, pack, usage, model, createdAt: Date.now() });
      navigate('/result');
    } catch (e) {
      console.error(e);
      toast(e.message || '생성에 실패했습니다.', 4000);
      genBtn.disabled = false;
      genBtn.textContent = '대화 팩 만들기';
    }
  }

  async function onKeywords() {
    if (!form.text.trim()) {
      toast('상황이나 주제를 입력하세요.');
      return;
    }
    if (!getSettings().apiKey) {
      navigate('/settings');
      return;
    }
    kwBtn.disabled = true;
    genBtn.disabled = true;
    kwBtn.textContent = '';
    kwBtn.append(h('span', { class: 'spinner' }), document.createTextNode(' 키워드 뽑는 중…'));
    try {
      const { keywords, title, note } = await generateKeywords({ ...form });
      setDraft({
        id: 'draft',
        situation: { ...form },
        keywords,
        keywordsTitle: title,
        keywordsNote: note,
        createdAt: Date.now(),
      });
      navigate('/keywords');
    } catch (e) {
      console.error(e);
      toast(e.message || '키워드 생성에 실패했습니다.', 4000);
      kwBtn.disabled = false;
      genBtn.disabled = false;
      kwBtn.textContent = '키워드 먼저 공부';
    }
  }
}
