# CLAUDE.md — Claude가 이 프로젝트를 기억하기 위한 파일

## 프로젝트 정체

이 프로젝트는 **KitkitSchool** (아프리카 교육용 앱, C++ / Cocos2d-x 기반)을
**React + TypeScript + HTML5 Canvas** 웹 앱으로 포팅하는 작업이다.

- **작업자:** Dasom-pr (비개발자, 쉽게 설명 필요)
- **GitHub:** https://github.com/Dasom-pr/Kitkit-School-Webporting
- **로컬 경로:** `C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/kitkitschool-web/`
- **원본 C++ 소스:** `C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/GLEXP-Team-KitkitSchool-newmaster/`
- **개발 서버:** http://localhost:5174 (`npm run dev`)
- **git 설정:** user.name=Dasom-pr, user.email=dasomdari.choi@gmail.com

---

## 기술 스택 요약

- React 19, TypeScript, Vite 7
- 게임 렌더링: HTML5 Canvas 2D (가상해상도 2560×1800)
- 라우팅: React Router DOM 7
- 상태관리: CurriculumContext (localStorage 기반 진행상태 저장)
- 배포: Docker + Nginx (현재는 로컬 개발 중)

---

## 에셋 구조

- **에셋 위치:** `public/assets/` (gitignore됨, 2.5GB)
- **에셋 출처:** `KitkitSchool-english-debug.apk` (1.39GB) → ZIP으로 압축 해제 → `assets/` 폴더 추출
- **APK 다운로드:** https://github.com/XPRIZE/GLEXP-Team-KitkitSchool/releases
- GitHub에는 코드와 JSON 데이터만 올림 (에셋 제외)
- **에셋 원본 경로:** `C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/assets/` (복사 원본)

---

## 게임 포팅 규칙 (새 게임 추가 시 항상 이 순서)

1. `public/data/games/{게임이름}.json` — 레벨/문제 데이터
2. `src/game/{게임이름}/{게임이름}Engine.ts` — BaseEngine 상속, Canvas 로직
3. `src/pages/games/{게임이름}Page.tsx` — 레벨 선택 UI + Canvas 마운트
4. `src/App.tsx` — `/game/{게임이름}` 라우트 1줄 추가

---

## 포팅 현황 (2026-03-19 기준)

### ✅ 포팅 완료 (동작 중) — 총 51개 라우트
Counting, NumberTrace, NumberMatching, NumberPuzzle, HundredPuzzle,
DoubleDigit, MissingNumber, EquationMaker, DigitalQuiz, PatternTrain,
LineMatching, LetterTrace, LetterMatching, WordTrace, WordMachine,
Spelling, SentenceMaker, SentenceBridge, ComprehensionTest, WhatIsThis,
AlphabetPuzzle, AnimalPuzzle, EggQuiz, TappingGame, FishTank,
MovingInsects, StarFall, WoodenPuzzles, CompMatching, FindTheMatch,
TutorialTrace, Library (책/영상),
ShapeMatching, FeedingTime, WordKicker, MathKicker, MangoShop,
WordMatrix, SoundTrain, WordNote, ReadingBird, BirdPhonics, Labeling, LRComprehension,
**NumberTrain, PlaceValue, QuickFacts, WordWindow, ThirtyPuzzle,
MultiplicationBoard, NumberTracingExt**

### ❌ 미포팅 (커리큘럼 사용 빈도 0 — 포팅 불필요)
BigSmall, Crown, Keypad, Count10, AirShapes, EqualsGreatLess,
100chickens, 30puzzle

---

## 중요 파일 위치

| 파일 | 설명 |
|------|------|
| `src/game/common/BaseEngine.ts` | 모든 게임의 부모 클래스 — 새 게임 작성 전 반드시 참고 |
| `src/game/counting/CountingEngine.ts` | 가장 단순한 엔진 예시 — 템플릿으로 활용 |
| `src/pages/games/CountingPage.tsx` | 가장 단순한 Page 예시 — 템플릿으로 활용 |
| `src/context/CurriculumContext.tsx` | 진행상태 전역 관리 (localStorage) |
| `src/App.tsx` | 전체 라우팅 — 새 게임 추가 시 여기에 1줄 추가 |
| `public/data/curriculum.json` | 전체 커리큘럼 구조 |
| `src/hooks/useShellParams.ts` | 셸 파라미터 훅 — shellLevel, isFromShell, onGameComplete, shellBack 반환 |
| `src/data/gameRouteMap.ts` | TSV 게임명 → 웹 라우트 매핑 |

---

## 작업자 관련 주의사항

- **비개발자**이므로 설명은 항상 쉽고 비유를 활용할 것
- 코드 작업 후에는 반드시 어떤 파일을 왜 수정했는지 한국어로 설명할 것
- GitHub 푸시는 항상 에셋 폴더(`public/assets/`, `assets/`)를 제외하고 올릴 것
- git 커밋 메시지는 한국어로 작성해도 됨

---

## GitHub 업로드 방법 (매번 동일)

```bash
cd "C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/kitkitschool-web"
git add src/ public/data/   # 에셋 폴더는 절대 add 금지
git commit -m "feat: {게임이름} 포팅 완료"
git push
```

---

## 셸 통합 패턴 (모든 Page 파일에서 반드시 이 패턴 사용)

```tsx
// ✅ 올바른 패턴
const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
const [level, setLevel] = useState(0)

const startLevel = useCallback((lvl: number) => {
  setLevel(lvl); setShowComplete(false); setProgress({ current: 0, max: 5 })
}, [])

// 셸에서 자동 시작
useEffect(() => {
  if (shellLevel && level === 0) startLevel(shellLevel)
}, [shellLevel, level, startLevel])

// 완료 시 커리큘럼으로 복귀
useEffect(() => {
  if (showComplete && isFromShell) onGameComplete()
}, [showComplete, isFromShell, onGameComplete])

// ❌ 잘못된 패턴 (level 프로퍼티 없음)
const { level: shellLevel } = useShellParams()  // 오류! level 없음
```

---

## 사운드 경로 규칙

| 게임 | 사운드 경로 |
|------|------------|
| ReadingBird | `/assets/games/readingbird/sound/{파일명}` |
| BirdPhonics | `/assets/games/birdphonics/sounds/{파일명}` |
| WordWindow | `/assets/localized/en-us/games/wordwindow/sound/{파일명}` |
| SoundTrain | `/assets/games/soundtrain/sounds/{파일명}` |
| 공통 SFX | `/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a` |
| 공통 SFX | `/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a` |

---

## 버그 수정 이력 (2026-03-19)

### 오늘 발견하고 수정한 버그 목록

| 게임 | 버그 내용 | 수정 방법 |
|------|----------|----------|
| WordWindow | `answer` 값이 모두 0 (TSV rightAnswer가 1-based인데 그대로 저장) | JSON 재생성: `answer = rightAnswer - 1` |
| MultiplicationBoard | 배경 이미지 `boards_image_background.jpg` 없음 | `bg.png`으로 변경 |
| 7개 신규 게임 (NumberTrain 등) | 셸 자동시작 안 됨: `{ level: shellLevel }` (level 프로퍼티 없음) | `{ shellLevel, isFromShell, onGameComplete, shellBack }` 패턴으로 수정 |
| 7개 신규 게임 | 게임 완료 시 커리큘럼 진행상태 저장 안 됨 | `onGameComplete()` 호출 useEffect 추가 |
| ReadingBird | 이미지 없음: `reading_bird_normal.png` 존재하지 않음 | `bird_idle.png` 사용 + 이모지 fallback |
| ReadingBird | 103개 사운드 파일 없음 | `assets/localized/en-us/games/readingbird/sound/`에서 복사 |
| ReadingBird | 오디오 onerror 핸들러 없음 → 오디오 오류 시 게임 멈춤 | `onerror` + `catch` 핸들러 추가 |
| ReadingBird | phase 전환이 1.5초 고정 타이머 → 사운드 길이 무관 | `audio.onended` 콜백 + 0.5초 딜레이로 변경 |

---

## 다음 작업

현재 알려진 미해결 항목 없음. 모든 포팅 게임 정상 동작 중.

---

## 진행 이력

| 날짜 | 작업 내용 |
|------|-----------|
| 2026-03-19 | 프로젝트 구조 파악, 에셋 적용, 개발 서버 실행 |
| 2026-03-19 | 포팅 현황 파악 (19개 미포팅 확인) |
| 2026-03-19 | GitHub 레포 생성 및 초기 코드 푸시 |
| 2026-03-19 | ShapeMatching, FeedingTime, WordKicker, MathKicker, MangoShop, WordMatrix, SoundTrain, WordNote, ReadingBird, BirdPhonics, Labeling, LRComprehension 포팅 완료 |
| 2026-03-19 | NumberTrain, PlaceValue, QuickFacts, WordWindow, ThirtyPuzzle, MultiplicationBoard, NumberTracingExt 포팅 완료 — 커리큘럼 전체 포팅 100% 달성 |
| 2026-03-19 | 버그 수정: WordWindow answer 오류, MultiplicationBoard 이미지, 7개 게임 셸 통합, ReadingBird 이미지+사운드+오디오 로직 전면 수정 |
| 2026-03-19 | 2차 버그 수정: WordNote 사운드 55개 복사(9개 원본 없음), BirdPhonics onerror 핸들러 추가, 전체 51개 Page 셸통합 검수 완료, TypeScript 오류 0개 확인 |
