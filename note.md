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

---

## 📅 2026-03-20 오늘 한 일

### 버그 수정 (총 9개)

| # | 대상 | 버그 | 수정 |
|---|------|------|------|
| 1~7 | WordNote, WordMatrix, SoundTrain, WordKicker, WordWindow, LRComprehension, Labeling | `audio.onerror` 핸들러 없음 → 소리 실패 시 게임 멈춤 | `audio.onerror = () => {}` 추가 |
| 8 | WordNote | 레이아웃 완전 고장 + 드래그 없음 + 레벨11+ 모드 미구현 | 엔진 전면 재작성 (Mode A/B 분리) |
| 9 | MainScenePage | 게임/책/비디오 아이콘이 day 바뀌어도 그대로 | `getGameIconSrc`에 `gameParam` 인자 추가 |

### WordNote 상세 수정 내용
- **Mode A (레벨 1~10, 음절 2~4개)**: 드래그&드롭 구현, 레이아웃 수정
- **Mode B (레벨 11~26, 알파벳 28개)**: 완전 재구현
  - 단어 글자수만큼 빈 칸 (예: "tomato" → 6칸)
  - 7열 키보드 그리드로 카드 배치
  - 글자 순서대로 탭해서 철자 완성
  - `m/n`, `z/ch` 복합 카드도 정상 매칭

### 아이콘 썸네일 수정 내용
- Video: `/assets/library/{gameParam}.png` (예: `en_vdo_1025.png`)
- Book/BookWithQuiz: `/assets/library/book_{gameParam}_thumbnail.png`
- 없을 경우 → 기본 아이콘 → 프레임 그림자 순으로 폴백

### 테스트
- `audioErrorHandling.test.ts` 신규 추가 (7개)
- **전체 87개 통과**

---

---

## 📅 2026-03-20 (오후) 게임 전수 검증 결과

### 브라우저 직접 테스트로 확인한 게임 목록

| 게임 | 상태 | 비고 |
|------|------|------|
| WordMatrix (Lv.25) | ✅ 수정 완료 | 매트릭스 레이아웃 전면 재작성 |
| WordNote Lv.1 | ✅ 정상 | 드래그&드롭 작동 |
| WordNote Lv.18 | ✅ 정상 | 알파벳 키보드 KITCHEN→FOOTBALL 전환 |
| BirdPhonics | ✅ 정상 | 두 마리 새 + 단어 카드 |
| ReadingBird | ✅ 수정 완료 | 스피커 버튼 텍스트 겹침 해결 |
| SoundTrain | ✅ 정상 | 기차+사자 이미지, 글자 카드 |
| WordWindow | ✅ 정상 | 9(7+2) 정답 → 다음 문제 전환 |
| LRComprehension | ✅ 수정 완료 | 파일명 노출 제거 |
| QuickFacts | ✅ 정상 | 떨어지는 숫자 카드 |
| MangoShop | ✅ 정상 | 망고 트레이 + 답 선택 |
| NumberTrain | ✅ 정상 | 가장 작은 수 1 탭 → 2번 문제 전환 |
| PlaceValue | ✅ 정상 | 백/십/일 자리 +/- 버튼 |
| ThirtyPuzzle | ✅ 정상 | 숫자 격자, 미리 선택 표시 |
| MultiplicationBoard | ✅ 정상 | 전구 애니메이션 + 답 카드 |
| NumberTracingExt | ✅ 정상 | 숫자 트레이싱 캔버스 |

### 오늘 수정한 버그 3개

| # | 게임 | 버그 | 원인 | 수정 |
|---|------|------|------|------|
| 1 | WordMatrix | 멀티 자음 레벨(Lv.21+)에서 게임 동작 불가 | `"d,l"` 단일 블록으로 표시, 매트릭스 구조 없음 | 행렬 레이아웃 전면 재작성 |
| 2 | ReadingBird | 스피커 버튼이 텍스트 "Look **at** me." 위에 겹침 | `SPEAKER_Y = CY-10` = 텍스트 Y와 동일 | `SPEAKER_Y = CY+170`으로 이동 |
| 3 | LRComprehension | `"en uk lc 1 3 story"` 파일명이 화면에 노출 | `prob.script` 파일명을 그대로 렌더링 | 해당 라인 제거, 상태 메시지만 표시 |

---

## ⏭️ 다음 작업 재개 시 할 것

> "note.md, CLAUDE.md 읽고 파악한 뒤, 나머지 게임들도 제대로 동작하는지 검증하고 버그 있으면 수정해줘"

### 검증이 필요한 게임들 (우선순위 순)
1. **WordNote** - 오늘 수정했으니 실제 브라우저에서 동작 확인 필요
   - Mode A: `http://localhost:5173/game/wordnote?level=1`
   - Mode B: `http://localhost:5173/game/wordnote?level=18&from=shell&levelID=en-US_L_5&day=12&gameIndex=1`
2. **나머지 게임들** - 실제 플레이해보며 이상한 점 발견 시 수정
3. **테스트 보강** - 87개에서 더 추가 가능

---

## 📌 현재 상태 (2026-03-20 기준)

| 항목 | 상태 |
|------|------|
| 전체 게임 포팅 | ✅ 51개 완료 |
| TypeScript 오류 | ✅ 0개 |
| 테스트 | ✅ 87개 전부 통과 |
| GitHub | ✅ push 완료 |
| 알려진 미해결 버그 | 없음 |

---

## ⚠️ 알아두면 좋은 것

### WordNote 구조 (중요!)
- **레벨 1~10**: `cards` 2~4개 → 음절 조합 게임 (드래그&드롭)
- **레벨 11~26**: `cards` 25~28개 → 알파벳 키보드로 철자 게임 (탭)
- 소리 없는 단어 9개: `price`, `shampoo`, `bell`, `doll`, `glass`, `church`, `whisper`, `little`, `shoulder`

### 아이콘 썸네일 경로
- Video: `/assets/library/{gameParam}.png`
- Book: `/assets/library/book_{gameParam}_thumbnail.png`
- 기본 게임: `/assets/icons/game_icon_{gamename}.png`

### 셸 통합 반드시 이 패턴
```tsx
const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
useEffect(() => { if (shellLevel && level === 0) startLevel(shellLevel) }, [...])
useEffect(() => { if (showComplete && isFromShell) onGameComplete() }, [...])
```

### 서버 실행 (터미널 닫으면 꺼짐 — 항상 열어둘 것!)
```bash
cd "C:/Users/ASUS/OneDrive/Desktop/웹포팅연습/kitkitschool-web"
npm run dev   # http://localhost:5173 또는 5174
```

### GitHub push 할 때
```bash
git add src/ public/data/ docs/   # 에셋 폴더(public/assets/)는 절대 add 금지
git commit -m "작업 내용"
git push
```

---

## 💬 Claude에게 나중에 하는 말

```
note.md, CLAUDE.md 읽고 오늘 작업 파악한 뒤,
나머지 게임들 동작 검증하고 버그 있으면 수정해줘.
테스트도 보강해줘.
```
