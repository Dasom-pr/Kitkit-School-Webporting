# 작업 노트 — KitkitSchool Web 포팅

> 내일 작업 재개 시 이 파일과 CLAUDE.md 를 먼저 읽을 것.

---

## 📅 2026-03-19 오늘 한 일 전체 요약

### 1단계: 신규 게임 7개 포팅 (커리큘럼 100% 달성)

| 게임 | JSON | Engine | Page |
|------|------|--------|------|
| NumberTrain | ✅ | ✅ | ✅ |
| PlaceValue | ✅ | ✅ | ✅ |
| QuickFacts | ✅ | ✅ | ✅ |
| WordWindow | ✅ | ✅ | ✅ |
| ThirtyPuzzle | ✅ | ✅ | ✅ |
| MultiplicationBoard | ✅ | ✅ | ✅ |
| NumberTracingExt | (절차 생성) | ✅ | ✅ |

---

### 2단계: 버그 수정 (총 10개)

| # | 게임 | 버그 | 수정 |
|---|------|------|------|
| 1 | WordWindow | answer 항상 0 (1-based → 0-based 미변환) | JSON 재생성 |
| 2 | MultiplicationBoard | 배경 이미지 파일명 오류 | `bg.png`으로 수정 |
| 3 | 7개 신규 게임 | 셸 자동시작 안 됨 (`level` 프로퍼티 없음) | `shellLevel` 패턴 수정 |
| 4 | 7개 신규 게임 | 진행상태 저장 안 됨 | `onGameComplete()` useEffect 추가 |
| 5 | ReadingBird | 새 이미지 없음 | `bird_idle.png` + 이모지 fallback |
| 6 | ReadingBird | 사운드 103개 누락 | 원본에서 552개 복사 |
| 7 | ReadingBird | 오디오 onerror 없음 | `onerror` + `catch` 추가 |
| 8 | ReadingBird | phase 전환 타이밍 오류 | `onended` 콜백으로 변경 |
| 9 | WordNote | 사운드 64개 누락 | 여러 소스에서 55개 복사 (9개 없음) |
| 10 | BirdPhonics | onerror 핸들러 없음 | `audio.onerror = () => {}` 추가 |

---

### 3단계: TDD 환경 구축

- **Vitest** 설치 (`npm run test:run`)
- **테스트 4개 파일, 80개 테스트 전부 통과**

```
src/test/
├── gameRouteMap.test.ts   (22개) — 라우트 매핑
├── jsonData.test.ts       (27개) — JSON 구조 검증
├── useShellParams.test.ts (21개) — URL 파싱
└── assetPath.test.ts      (10개) — 에셋 경로
```

---

### 4단계: 문서 작성 (docs/ 폴더)

```
docs/
├── 01-프로젝트-개요.md
├── 02-아키텍처.md
├── 03-버그수정-이력.md
├── 04-게임목록.md
└── 05-테스트-가이드.md
```

---

## 🚀 내일 작업 시작 방법

```bash
cd "C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/kitkitschool-web"

# 1. 테스트 통과 확인
npm run test:run
# → 80 passed ✅

# 2. 개발 서버 실행
npm run dev
# → http://localhost:5174
```

---

## 📌 현재 상태 (2026-03-19 밤 기준)

| 항목 | 상태 |
|------|------|
| 전체 게임 포팅 | ✅ 51개 완료 (커리큘럼 100%) |
| TypeScript 오류 | ✅ 0개 |
| 테스트 | ✅ 80개 전부 통과 |
| GitHub | ✅ push 완료 |
| 알려진 미해결 버그 | 없음 |

---

## ⚠️ 알아두면 좋은 것

### WordNote 소리 없는 단어 9개 (원본 에셋에 아예 없음)
`price`, `shampoo`, `bell`, `doll`, `glass`, `church`, `whisper`, `little`, `shoulder`
→ 그 단어만 소리 없이 진행됨. 게임 자체는 정상 동작.

### 셸 통합 반드시 이 패턴
```tsx
const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
useEffect(() => { if (shellLevel && level === 0) startLevel(shellLevel) }, [...])
useEffect(() => { if (showComplete && isFromShell) onGameComplete() }, [...])
```

### GitHub push 할 때
```bash
git add src/ public/data/ docs/   # 에셋 폴더(public/assets/)는 절대 add 금지
git commit -m "작업 내용"
git push
```

---

## 💬 Claude에게 내일 하는 말

```
CLAUDE.md 와 note.md 읽고 어제 작업 파악한 뒤,
추가로 발견되는 버그가 있으면 수정하고
테스트도 계속 보강해줘.
```
