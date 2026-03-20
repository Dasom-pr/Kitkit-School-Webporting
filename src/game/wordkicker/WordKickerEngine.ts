import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/wordkicker'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// Sentence display area
const SENTENCE_Y = 340

// 3 answer cards (centered)
const CARD_W = 380, CARD_H = 140
const CARD_GAP = 60
const TOTAL_CARD_W = 3 * CARD_W + 2 * CARD_GAP
const CARD_START_X = CX - TOTAL_CARD_W / 2
const CARD_Y = GAME_HEIGHT - 420

// Characters
const KICKER_W = 380, KICKER_H = 380
const KEEPER_W = 380, KEEPER_H = 380
const KICKER_X = CX - 500 - KICKER_W / 2
const KEEPER_X = CX + 500 - KEEPER_W / 2
const CHAR_Y = CY - 80

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  blank: string
  answer: string
  sound: string
  wrong: string[]
}

interface ChoiceCard {
  label: string
  x: number
  y: number
  w: number
  h: number
  state: 'normal' | 'correct' | 'wrong'
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class WordKickerEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private cards: ChoiceCard[] = []
  private currentProblem: Problem | null = null

  // Images
  private imgBg      = loadImage(assetUrl(`${A}/bg.png`))
  private imgKicker  = loadImage(assetUrl(`${A}/wardkicker_image_thumbnail_kicker.png`))
  private imgKeeper  = loadImage(assetUrl(`${A}/wardkicker_image_thumbnail_keeper.png`))
  private imgBalloon = loadImage(assetUrl(`${A}/wardkicker_image_yellow.png`))
  private imgCardOn  = loadImage(assetUrl(`${A}/card_on.png`))
  private imgCardOff = loadImage(assetUrl(`${A}/card_off.png`))
  private imgLine    = loadImage(assetUrl(`${A}/wardkicker_image_line.png`))
  private imgSpeaker = loadImage(assetUrl(`${A}/wardkicker_button_speaker_normal.png`))

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))
  private currentAudio: HTMLAudioElement | null = null

  // Game type: 'word' or 'math'
  private gameType: 'word' | 'math'
  private dataPath: string

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number, gameType: 'word' | 'math' = 'word') {
    super(canvas)
    this.levelNum = level
    this.gameType = gameType
    this.dataPath = gameType === 'math' ? '/data/games/mathkicker.json' : '/data/games/wordkicker.json'
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
    const res  = await fetch(this.dataPath)
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    // Shuffle and pick 6 problems
    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems = shuffled.slice(0, 6)
    this.problemIndex = 0
    this.loaded = false
    this.locked = false
    this.onProgressChange?.(0, this.problems.length)
    this.setupProblem()
    this.loaded = true
  }

  private setupProblem() {
    if (this.problemIndex >= this.problems.length) return
    const prob = this.problems[this.problemIndex]
    this.currentProblem = prob

    // Build shuffled choices: answer + 3 wrongs, shuffle, pick 3 total (answer + 2 wrongs)
    const wrongs = [...prob.wrong].sort(() => Math.random() - 0.5).slice(0, 2)
    const all = [prob.answer, ...wrongs].sort(() => Math.random() - 0.5)

    this.cards = all.map((label, i) => ({
      label,
      x: CARD_START_X + i * (CARD_W + CARD_GAP),
      y: CARD_Y,
      w: CARD_W,
      h: CARD_H,
      state: 'normal' as const,
    }))

    // Auto-play sentence sound
    if (prob.sound) this.playSound(prob.sound)
  }

  private playSound(filename: string) {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    if (!filename) return
    const url = assetUrl(`/assets/games/wordkicker/sound/${filename}`)
    const audio = new Audio(url)
    this.currentAudio = audio
    audio.onerror = () => {}
    audio.play().catch(() => {})
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Speaker button hit test (replay sound)
    const spkX = CX - 50, spkY = SENTENCE_Y + 100
    const spkSize = 80
    if (x >= spkX && x <= spkX + spkSize && y >= spkY && y <= spkY + spkSize) {
      if (this.currentProblem?.sound) this.playSound(this.currentProblem.sound)
      return
    }

    // Card hit test
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
    if (!this.currentProblem) return
    const correct = card.label === this.currentProblem.answer

    this.locked = true
    card.state = correct ? 'correct' : 'wrong'

    if (correct) {
      playSound(this.sfxCorrect)
      setTimeout(() => this.nextProblem(), 1000)
    } else {
      playSound(this.sfxIncorrect)
      setTimeout(() => {
        card.state = 'normal'
        this.locked = false
      }, 800)
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
    this.drawImg(ctx, this.imgBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#fff')
      ctx.restore(); return
    }

    // Decorative line
    this.drawImg(ctx, this.imgLine, CX - 600, SENTENCE_Y + 160, 1200, 12)

    // Characters
    this.drawImg(ctx, this.imgKicker, KICKER_X, CHAR_Y, KICKER_W, KICKER_H)
    this.drawImg(ctx, this.imgKeeper, KEEPER_X, CHAR_Y, KEEPER_W, KEEPER_H)

    // Speech balloon + sentence
    const ballW = 900, ballH = 240
    this.drawImg(ctx, this.imgBalloon, CX - ballW / 2, SENTENCE_Y - 140, ballW, ballH)
    const blank = this.currentProblem.blank
    const fontSize = blank.length > 40 ? 46 : blank.length > 30 ? 54 : 62
    this.txt(ctx, blank, CX, SENTENCE_Y - 20, fontSize, '#2E4057')

    // Speaker button
    this.drawImg(ctx, this.imgSpeaker, CX - 40, SENTENCE_Y + 100, 80, 80)

    // Answer cards
    for (const card of this.cards) {
      const img = card.state === 'normal' ? this.imgCardOff : this.imgCardOn
      this.drawImg(ctx, img, card.x, card.y, card.w, card.h)

      // Color overlay
      if (card.state === 'correct') {
        ctx.save()
        ctx.fillStyle = 'rgba(76,175,80,0.35)'
        ctx.beginPath()
        this.rr(ctx, card.x, card.y, card.w, card.h, 16)
        ctx.fill()
        ctx.restore()
      } else if (card.state === 'wrong') {
        ctx.save()
        ctx.fillStyle = 'rgba(220,50,50,0.35)'
        ctx.beginPath()
        this.rr(ctx, card.x, card.y, card.w, card.h, 16)
        ctx.fill()
        ctx.restore()
      }

      const labelSize = card.label.length > 12 ? 44 : card.label.length > 8 ? 52 : 60
      this.txt(ctx, card.label, card.x + card.w / 2, card.y + card.h / 2, labelSize,
        card.state === 'correct' ? '#1B5E20' : card.state === 'wrong' ? '#B71C1C' : '#2E4057')
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, 80, 60, 'rgba(255,255,255,0.9)')

    ctx.restore()
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private drawImg(ctx: CanvasRenderingContext2D, img: HTMLImageElement,
                  x: number, y: number, w: number, h: number) {
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x, y, w, h)
  }

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
