import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/readingbird'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// 카드 4개 (2x2)
const CARD_W = 480, CARD_H = 180
const CARD_GAP_X = 60, CARD_GAP_Y = 40
const GRID_W = 2 * CARD_W + CARD_GAP_X
const CARD_START_X = CX - GRID_W / 2
const CARD_START_Y = CY + 200

// 새 위치
const BIRD_X = CX
const BIRD_Y = CY - 280
const BIRD_W = 320, BIRD_H = 320

// 스피커 버튼
const SPEAKER_X = CX
const SPEAKER_Y = CY - 10
const SPEAKER_R = 70

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  word: string
  sound: string
}

interface Card {
  word: string
  x: number
  y: number
  w: number
  h: number
  isCorrect: boolean
  state: 'normal' | 'correct' | 'wrong'
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class ReadingBirdEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private currentProblem: Problem | null = null
  private cards: Card[] = []
  private phase: 'listen' | 'answer' = 'listen'
  private isPlayingSound = false
  private currentAudio: HTMLAudioElement | null = null

  // Images — bird_idle.png 사용 (reading_bird_normal.png 없음)
  private imgBg   = loadImage(assetUrl(`${A}/bg.png`))
  private imgBird = loadImage(assetUrl(`${A}/bird_idle.png`))

  // SFX
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.levelNum = level
  }

  // ─ 사운드 재생 ─────────────────────────────────────────────────────────────
  private playWordSound(filename: string, onEnd?: () => void) {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    if (!filename) { onEnd?.(); return }

    const url = assetUrl(`${A}/sound/${filename}`)
    const audio = new Audio(url)
    this.currentAudio = audio
    this.isPlayingSound = true

    audio.onended = () => {
      this.isPlayingSound = false
      this.currentAudio = null
      onEnd?.()
    }
    audio.onerror = () => {
      this.isPlayingSound = false
      this.currentAudio = null
      onEnd?.()
    }
    audio.play().catch(() => {
      this.isPlayingSound = false
      this.currentAudio = null
      onEnd?.()
    })
  }

  // ─ 레벨 로드 ───────────────────────────────────────────────────────────────
  start() {
    this.resize()
    this.gameState = 'playing'
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup',   this.handlePointerUp)
    window.addEventListener('resize', this.resize)
    this.lastTime = performance.now() / 1000
    this.loop()
    this.loadLevel()
  }

  private async loadLevel() {
    const res  = await fetch('/data/games/readingbird.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    // 문제를 최대 6개로 제한 (셔플)
    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems = shuffled.slice(0, Math.min(shuffled.length, 6))
    this.problemIndex = 0
    this.locked = false
    this.onProgressChange?.(0, this.problems.length)
    this.setupProblem()
    this.loaded = true
  }

  // ─ 문제 세팅 ───────────────────────────────────────────────────────────────
  private setupProblem() {
    if (this.problemIndex >= this.problems.length) return
    const prob = this.problems[this.problemIndex]
    this.currentProblem = prob
    this.locked = false
    this.phase = 'listen'
    this.cards = []

    // 약간 딜레이 후 사운드 재생 → 재생 끝나면 answer 페이즈
    setTimeout(() => {
      this.playWordSound(prob.sound, () => {
        // 사운드 끝나면 0.5초 후 answer 페이즈
        setTimeout(() => {
          this.phase = 'answer'
          this.buildChoices()
        }, 500)
      })
    }, 300)
  }

  // ─ 보기 카드 생성 ──────────────────────────────────────────────────────────
  private buildChoices() {
    if (!this.currentProblem) return
    const prob = this.currentProblem

    // 오답 3개: 다른 문제들에서 랜덤 선택
    const others = this.problems
      .filter(p => p.word !== prob.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(p => p.word)

    // 오답이 3개 미만이면 일반 단어로 채움
    const fallback = ['apple', 'book', 'cat', 'dog', 'egg', 'fish']
    while (others.length < 3) {
      const f = fallback[others.length] ?? 'word'
      if (!others.includes(f)) others.push(f)
    }

    const choices = [prob.word, ...others.slice(0, 3)].sort(() => Math.random() - 0.5)

    this.cards = choices.map((word, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      return {
        word,
        x: CARD_START_X + col * (CARD_W + CARD_GAP_X),
        y: CARD_START_Y + row * (CARD_H + CARD_GAP_Y),
        w: CARD_W,
        h: CARD_H,
        isCorrect: word === prob.word,
        state: 'normal' as const,
      }
    })
  }

  // ─ 입력 ────────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // 스피커 버튼 (항상 눌러서 다시 들을 수 있음)
    const dx = x - SPEAKER_X, dy = y - SPEAKER_Y
    if (Math.sqrt(dx * dx + dy * dy) <= SPEAKER_R) {
      if (this.currentProblem?.sound) {
        this.playWordSound(this.currentProblem.sound, () => {
          if (this.phase === 'listen') {
            setTimeout(() => { this.phase = 'answer'; this.buildChoices() }, 500)
          }
        })
      }
      return
    }

    if (this.phase !== 'answer') return

    for (const card of this.cards) {
      if (x >= card.x && x <= card.x + card.w &&
          y >= card.y && y <= card.y + card.h) {
        this.handleCardTap(card)
        return
      }
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  // ─ 정답/오답 처리 ──────────────────────────────────────────────────────────
  private handleCardTap(card: Card) {
    if (card.state !== 'normal') return
    if (card.isCorrect) {
      card.state = 'correct'
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 900)
    } else {
      card.state = 'wrong'
      playSound(this.sfxIncorrect)
      setTimeout(() => { card.state = 'normal' }, 700)
    }
  }

  private nextProblem() {
    this.problemIndex++
    this.onProgressChange?.(this.problemIndex, this.problems.length)
    if (this.problemIndex >= this.problems.length) {
      setTimeout(() => { this.gameState = 'complete'; this.onComplete?.() }, 300)
      return
    }
    this.cards = []
    this.setupProblem()
  }

  stop() {
    if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio = null }
    super.stop()
  }

  // ─ 렌더 ────────────────────────────────────────────────────────────────────
  update(_t: number, _dt: number) {}

  draw() {
    const { ctx } = this
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    const ox = (w - GAME_WIDTH  * this.gameScale) / 2
    const oy = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(this.gameScale, this.gameScale)

    // ── 배경 ──
    if (this.imgBg.complete && this.imgBg.naturalWidth > 0) {
      ctx.drawImage(this.imgBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)
    } else {
      ctx.fillStyle = '#E8F5E9'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', CX, CY, 80, '#333')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // ── 진행도 ──
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      CX, 80, 60, 'rgba(255,255,255,0.9)')

    // ── 새 이미지 ──
    if (this.imgBird.complete && this.imgBird.naturalWidth > 0) {
      ctx.drawImage(this.imgBird,
        BIRD_X - BIRD_W / 2, BIRD_Y - BIRD_H / 2, BIRD_W, BIRD_H)
    } else {
      // fallback: 새 아이콘
      this.txt(ctx, '🐦', BIRD_X, BIRD_Y, 180, '#fff')
    }

    // ── 사운드 재생중 표시 ──
    if (this.isPlayingSound) {
      ctx.save()
      ctx.fillStyle = 'rgba(255,193,7,0.9)'
      ctx.beginPath()
      ctx.arc(BIRD_X + BIRD_W / 2 - 20, BIRD_Y - BIRD_H / 2 + 20, 40, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      this.txt(ctx, '♪', BIRD_X + BIRD_W / 2 - 20, BIRD_Y - BIRD_H / 2 + 22, 44, '#fff')
    }

    // ── LISTEN 페이즈 ──
    if (this.phase === 'listen') {
      // 단어 박스
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 24
      ctx.beginPath(); this.rr(ctx, CX - 600, CY - 120, 1200, 220, 28)
      ctx.fill(); ctx.shadowBlur = 0; ctx.restore()

      const fontSize = prob.word.length > 20 ? 64 : prob.word.length > 12 ? 80 : 100
      this.txt(ctx, prob.word, CX, CY - 10, fontSize, '#1B5E20')

      this.txt(ctx, '🔊 Listen carefully!', CX, CY + 160, 58, 'rgba(56,142,60,0.9)')

    } else {
      // ── ANSWER 페이즈 ──

      // 질문 텍스트
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.beginPath(); this.rr(ctx, CX - 550, CARD_START_Y - 180, 1100, 130, 20)
      ctx.fill(); ctx.restore()
      this.txt(ctx, 'Which word did you hear?', CX, CARD_START_Y - 115, 62, '#fff')

      // 카드
      for (const card of this.cards) {
        ctx.save()
        ctx.fillStyle = card.state === 'correct' ? '#4CAF50' :
                        card.state === 'wrong'   ? '#EF5350' : 'rgba(255,255,255,0.95)'
        ctx.strokeStyle = card.state === 'correct' ? '#2E7D32' :
                          card.state === 'wrong'   ? '#B71C1C' : '#A5D6A7'
        ctx.lineWidth = card.state !== 'normal' ? 6 : 3
        ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 14
        ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 22)
        ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore()

        const cFontSize = card.word.length > 18 ? 44 : card.word.length > 10 ? 54 : 68
        this.txt(ctx, card.word, card.x + card.w / 2, card.y + card.h / 2,
          cFontSize, card.state !== 'normal' ? '#fff' : '#1B5E20')
      }
    }

    // ── 스피커 버튼 (항상 표시) ──
    ctx.save()
    ctx.fillStyle = this.isPlayingSound ? '#FF9800' : '#388E3C'
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 16
    ctx.beginPath(); ctx.arc(SPEAKER_X, SPEAKER_Y, SPEAKER_R, 0, Math.PI * 2)
    ctx.fill(); ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, '🔊', SPEAKER_X, SPEAKER_Y, 68, '#fff')

    ctx.restore()
  }

  // ── 헬퍼 ───────────────────────────────────────────────────────────────────
  private txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
              size: number, color: string) {
    ctx.save()
    ctx.fillStyle    = color
    ctx.font         = `bold ${size}px sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s, x, y)
    ctx.restore()
  }

  private rr(ctx: CanvasRenderingContext2D, x: number, y: number,
             w: number, h: number, r: number) {
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
}
