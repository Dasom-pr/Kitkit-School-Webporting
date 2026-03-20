import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/wordnote'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// Image display (center-left)
const IMG_W = 400, IMG_H = 340
const IMG_X = 240
const IMG_Y = CY - IMG_H / 2 - 80

// Syllable card slots (where the word is assembled - right side)
const SLOT_Y = CY - 100
const SLOT_W = 280, SLOT_H = 160
const SLOT_GAP = 20

// Available cards (bottom)
const AVAIL_Y = CY + 300

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  word: string
  cards: string[]   // syllable parts
  sound: string
  image: string
}

interface Slot {
  text: string      // expected syllable
  filled: boolean
  x: number
  y: number
  w: number
  h: number
}

interface AvailCard {
  text: string
  x: number
  y: number
  w: number
  h: number
  used: boolean
  state: 'normal' | 'correct' | 'wrong'
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class WordNoteEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private currentProblem: Problem | null = null
  private slots: Slot[] = []
  private availCards: AvailCard[] = []
  private wordImage: HTMLImageElement | null = null

  // Sounds only – no specific UI images needed for WordNote

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  private playWordSound(filename: string) {
    const url = assetUrl(`/assets/games/readingbird/sound/${filename}`)
    const audio = new Audio(url)
    audio.onerror = () => {}
    audio.play().catch(() => {})
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
    const res  = await fetch('/data/games/wordnote.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems = shuffled.slice(0, 6)
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

    // Build slots (one per syllable card)
    const totalSlotW = prob.cards.length * SLOT_W + (prob.cards.length - 1) * SLOT_GAP
    const slotStartX = CX + 80

    this.slots = prob.cards.map((card, i) => ({
      text: card,
      filled: false,
      x: slotStartX + i * (SLOT_W + SLOT_GAP),
      y: SLOT_Y,
      w: SLOT_W,
      h: SLOT_H,
    }))

    // Shuffle available cards
    const shuffled = [...prob.cards].sort(() => Math.random() - 0.5)
    const totalAvailW = shuffled.length * (SLOT_W + SLOT_GAP) - SLOT_GAP
    const availStartX = CX - totalAvailW / 2

    this.availCards = shuffled.map((text, i) => ({
      text,
      x: availStartX + i * (SLOT_W + SLOT_GAP),
      y: AVAIL_Y,
      w: SLOT_W,
      h: SLOT_H,
      used: false,
      state: 'normal' as const,
    }))

    // Load word image
    if (prob.image) {
      this.wordImage = loadImage(assetUrl(`${A}/images/${prob.image}`))
    } else {
      this.wordImage = null
    }

    // Play the word sound
    if (prob.sound) setTimeout(() => this.playWordSound(prob.sound), 300)
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Speaker button
    if (x >= CX - 60 && x <= CX + 60 && y >= IMG_Y + IMG_H + 20 && y <= IMG_Y + IMG_H + 130) {
      if (this.currentProblem?.sound) this.playWordSound(this.currentProblem.sound)
      return
    }

    // Available card tap
    for (const card of this.availCards) {
      if (card.used) continue
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.handleCardTap(card)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleCardTap(card: AvailCard) {
    // Find the next unfilled slot
    const nextSlot = this.slots.find(s => !s.filled)
    if (!nextSlot) return

    if (card.text === nextSlot.text) {
      card.state = 'correct'
      card.used = true
      nextSlot.filled = true
      playSound(this.sfxCorrect)

      // Check if all slots filled
      if (this.slots.every(s => s.filled)) {
        this.locked = true
        if (this.currentProblem?.sound) setTimeout(() => this.playWordSound(this.currentProblem!.sound), 200)
        setTimeout(() => this.nextProblem(), 1200)
      }
    } else {
      card.state = 'wrong'
      playSound(this.sfxIncorrect)
      setTimeout(() => { card.state = 'normal' }, 700)
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
    ctx.fillStyle = '#FFF8E7'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Word image (left side)
    if (this.wordImage) {
      this.drawImg(ctx, this.wordImage, IMG_X, IMG_Y, IMG_W, IMG_H)
    } else {
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath(); this.rr(ctx, IMG_X, IMG_Y, IMG_W, IMG_H, 20); ctx.fill()
      ctx.restore()
      this.txt(ctx, prob.word, IMG_X + IMG_W / 2, IMG_Y + IMG_H / 2, 90, '#2E4057')
    }

    // Speaker button (drawn as circle)
    ctx.save()
    ctx.fillStyle = '#FF8A65'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(CX, IMG_Y + IMG_H + 70, 55, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, '🔊', CX, IMG_Y + IMG_H + 70, 60, '#fff')

    // Assembly slots (right-ish)
    for (const slot of this.slots) {
      ctx.save()
      ctx.fillStyle = slot.filled ? 'rgba(76,175,80,0.8)' : 'rgba(255,255,255,0.85)'
      ctx.strokeStyle = slot.filled ? '#2E7D32' : '#BDBDBD'
      ctx.lineWidth = 4
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8
      ctx.beginPath(); this.rr(ctx, slot.x, slot.y, slot.w, slot.h, 16)
      ctx.fill(); ctx.stroke(); ctx.restore()
      if (slot.filled) {
        this.txt(ctx, slot.text, slot.x + slot.w / 2, slot.y + slot.h / 2, 72, '#fff')
      } else {
        this.txt(ctx, '_', slot.x + slot.w / 2, slot.y + slot.h / 2, 72, '#BDBDBD')
      }
    }

    // Instruction
    this.txt(ctx, `Tap the parts in order to spell: ${prob.word}`, CX, SLOT_Y - 80, 50, '#5D4037')

    // Available cards
    for (const card of this.availCards) {
      if (card.used) continue
      ctx.save()
      ctx.fillStyle = card.state === 'wrong' ? 'rgba(220,50,50,0.85)' : 'rgba(255,183,77,0.9)'
      ctx.strokeStyle = card.state === 'wrong' ? '#B71C1C' : '#E65100'
      ctx.lineWidth = 4
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10
      ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 16)
      ctx.fill(); ctx.stroke(); ctx.restore()

      this.txt(ctx, card.text, card.x + card.w / 2, card.y + card.h / 2, 72,
        card.state === 'wrong' ? '#fff' : '#2E4057')
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, 80, 60, '#5D4037')

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
