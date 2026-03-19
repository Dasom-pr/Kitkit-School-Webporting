import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/lrcomprehension'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// Story area
const STORY_BOX_Y = 200
const STORY_BOX_W = 1600, STORY_BOX_H = 280

// Question area
const Q_Y = 560
const Q_BOX_W = 1600

// Answer choice cards (2 columns)
const CARD_W = 680, CARD_H = 170
const CARD_GAP_X = 80, CARD_GAP_Y = 40
const CARD_START_X = CX - CARD_W - CARD_GAP_X / 2
const CARD_START_Y = 800

// ─── Types ───────────────────────────────────────────────────────────────────
interface LRProblem {
  type: string
  script: string
  question: string
  audio: string
  answerType: string
  options: string[]
  answer: string
}

interface ChoiceCard {
  text: string
  x: number
  y: number
  w: number
  h: number
  isCorrect: boolean
  state: 'normal' | 'correct' | 'wrong'
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class LRComprehensionEngine extends BaseEngine {
  private levelNum: number
  private problems: LRProblem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private currentProblem: LRProblem | null = null
  private cards: ChoiceCard[] = []
  private isPlayingStory = false
  private storyAudio: HTMLAudioElement | null = null

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  private playAudio(filename: string, onEnd?: () => void) {
    if (this.storyAudio) {
      this.storyAudio.pause()
      this.storyAudio = null
    }
    if (!filename) { onEnd?.(); return }
    const url = assetUrl(`/assets/localized/en-us/games/lrcomprehension/sounds/${filename}`)
    const audio = new Audio(url)
    this.storyAudio = audio
    this.isPlayingStory = true
    audio.onended = () => {
      this.isPlayingStory = false
      this.storyAudio = null
      onEnd?.()
    }
    audio.play().catch(() => {
      this.isPlayingStory = false
      onEnd?.()
    })
  }

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.levelNum = level
  }

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
    const res  = await fetch('/data/games/lrcomprehension.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:LRProblem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    // Only use problems with questions and multiple choice answers
    const mcProblems = ld.problems.filter(p =>
      p.question && p.options.length >= 2 && p.answer
    )
    const shuffled = [...mcProblems].sort(() => Math.random() - 0.5)
    this.problems = shuffled.slice(0, 5)
    this.problemIndex = 0
    this.locked = false
    this.onProgressChange?.(0, this.problems.length)
    this.setupProblem()
    this.loaded = true
  }

  private setupProblem() {
    if (this.problemIndex >= this.problems.length) return
    const prob = this.problems[this.problemIndex]
    this.currentProblem = prob
    this.locked = false

    // Build answer cards
    const options = prob.options.slice(0, 4)  // max 4 choices
    this.cards = options.map((text, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      return {
        text,
        x: CARD_START_X + col * (CARD_W + CARD_GAP_X),
        y: CARD_START_Y + row * (CARD_H + CARD_GAP_Y),
        w: CARD_W,
        h: CARD_H,
        isCorrect: text === prob.answer,
        state: 'normal' as const,
      }
    })

    // Play story audio if available
    if (prob.script) {
      this.isPlayingStory = true
      this.playAudio(prob.script, () => {
        // Then play question audio
        if (prob.audio) this.playAudio(prob.audio)
      })
    } else if (prob.audio) {
      setTimeout(() => this.playAudio(prob.audio), 300)
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Story replay button
    if (this.currentProblem?.script) {
      if (x >= CX - 160 && x <= CX + 160 && y >= STORY_BOX_Y + STORY_BOX_H + 10 && y <= STORY_BOX_Y + STORY_BOX_H + 100) {
        this.isPlayingStory = true
        this.playAudio(this.currentProblem.script, () => {
          if (this.currentProblem?.audio) this.playAudio(this.currentProblem.audio)
        })
        return
      }
    }

    // Answer cards
    for (const card of this.cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.handleChoice(card)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleChoice(card: ChoiceCard) {
    if (card.isCorrect) {
      card.state = 'correct'
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 1000)
    } else {
      card.state = 'wrong'
      playSound(this.sfxIncorrect)
      setTimeout(() => { card.state = 'normal' }, 800)
    }
  }

  private nextProblem() {
    this.problemIndex++
    this.locked = false
    this.onProgressChange?.(this.problemIndex, this.problems.length)
    if (this.problemIndex >= this.problems.length) {
      setTimeout(() => { this.gameState = 'complete'; this.onComplete?.() }, 300)
      return
    }
    this.setupProblem()
  }

  stop() {
    if (this.storyAudio) { this.storyAudio.pause(); this.storyAudio = null }
    super.stop()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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

    // Background
    ctx.fillStyle = '#E3F2FD'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Story box
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 20
    ctx.beginPath()
    this.rr(ctx, CX - STORY_BOX_W / 2, STORY_BOX_Y, STORY_BOX_W, STORY_BOX_H, 24)
    ctx.fill(); ctx.shadowBlur = 0; ctx.restore()

    // Story text / playing indicator
    if (prob.script) {
      const storyLabel = this.isPlayingStory ? '🔊 Listening to story...' : '📖 Story played!'
      this.txt(ctx, storyLabel, CX, STORY_BOX_Y + 80, 60, '#1565C0')
      this.txt(ctx, `"${prob.script.replace('.m4a','').replace(/_/g,' ')}"`,
        CX, STORY_BOX_Y + STORY_BOX_H / 2 + 30, 46, '#5C6BC0')
    }

    // Replay button
    ctx.save()
    ctx.fillStyle = this.isPlayingStory ? '#42A5F5' : '#1976D2'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(CX, STORY_BOX_Y + STORY_BOX_H + 55, 50, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, '🔊', CX, STORY_BOX_Y + STORY_BOX_H + 55, 52, '#fff')

    // Question box
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    this.rr(ctx, CX - Q_BOX_W / 2, Q_Y, Q_BOX_W, 200, 20)
    ctx.fill(); ctx.restore()

    const qFontSize = prob.question.length > 50 ? 46 : prob.question.length > 35 ? 54 : 62
    this.txt(ctx, prob.question, CX, Q_Y + 100, qFontSize, '#1B5E20')

    // Answer cards
    for (const card of this.cards) {
      ctx.save()
      ctx.fillStyle = card.state === 'correct' ? 'rgba(76,175,80,0.9)' :
                      card.state === 'wrong'   ? 'rgba(220,50,50,0.9)' : 'rgba(255,255,255,0.9)'
      ctx.strokeStyle = card.state === 'correct' ? '#2E7D32' :
                        card.state === 'wrong'   ? '#B71C1C' : '#90CAF9'
      ctx.lineWidth = card.state !== 'normal' ? 5 : 3
      ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 12
      ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 20)
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore()

      const labelFontSize = card.text.length > 20 ? 42 : card.text.length > 12 ? 52 : 62
      this.txt(ctx, card.text, card.x + card.w / 2, card.y + card.h / 2, labelFontSize,
        card.state !== 'normal' ? '#fff' : '#1A237E')
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, 100, 60, '#1565C0')

    ctx.restore()
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
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
