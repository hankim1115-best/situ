# Situ — 상황별 영어 (PWA)

대화하고 싶은 **상황이나 주제를 입력**하면, 그 상황을 캐나다에서 영어로 잘 해내기 위한
**대화 팩**(핵심 표현 · 스몰토크 오프너 · 예시 대화 · 상대가 물어볼 질문과 대답 ·
더 깊은 대화로 넘어가는 표현 · 단어 · 발음 주의 · 캐나다 문화 노트)을 만들어 주는
모바일 설치형 웹앱입니다. 2년 뒤 캐나다 이민·현지 취업·직장생활 준비가 목적입니다.

- **빌드 도구 없음.** 순수 HTML/CSS/ES 모듈. 정적 파일만 있으면 어디서든 동작합니다.
- **콘텐츠 생성**은 Claude API 직접 호출. API 키는 기기(localStorage)에만 저장되고
  `api.anthropic.com` 으로만 전송됩니다.
- **저장 · 복습(간격 반복) · 역할극 연습**은 오프라인에서도 동작합니다. 생성만 인터넷 필요.

## 실행 (로컬 / 휴대폰 테스트)

```bash
py serve.py
```

- PC: `http://localhost:8000`
- 휴대폰(같은 Wi-Fi): 터미널에 출력되는 `http://<PC-IP>:8000`
  - 크롬/사파리에서 열고 **홈 화면에 추가**하면 앱처럼 실행됩니다.

> 참고: 서비스 워커(오프라인)는 `http://localhost` 또는 `https://` 에서만 등록됩니다.
> 휴대폰에서 LAN IP(`http://192.168...`)로 열면 오프라인 캐시가 동작하지 않을 수 있고,
> 배포(HTTPS) 시 정상 동작합니다.

## 처음 설정

1. 앱 실행 → **설정** 탭
2. [console.anthropic.com](https://console.anthropic.com/) 에서 발급한 API 키 입력 → **키 테스트** → **저장**
3. **모델**: 기본 Sonnet 5(권장). 빠르고 저렴하게는 Haiku 4.5.

## 사용 흐름

| 탭 | 하는 일 |
|---|---|
| **상황** | 상황/주제 + 대화 상대 + 톤 + 깊이 입력 → `대화 팩 만들기` |
| 결과 화면 | 내용 확인 → `저장하기` (라이브러리로) |
| **라이브러리** | 저장한 팩 목록. 탭하면 상세 + `복습` / `역할극 연습` |
| **복습** | 표현·단어를 플래시카드로. 모름/애매/잘 앎 → SM-2 간격 반복 |
| 역할극 | 예시 대화를 상대/나 번갈아 진행. 마이크(지원 브라우저)로 말하기 연습 |
| **설정** | API 키, 모델, 음성, 데이터 내보내기/가져오기 |

## 파일 구조

```
index.html            앱 셸
manifest.json         PWA 매니페스트
sw.js                 서비스 워커(오프라인 캐시) — 파일 변경 시 CACHE 버전 올릴 것
serve.py              로컬 개발 서버 (no-cache)
tools/make_icons.py   아이콘 생성 (stdlib만 사용)
assets/               아이콘
src/
  app.js              라우트 등록 + 부트스트랩
  router.js           해시 라우터
  chrome.js           상단 바 + 하단 탭 바
  store.js            localStorage 상태 + 간격 반복 로직
  api.js              Claude API 호출
  prompt.js           시스템 프롬프트 + 구조화 출력 스키마(도구)
  packview.js         대화 팩 렌더링 (결과/상세 공용)
  tts.js              듣기(TTS) + 말하기 인식(STT)
  styles.css
  views/              home, result, library, setDetail, review, practice, settings
```

## 배포 — GitHub Pages

이 폴더는 git 저장소로 초기화돼 있습니다(`main` 브랜치). 정적 파일뿐이라 루트에서 그대로 서빙됩니다.

```bash
gh auth login
gh repo create situ --public --source="." --remote=origin --push
gh api --method POST "repos/{owner}/{repo}/pages" -f "source[branch]=main" -f "source[path]=/"
```

- 1분쯤 뒤 `https://<GitHub사용자명>.github.io/situ/` 에서 열립니다.
- 무료 계정은 **public** 저장소만 Pages 가능. 이 앱은 비밀정보가 없어 공개해도 안전합니다
  (API 키는 각 사용자의 브라우저 localStorage에만 저장, 배포 파일엔 없음).
- 수정 후 반영: `git add -A && git commit -m "..." && git push` (파일을 바꿨으면 `sw.js`의
  `CACHE` 버전도 올릴 것).

### 휴대폰에 설치

폰 브라우저(크롬/사파리)로 위 URL을 열고 → **홈 화면에 추가**. HTTPS이므로 서비스 워커가
등록되어 오프라인에서도 저장·복습·역할극이 동작합니다(대화/키워드 생성만 인터넷 필요).

## 커스터마이즈 포인트

- `src/prompt.js` — 생성되는 내용의 구성·톤·항목. 스키마에서 필드를 더하거나 빼면
  `src/packview.js` 렌더링도 같이 수정.
- `src/views/home.js` `PRESETS` / `PARTNERS` — 빠른 시작 버튼과 상대 후보.
- `src/store.js` `gradeCard` — 복습 간격 알고리즘.
