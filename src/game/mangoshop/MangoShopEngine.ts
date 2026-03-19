import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/mangoshop'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// Mango box area (top center)
const BOX_Y = CY - 320
const BOX_H = 220

// Question text
const Q_Y = CY + 60

// Answer cards
const CARD_W = 280, CARD_H = 160
const CARD_GAP = 80
const TOTAL_W = 3 * CARD_W + 2 * CARD_GAP
const CARD_START_X = CX - TOTAL_W / 2
const CARD_Y = GAME_HEIGHT - 320

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  category: string
  question: string
  answer: number
}

interface ChoiceCard {
  value: number
  x: number
  y: number
  w: number
  h: number
  state: 'normal' | 'correct' | 'wrong'
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class MangoShopEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private cards: ChoiceCard[] = []
  private currentProblem: Problem | null = null

  // Images
  private imgBg      = loadImage(assetUrl(`${A}/mango-shop_image_background.png`))
  private imgBgL     = loadImage(assetUrl(`${A}/mango-shop_image_background-element_left.png`))
  private imgBgR     = loadImage(assetUrl(`${A}/mango-shop_image_background-element_right.png`))
  private imgBoxH    = loadImage(assetUrl(`${A}/mango-shop_image_box_horizontal.png`))
  private imgBoxV    = loadImage(assetUrl(`${A}/mango-shop_image_box_vertical.png`))
  private imgCardOn  = loadImage(assetUrl(`${A}/select-slot.png`))
  private imgCardOff = loadImage(assetUrl(`${A}/card_empty.png`))
  private imgPlate   = loadImage(assetUrl(`${A}/mango-shop_image_plate.png`))

  // Mango images (horizontal, 1-10)
  private mangosH: HTMLImageElement[] = Array.from({ length: 10 }, (_, i) =>
    loadImage(assetUrl(`${A}/mango-shop_image_mango_horizontal_${String(i + 1).padStart(2, '0')}.png`))
  )

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

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
    const res  = await fetch('/data/games/mangoshop.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems  = shuffled.slice(0, 6)
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

    // Generate 2 wrong answers near the correct one
    const ans = prob.answer
    const wrongs = new Set<number>()
    const candidates = [ans - 2, ans - 1, ans + 1, ans + 2, ans + 3, ans - 3]
      .filter(v => v > 0 && v !== ans)
    for (const c of candidates.sort(() => Math.random() - 0.5)) {
      if (wrongs.size >= 2) break
      wrongs.add(c)
    }

    const choices = [ans, ...Array.from(wrongs)].sort(() => Math.random() - 0.5)

    this.cards = choices.map((val, i) => ({
      value: val,
      x: CARD_START_X + i * (CARD_W + CARD_GAP),
      y: CARD_Y,
      w: CARD_W,
      h: CARD_H,
      state: 'normal' as const,
    }))
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
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
    const correct = card.value === this.currentProblem.answer
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
    this.drawImg(ctx, this.imgBg,  0, 0, GAME_WIDTH, GAME_HEIGHT)
    this.drawImg(ctx, this.imgBgL, 0, GAME_HEIGHT * 0.3, GAME_WIDTH * 0.18, GAME_HEIGHT * 0.55)
    this.drawImg(ctx, this.imgBgR, GAME_WIDTH * 0.82, GAME_HEIGHT * 0.3, GAME_WIDTH * 0.18, GAME_HEIGHT * 0.55)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#fff')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Parse question to get operands
    const parts = prob.question.match(/(\d+)\s*([+\-*])\s*(\d+)(?:\s*[+\-*]\s*(\d+))?/)
    const nums = parts ? [parseInt(parts[1]), parseInt(parts[3]), parts[4] ? parseInt(parts[4]) : null].filter(Boolean) as number[] : []
    const op = parts ? parts[2] : '+'

    // Draw mango boxes
    if (nums.length >= 2) {
      const boxW = Math.min(600, GAME_WIDTH * 0.22)
      const totalBoxW = nums.length * boxW + (nums.length - 1) * 80
      const boxStartX = CX - totalBoxW / 2

      for (let i = 0; i < nums.length; i++) {
        const bx = boxStartX + i * (boxW + 80)
        const by = BOX_Y

        // Box background
        this.drawImg(ctx, this.imgBoxH, bx, by, boxW, BOX_H)

        // Draw mangos inside (max 10 per box)
        const count = Math.min(nums[i], 10)
        if (count > 0 && this.mangosH[count - 1].complete) {
          const mw = boxW * 0.8, mh = BOX_H * 0.7
          ctx.drawImage(this.mangosH[count - 1], bx + boxW * 0.1, by + BOX_H * 0.15, mw, mh)
        }

        // Number label below box
        this.txt(ctx, String(nums[i]), bx + boxW / 2, by + BOX_H + 50, 80, '#5D4037')

        // Operator between boxes
        if (i < nums.length - 1) {
          this.txt(ctx, op, bx + boxW + 40, by + BOX_H / 2, 90, '#FF6F00')
        }
      }
    }

    // Question display
    this.txt(ctx, `${prob.question} = ?`, CX, Q_Y, 100, '#2E4057')

    // Answer plate
    const plateW = TOTAL_W + 80, plateH = CARD_H + 100
    this.drawImg(ctx, this.imgPlate, CX - plateW / 2, CARD_Y - 40, plateW, plateH)

    // Answer cards
    for (const card of this.cards) {
      const img = card.state !== 'normal' ? this.imgCardOn : this.imgCardOff
      this.drawImg(ctx, img, card.x, card.y, card.w, card.h)

      if (card.state === 'correct') {
        ctx.save()
        ctx.fillStyle = 'rgba(76,175,80,0.4)'
        ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 18); ctx.fill()
        ctx.restore()
      } else if (card.state === 'wrong') {
        ctx.save()
        ctx.fillStyle = 'rgba(220,50,50,0.4)'
        ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 18); ctx.fill()
        ctx.restore()
      }

      this.txt(ctx, String(card.value), card.x + card.w / 2, card.y + card.h / 2, 80,
        card.state === 'correct' ? '#1B5E20' : card.state === 'wrong' ? '#B71C1C' : '#4E342E')
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
