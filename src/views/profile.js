import { h, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getProfile, saveProfile } from '../store.js';

const FIELDS = [
  ['role', '현재 직무 / 경력', '예: 핀테크 스타트업 백엔드 개발자 5년차', false],
  ['targetRole', '캐나다 목표 직무', '예: 중견 IT 회사 백엔드 개발자', false],
  ['industry', '업계', '예: 소프트웨어 / 헬스케어 / 제조', false],
  ['immigrationStream', '이민 경로', '예: Express Entry (FSW), BC PNP, 아직 미정', false],
  ['city', '정착 예정 도시', '예: Toronto, Vancouver, Calgary', false],
  ['family', '가족 상황', '예: 배우자 + 자녀 1명 (6세)', false],
  ['englishLevel', '영어 레벨', '예: IELTS 6.5 / CLB 8 / 중급', false],
  ['weakSpots', '내가 아는 내 약점', '예: 관사·전치사, 긴장하면 문장이 짧아짐, r/l·th 발음', true],
  ['extra', '기타 배경', '그 밖에 코치가 알면 좋은 것', true],
];

export function profileView({ query } = {}) {
  const p = getProfile();
  const back = query && query.from === 'home' ? '/' : '/settings';

  const fields = FIELDS.map(([key, label, ph, multiline]) => {
    const el = multiline
      ? h('textarea', { placeholder: ph, value: p[key] || '', oninput: (e) => saveProfile({ [key]: e.target.value }) })
      : h('input', { type: 'text', placeholder: ph, value: p[key] || '', oninput: (e) => saveProfile({ [key]: e.target.value }) });
    return h('label', { class: 'field' }, h('span', null, label), el);
  });

  const body = h(
    'div',
    { class: 'stack' },
    h(
      'p',
      { class: 'small muted', style: 'margin:0 2px;' },
      '채운 항목은 대화 팩·키워드·연습 생성에 자동으로 반영돼, 예상 질문과 모범답변이 내 상황에 맞게 나옵니다. 전부 선택이고, 이 기기에만 저장됩니다.'
    ),
    ...fields,
    h('button', { class: 'btn primary block', onClick: () => { toast('저장했어요.'); navigate(back); } }, '완료')
  );

  return screen({ title: '내 프로필', back, children: body });
}
