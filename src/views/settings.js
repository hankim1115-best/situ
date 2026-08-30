import { h, mount, toast } from '../ui.js';
import { screen } from '../chrome.js';
import { navigate } from '../router.js';
import { getSettings, saveSettings, exportData, importData, getSets, profileFilled } from '../store.js';
import { testKey } from '../api.js';
import { rankedEnglishVoices, ttsSupported, speak } from '../tts.js';

const MODELS = [
  ['claude-sonnet-5', 'Sonnet 5 — 균형 (권장)'],
  ['claude-haiku-4-5-20251001', 'Haiku 4.5 — 빠르고 저렴'],
  ['claude-opus-5', 'Opus 5 — 최고 품질'],
];

export function settingsView() {
  const s = getSettings();
  let showKey = false;

  const keyInput = h('input', {
    type: 'password',
    placeholder: 'sk-ant-...',
    value: s.apiKey,
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
  });

  const toggleKeyBtn = h('button', { class: 'btn sm', type: 'button', onClick: () => {
    showKey = !showKey;
    keyInput.type = showKey ? 'text' : 'password';
    toggleKeyBtn.textContent = showKey ? '가리기' : '보기';
  } }, '보기');

  const testBtn = h('button', { class: 'btn sm', type: 'button', onClick: async () => {
    const key = keyInput.value.trim();
    if (!key) return toast('키를 입력하세요.');
    testBtn.disabled = true;
    testBtn.textContent = '확인 중…';
    try {
      await testKey(key);
      toast('키가 정상입니다 ✅');
    } catch (e) {
      toast('실패: ' + e.message, 4000);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '키 테스트';
    }
  } }, '키 테스트');

  const modelSelect = h(
    'select',
    { onchange: (e) => saveSettings({ model: e.target.value }) },
    ...MODELS.map(([v, label]) => h('option', { value: v, selected: s.model === v }, label))
  );

  const voices = rankedEnglishVoices();
  const voiceSelect = h(
    'select',
    { onchange: (e) => saveSettings({ voiceURI: e.target.value }) },
    h('option', { value: '' }, '자동 (가장 자연스러운 음성 우선)'),
    ...voices.map((v) =>
      h('option', { value: v.voiceURI, selected: s.voiceURI === v.voiceURI },
        `${v.name} (${v.lang})${v.localService === false ? ' · 온라인' : ''}`)
    )
  );

  const rate = h('input', {
    type: 'range', min: '0.6', max: '1.2', step: '0.05', value: String(s.speakRate || 0.95),
    oninput: (e) => saveSettings({ speakRate: parseFloat(e.target.value) }),
  });

  const saveKeyBtn = h('button', { class: 'btn primary block', type: 'button', onClick: () => {
    saveSettings({ apiKey: keyInput.value.trim() });
    toast('저장했어요.');
  } }, 'API 키 저장');

  // ---- data ----
  const importTa = h('textarea', { placeholder: '내보낸 JSON을 여기 붙여넣기' });

  const body = h(
    'div',
    { class: 'stack' },

    h(
      'section',
      { class: 'card stack' },
      h('h3', null, 'Claude API 키'),
      h('p', { class: 'small muted', style: 'margin:0;' },
        '키는 이 기기에만 저장되고, 요청은 api.anthropic.com 으로만 전송돼요. console.anthropic.com 에서 발급합니다.'),
      keyInput,
      h('div', { class: 'row' }, toggleKeyBtn, testBtn),
      saveKeyBtn
    ),

    h(
      'section',
      { class: 'card stack' },
      h('h3', null, '내 프로필'),
      h('p', { class: 'small muted', style: 'margin:0;' },
        profileFilled()
          ? '직무·목표·가족 등을 바탕으로 예상 질문과 모범답변이 내 상황에 맞게 생성됩니다.'
          : '아직 비어 있어요. 채우면 생성 결과가 훨씬 개인화됩니다.'),
      h('button', { class: 'btn sm', type: 'button', onClick: () => navigate('/profile') }, profileFilled() ? '프로필 수정' : '프로필 채우기')
    ),

    h('label', { class: 'field' }, h('span', null, '생성 모델'), modelSelect),

    ttsSupported()
      ? h(
          'section',
          { class: 'card stack' },
          h('h3', null, '음성 (듣기)'),
          voiceSelect,
          h('label', { class: 'field' }, h('span', null, '말하기 속도'), rate),
          h('button', { class: 'btn sm', type: 'button', onClick: () => speak('Hi, this is how the voice sounds. Nice to meet you.') }, '샘플 듣기'),
          h('p', { class: 'small muted', style: 'margin:0;' },
            '기계음처럼 들리면: 목록에서 "온라인" 표시가 있는 음성을 고르세요. 없으면 폰의 시스템 설정에서 고품질 음성을 받을 수 있어요 — Android: 설정 › 텍스트 음성 변환 › Google 엔진에서 영어 음성 다운로드. iPhone: 설정 › 손쉬운 사용 › 콘텐츠 말하기 › 음성 › English에서 고급/향상됨 음성 다운로드. PC라면 Edge 브라우저 음성이 크롬보다 훨씬 자연스럽습니다.')
        )
      : h('section', { class: 'card' }, h('p', { class: 'muted small', style: 'margin:0;' }, '이 브라우저는 음성 재생을 지원하지 않아요.')),

    h(
      'section',
      { class: 'card stack' },
      h('h3', null, '데이터'),
      h('p', { class: 'small muted', style: 'margin:0;' }, `저장된 대화 팩 ${getSets().length}개`),
      h('button', { class: 'btn sm', type: 'button', onClick: doExport }, '내보내기 (JSON 다운로드)'),
      importTa,
      h('button', { class: 'btn sm', type: 'button', onClick: doImport }, '가져오기 (합치기)')
    ),

    h(
      'section',
      { class: 'card' },
      h('h3', null, '정보'),
      h('p', { class: 'small muted', style: 'margin:0;' }, 'Situ · 오프라인 설치형 웹앱. 저장·복습·역할극은 오프라인에서도 동작하고, 대화 팩 생성만 인터넷이 필요합니다.')
    )
  );

  return screen({ title: '설정', tab: 'settings', children: body });

  function doExport() {
    try {
      const blob = new Blob([exportData()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: `situ-backup-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast('내보내기 실패: ' + e.message, 4000);
    }
  }

  function doImport() {
    const txt = importTa.value.trim();
    if (!txt) return toast('JSON을 붙여넣으세요.');
    try {
      const n = importData(txt);
      toast(`가져왔어요. 총 ${n}개`);
      mount(settingsView());
    } catch (e) {
      toast('가져오기 실패: ' + e.message, 4000);
    }
  }
}
