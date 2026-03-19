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

---

## 게임 포팅 규칙 (새 게임 추가 시 항상 이 순서)

1. `public/data/games/{게임이름}.json` — 레벨/문제 데이터
2. `src/game/{게임이름}/{게임이름}Engine.ts` — BaseEngine 상속, Canvas 로직
3. `src/pages/games/{게임이름}Page.tsx` — 레벨 선택 UI + Canvas 마운트
4. `src/App.tsx` — `/game/{게임이름}` 라우트 1줄 추가

---

## 포팅 현황 (2026-03-19 기준)

### ✅ 포팅 완료 (동작 중)
Counting, NumberTrace, NumberMatching, NumberPuzzle, HundredPuzzle,
DoubleDigit, MissingNumber, EquationMaker, DigitalQuiz, PatternTrain,
LineMatching, LetterTrace, LetterMatching, WordTrace, WordMachine,
Spelling, SentenceMaker, SentenceBridge, ComprehensionTest, WhatIsThis,
AlphabetPuzzle, AnimalPuzzle, EggQuiz, TappingGame, FishTank,
MovingInsects, StarFall, WoodenPuzzles, CompMatching, FindTheMatch,
TutorialTrace, Library (책/영상)

### ❌ 미포팅 (19개) — 다음 작업 순서
1. **ShapeMatching** ← 현재 작업 예정 (복잡도 낮음)
2. NumberPuzzle2, CardMatching, LetterQuiz, WordQuiz (복잡도 낮음)
3. SyllableMatching, Phonics, WordWindow, StoryBook, MathBingo, NumberBond, Fractions, Measurement (복잡도 중간)
4. Geometry, WordFactory, SentenceJumble, MathPuzzle, TimeTeller, MoneyMath (복잡도 높음)

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

## 진행 이력

| 날짜 | 작업 내용 |
|------|-----------|
| 2026-03-19 | 프로젝트 구조 파악, 에셋 적용, 개발 서버 실행 |
| 2026-03-19 | 포팅 현황 파악 (19개 미포팅 확인) |
| 2026-03-19 | GitHub 레포 생성 및 초기 코드 푸시 |
| 2026-03-19 | ShapeMatching 포팅 시작 예정 |
