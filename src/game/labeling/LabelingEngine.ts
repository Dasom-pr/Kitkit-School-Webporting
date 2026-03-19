import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/labeling'

// ─── Types ───────────────────────────────────────────────────────────────────
interface LabelDef {
  word: string
  x: number   // original coords (based on ~1600×1800 design)
  y: number
  sound: string
}

interface Problem {
  picture: string
  labels: LabelDef[]
}

// Card state
interface WordCard {
  word: string
  labelIdx: number   // which label this corresponds to
  cx: number         // center x in game coords
  cy: number         // center y in game coords
  w: number
  h: number
  matched: boolean
  selected: boolean
  state: 'normal' | 'correct' | 'wrong'
}

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// The original image coordinate system (from TSV)
const ORIG_W = 1600, ORIG_H = 1800

// Displayed image area (center-ish, scaled)
const IMG_DISPLAY_W = 1200, IMG_DISPLAY_H = 900
const IMG_X = (GAME_WIDTH - IMG_DISPLAY_W) / 2
const IMG_Y = 200

// Scale from original coords to display coords
const scaleX = IMG_DISPLAY_W / ORIG_W
const scaleY = IMG_DISPLAY_H / ORIG_H

// Word card strip at bottom
const CARD_H = 130
const CARD_Y = GAME_HEIGHT - 260
const CARD_W_BASE = 260

// ─── Engine ──────────────────────────────────────────────────────────────────
export class LabelingEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private currentProblem: Problem | null = null
  private wordCards: WordCard[] = []
  private selectedCard: WordCard | null = null
  private matchedCount = 0

  // Images
  private imgBg       = loadImage(assetUrl(`${A}/ui_bg.jpg`))
  private imgCardBody = loadImage(assetUrl(`${A}/ui_card_body.png`))
  private problemImage: HTMLImageElement | null = null

  // Sounds
  private sfxCorrect  = loadAudio(assetUrl(`${A}/sounds/card_correct_ver2.m4a`))
  private sfxWrong    = loadAudio(assetUrl(`${A}/sounds/card_pick_ver1.m4a`))

  private playWordSound(filename: string) {
    const url = assetUrl(`/assets/localized/en-us/games/labeling/sound/${filename}`)
    const audio = new Audio(url)
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
    const res  = await fetch('/data/games/labeling.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems = shuffled.slice(0, 4)
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
    this.selectedCard = null
    this.matchedCount = 0

    // Load problem image
    this.problemImage = loadImage(assetUrl(`${A}/levels/${prob.picture}`))

    // Build word cards at bottom (shuffled)
    const shuffledLabels = [...prob.labels].sort(() => Math.random() - 0.5)
    const totalCardW = shuffledLabels.length * (CARD_W_BASE + 30) - 30
    const cardStartX = CX - totalCardW / 2

    this.wordCards = shuffledLabels.map((label, i) => ({
      word: label.word,
      labelIdx: prob.labels.indexOf(label),
      cx: cardStartX + i * (CARD_W_BASE + 30) + CARD_W_BASE / 2,
      cy: CARD_Y + CARD_H / 2,
      w: Math.max(CARD_W_BASE, label.word.length * 28),
      h: CARD_H,
      matched: false,
      selected: false,
      state: 'normal' as const,
    }))
  }

  // Convert original label coord to display coord
  private toDisplayX(ox: number): number {
    return IMG_X + (ox / ORIG_W) * IMG_DISPLAY_W
  }
  private toDisplayY(oy: number): number {
    // Original Y=0 is top (unlike Cocos which has Y=0 at bottom)
    return IMG_Y + (oy / ORIG_H) * IMG_DISPLAY_H
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Word card at bottom
    for (const card of this.wordCards) {
      if (card.matched) continue
      const cx = card.cx, cy = card.cy
      if (x >= cx - card.w / 2 && x <= cx + card.w / 2 &&
          y >= cy - card.h / 2 && y <= cy + card.h / 2) {
        this.handleCardTap(card, x, y)
        return
      }
    }

    // If a card is selected, check if tapping a label slot on image
    if (this.selectedCard && this.currentProblem) {
      const label = this.currentProblem.labels[this.selectedCard.labelIdx]
      if (!label) {
        // Try to find the matching label
        const prob = this.currentProblem
        const matchedLabel = prob.labels.find(l => l.word === this.selectedCard!.word)
        if (matchedLabel) {
          const dx = this.toDisplayX(Math.abs(matchedLabel.x))
          const dy = this.toDisplayY(Math.abs(matchedLabel.y))
          const dist = Math.hypot(x - dx, y - dy)
          if (dist < 120) {
            this.handleLabelDrop()
            return
          }
        }
      }

      // Check if tapping near any label spot
      for (const lbl of this.currentProblem.labels) {
        if (lbl.word !== this.selectedCard.word) continue
        const dx = this.toDisplayX(Math.abs(lbl.x))
        const dy = this.toDisplayY(Math.abs(lbl.y))
        const dist = Math.hypot(x - dx, y - dy)
        if (dist < 150) {
          this.handleLabelDrop()
          return
        }
      }
    }
  }

  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleCardTap(card: WordCard, _x: number, _y: number) {
    // Deselect previously selected
    if (this.selectedCard) this.selectedCard.selected = false

    if (this.selectedCard === card) {
      this.selectedCard = null
      return
    }

    card.selected = true
    this.selectedCard = card

    // Play word sound
    if (this.currentProblem) {
      const label = this.currentProblem.labels.find(l => l.word === card.word)
      if (label?.sound) this.playWordSound(label.sound)
    }
  }

  private handleLabelDrop() {
    if (!this.selectedCard) return
    this.selectedCard.state = 'correct'
    this.selectedCard.matched = true
    this.selectedCard.selected = false
    const card = this.selectedCard
    this.selectedCard = null
    this.matchedCount++
    playSound(this.sfxCorrect)

    if (this.matchedCount >= (this.currentProblem?.labels.length ?? 0)) {
      this.locked = true
      setTimeout(() => this.nextProblem(), 1200)
    }

    // Flash the card briefly
    setTimeout(() => { card.state = 'normal' }, 800)
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

    // Problem image
    if (this.problemImage) {
      this.drawImg(ctx, this.problemImage, IMG_X, IMG_Y, IMG_DISPLAY_W, IMG_DISPLAY_H)
    }

    // Label spots on image (circles for each label position)
    for (const label of this.currentProblem.labels) {
      const isMatched = this.wordCards.find(c => c.word === label.word && c.matched)
      const dx = this.toDisplayX(Math.abs(label.x))
      const dy = this.toDisplayY(Math.abs(label.y))

      ctx.save()
      if (isMatched) {
        // Show matched label
        ctx.fillStyle = 'rgba(76,175,80,0.85)'
        ctx.strokeStyle = '#2E7D32'; ctx.lineWidth = 4
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 12
        const tw = Math.max(200, label.word.length * 26)
        ctx.beginPath(); this.rr(ctx, dx - tw/2, dy - 36, tw, 72, 14); ctx.fill(); ctx.stroke()
        ctx.shadowBlur = 0
        this.txt(ctx, label.word, dx, dy, 52, '#fff')
      } else {
        // Empty slot (dotted circle)
        ctx.strokeStyle = this.selectedCard?.word === label.word
          ? '#FFC107' : 'rgba(255,255,255,0.6)'
        ctx.lineWidth = 5
        ctx.setLineDash([12, 8])
        ctx.beginPath(); ctx.arc(dx, dy, 50, 0, Math.PI * 2); ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(0,0,0,0.3)'
        ctx.beginPath(); ctx.arc(dx, dy, 50, 0, Math.PI * 2); ctx.fill()
        this.txt(ctx, '?', dx, dy, 52, 'rgba(255,255,255,0.7)')
      }
      ctx.restore()
    }

    // Hint: "Tap a word, then tap its spot"
    this.txt(ctx, this.selectedCard
      ? `Place "${this.selectedCard.word}" on the correct spot`
      : 'Tap a word card, then tap its spot on the image',
      CX, IMG_Y - 50, 52, '#fff')

    // Word cards at bottom
    for (const card of this.wordCards) {
      if (card.matched) continue
      const cx = card.cx, cy = card.cy
      ctx.save()
      ctx.fillStyle = card.selected ? '#FFC107' : 'rgba(255,255,255,0.92)'
      ctx.strokeStyle = card.selected ? '#E65100' : '#9E9E9E'
      ctx.lineWidth = card.selected ? 5 : 3
      ctx.shadowColor = card.selected ? 'rgba(255,193,7,0.5)' : 'rgba(0,0,0,0.15)'
      ctx.shadowBlur = card.selected ? 20 : 8
      ctx.beginPath(); this.rr(ctx, cx - card.w/2, cy - card.h/2, card.w, card.h, 20)
      ctx.fill(); ctx.stroke(); ctx.restore()
      this.txt(ctx, card.word, cx, cy, 58, card.selected ? '#1a237e' : '#2E4057')
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
