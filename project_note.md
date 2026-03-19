# Kitkit School Web Porting — 프로젝트 노트

## 프로젝트 개요

- **목적:** 아프리카 교육용 앱 KitkitSchool (C++ / Cocos2d-x 기반)을 React + TypeScript 웹으로 포팅
- **작업자:** Dasom-pr (dasomdari.choi@gmail.com)
- **GitHub:** https://github.com/Dasom-pr/Kitkit-School-Webporting
- **로컬 경로:** `C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/kitkitschool-web/`
- **원본 C++ 소스:** `C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/GLEXP-Team-KitkitSchool-newmaster/`
- **개발 서버:** http://localhost:5174

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite 7 |
| 게임 렌더링 | HTML5 Canvas 2D |
| 라우팅 | React Router DOM 7 |
| 배포 | Docker + Nginx |
| 에셋 서버 | 로컬 `public/assets/` 또는 AWS S3 |

---

## 폴더 구조

```
kitkitschool-web/
├── src/
│   ├── pages/games/        # 각 게임의 React 페이지 (UI 틀)
│   ├── game/               # 각 게임의 Canvas 엔진 (실제 게임 로직)
│   ├── components/         # 공통 UI (뒤로가기, 진행바 등)
│   ├── context/            # CurriculumContext (전역 진행상태)
│   ├── data/               # 게임 라우팅 맵
│   ├── hooks/              # useCanvas, useShellParams
│   └── App.tsx             # 라우팅 설정
├── public/
│   ├── data/games/         # 게임별 JSON 데이터 파일
│   └── assets/             # 게임 이미지/사운드 (gitignore됨, 2.5GB)
├── assets/                 # 루트 에셋 (gitignore됨, 2.5GB)
└── scripts/                # 에셋 복사 스크립트들
```

---

## 에셋 출처

- **원본 APK:** `KitkitSchool-english-debug.apk` (1.39GB)
  - 링크: https://github.com/XPRIZE/GLEXP-Team-KitkitSchool/releases
  - APK = ZIP 파일 → 확장자 `.zip`으로 바꿔서 압축 해제
  - 내부 `assets/` 폴더 → `kitkitschool-web/public/assets/`에 복사

---

## 포팅 현황 (2026-03-19 기준)

### ✅ 동작 중인 게임 (포팅 완료)

| 게임 | 카테고리 | 비고 |
|------|----------|------|
| Counting | 수학 | |
| NumberTrace | 수학 | |
| NumberMatching | 수학 | |
| NumberPuzzle | 수학 | |
| HundredPuzzle | 수학 | |
| DoubleDigit | 수학 | |
| MissingNumber | 수학 | |
| EquationMaker | 수학 | |
| DigitalQuiz | 수학 | |
| PatternTrain | 수학 | |
| LineMatching | 수학 | |
| LetterTrace | 읽기 | |
| LetterMatching | 읽기 | |
| WordTrace | 읽기 | |
| WordMachine | 읽기 | |
| Spelling | 읽기 | |
| SentenceMaker | 읽기 | |
| SentenceBridge | 읽기 | |
| ComprehensionTest | 읽기 | |
| WhatIsThis | 읽기 | |
| AlphabetPuzzle | 읽기 | |
| AnimalPuzzle | 읽기 | |
| EggQuiz | 공통 | |
| TappingGame | 공통 | |
| FishTank | 공통 | |
| MovingInsects | 공통 | |
| StarFall | 공통 | |
| WoodenPuzzles | 공통 | |
| CompMatching | 공통 | |
| FindTheMatch | 공통 | |
| TutorialTrace | 공통 | |
| Library | - | 책/영상 뷰어 |

### ❌ 미포팅 게임 (19개)

| 게임 | 복잡도 | 우선순위 |
|------|--------|----------|
| ShapeMatching | 낮음 | 🔴 1순위 (다음 작업) |
| NumberPuzzle2 | 낮음 | |
| CardMatching | 낮음 | |
| LetterQuiz | 낮음 | |
| WordQuiz | 낮음 | |
| SyllableMatching | 중간 | |
| Phonics | 중간 | |
| WordWindow | 중간 | |
| StoryBook | 중간 | |
| MathBingo | 중간 | |
| NumberBond | 중간 | |
| Fractions | 중간 | |
| Measurement | 중간 | |
| Geometry | 높음 | |
| WordFactory | 높음 | |
| SentenceJumble | 높음 | |
| MathPuzzle | 높음 | |
| TimeTeller | 높음 | |
| MoneyMath | 높음 | |

---

## 게임 포팅 절차 (4단계)

새 게임을 포팅할 때마다 이 4단계를 반복:

### 1단계 — JSON 데이터 파일 작성
```
public/data/games/{게임이름}.json
```
- 게임 레벨, 문제 목록 등 데이터 정의
- 원본: C++ 소스의 TSV/CSV 파일 또는 코드 내 하드코딩 값 참고

### 2단계 — Engine 파일 작성 (핵심, 작업량 80%)
```
src/game/{게임이름}/{게임이름}Engine.ts
```
- `BaseEngine`을 상속
- Canvas에 게임 화면 그리기
- 터치/클릭 이벤트 처리
- 정답 판정 및 다음 문제 진행
- 완료 시 `this.onComplete()` 호출

### 3단계 — Page 파일 작성
```
src/pages/games/{게임이름}Page.tsx
```
- 레벨 선택 UI
- 뒤로가기 버튼, 진행바
- Engine을 Canvas에 마운트

### 4단계 — App.tsx에 라우트 등록
```
src/App.tsx
```
- `/game/{게임이름}` → `{게임이름}Page` 연결 1줄 추가

---

## GitHub 업로드 방법

```bash
cd "C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/kitkitschool-web"

# 변경된 파일 확인
git status

# 스테이징
git add src/ public/data/

# 커밋
git commit -m "feat: ShapeMatching 게임 포팅 완료"

# 푸시
git push
```

> ⚠️ `public/assets/`, `assets/`, `node_modules/`는 절대 add 하지 말 것 (2.5GB, gitignore 처리됨)

---

## 개발 서버 실행

```bash
cd "C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/kitkitschool-web"
npm run dev
```
→ http://localhost:5174 에서 확인

---

## 주요 참고 파일

| 파일 | 역할 |
|------|------|
| `src/game/common/BaseEngine.ts` | 모든 게임 엔진의 부모 클래스 |
| `src/game/counting/CountingEngine.ts` | 가장 기본적인 엔진 예시 |
| `src/context/CurriculumContext.tsx` | 진행상태 전역 관리 |
| `src/App.tsx` | 전체 라우팅 |
| `public/data/curriculum.json` | 커리큘럼 구조 (레벨/일차/게임) |
