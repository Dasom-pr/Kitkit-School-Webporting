import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/wordnote'

// ─── Constants ───────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// ── Mode A (syllable, cards ≤ 10) ──
const IMG_X = 160, IMG_Y = 200, IMG_W = 520, IMG_H = 440
const SPEAK_CX = IMG_X + IMG_W / 2
const SPEAK_CY = IMG_Y + IMG_H + 75

const SLOT_W = 290, SLOT_H = 165, SLOT_GAP = 28
const SLOT_Y = 540

const AVAIL_W = 290, AVAIL_H = 165, AVAIL_GAP = 28
const AVAIL_Y = 1340

// ── Mode B (phonics keyboard, cards > 10) ──
const KB_WORD_Y   = 150
const LSLOT_H     = 150, LSLOT_GAP = 18, LSLOT_Y = 380
const SPEAK_B_CX  = CX
const SPEAK_B_CY  = 620

const KB_COLS = 7
const KB_CW   = 310, KB_CH  = 140, KB_GAP = 16
const KB_Y    = 760

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  word: string
  cards: string[]
  sound: string
  image: string
}

interface Slot {
  text: string
  filled: boolean
  filledWith: string
  x: number; y: number; w: number; h: number
}

interface Card {
  text: string
  origX: number; origY: number
  x: number; y: number; w: number; h: number
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
  private isModeB = false

  // Mode A
  private slots: Slot[] = []
  private availCards: Card[] = []
  private wordImage: HTMLImageElement | null = null

  // Drag (Mode A)
  private dragCard: Card | null = null
  private dragX = 0
  private dragY = 0

  // Mode B
  private wordSlots: Slot[] = []
  private kbCards: Card[] = []
  private letterPos = 0

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
    const res  = await fetch('/data/games/wordnote.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]
    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems = shuffled.slice(0, 6)
    this.problemIndex = 0
    this.onProgressChange?.(0, this.problems.length)
    this.setupProblem()
    this.loaded = true
  }

  private setupProblem() {
    if (this.problemIndex >= this.problems.length) return
    const prob = this.problems[this.problemIndex]
    this.currentProblem = prob
    this.locked = false
    this.dragCard = null
    this.isModeB = prob.cards.length > 10

    if (this.isModeB) {
      this.setupModeB(prob)
    } else {
      this.setupModeA(prob)
    }

    if (prob.sound) setTimeout(() => this.playWordSound(prob.sound), 300)
  }

  // ── Mode A setup ────────────────────────────────────────────────────────────
  private setupModeA(prob: Problem) {
    const n = prob.cards.length
    const totalSlotW = n * SLOT_W + (n - 1) * SLOT_GAP

    // Center slots in the right portion (to the right of the image)
    const rightStart = IMG_X + IMG_W + 60
    const rightWidth = GAME_WIDTH - rightStart - 60
    const slotStartX = rightStart + (rightWidth - totalSlotW) / 2

    this.slots = prob.cards.map((text, i) => ({
      text,
      filled: false,
      filledWith: '',
      x: slotStartX + i * (SLOT_W + SLOT_GAP),
      y: SLOT_Y,
      w: SLOT_W,
      h: SLOT_H,
    }))

    // Shuffle available cards and lay them out centered at bottom
    const shuffled = [...prob.cards].sort(() => Math.random() - 0.5)
    const totalAvailW = shuffled.length * (AVAIL_W + AVAIL_GAP) - AVAIL_GAP
    const availStartX = CX - totalAvailW / 2

    this.availCards = shuffled.map((text, i) => {
      const x = availStartX + i * (AVAIL_W + AVAIL_GAP)
      return { text, origX: x, origY: AVAIL_Y, x, y: AVAIL_Y, w: AVAIL_W, h: AVAIL_H, used: false, state: 'normal' as const }
    })

    this.wordImage = prob.image ? loadImage(assetUrl(`${A}/images/${prob.image}`)) : null
  }

  // ── Mode B setup ────────────────────────────────────────────────────────────
  private setupModeB(prob: Problem) {
    const word = prob.word
    const n = word.length

    // Word slots: one per letter, centered, max width 260
    const slotW = Math.min(260, Math.floor((GAME_WIDTH - 200) / n) - LSLOT_GAP)
    const totalW = n * slotW + (n - 1) * LSLOT_GAP
    const startX = CX - totalW / 2

    this.wordSlots = word.split('').map((ch, i) => ({
      text: ch,
      filled: false,
      filledWith: '',
      x: startX + i * (slotW + LSLOT_GAP),
      y: LSLOT_Y,
      w: slotW,
      h: LSLOT_H,
    }))

    this.letterPos = 0

    // Keyboard grid
    const totalKbW = KB_COLS * KB_CW + (KB_COLS - 1) * KB_GAP
    const kbStartX = CX - totalKbW / 2

    this.kbCards = prob.cards.map((text, i) => {
      const col = i % KB_COLS
      const row = Math.floor(i / KB_COLS)
      const x = kbStartX + col * (KB_CW + KB_GAP)
      const y = KB_Y + row * (KB_CH + KB_GAP)
      return { text, origX: x, origY: y, x, y, w: KB_CW, h: KB_CH, used: false, state: 'normal' as const }
    })
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    if (this.isModeB) {
      this.handleModeBTap(x, y)
    } else {
      this.handleModeADown(x, y)
    }
  }

  onPointerMove(x: number, y: number) {
    if (this.dragCard) {
      this.dragX = x
      this.dragY = y
    }
  }

  onPointerUp(x: number, y: number) {
    if (!this.dragCard) return
    const card = this.dragCard
    this.dragCard = null

    // Check drop target
    for (const slot of this.slots) {
      if (slot.filled) continue
      if (x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h) {
        if (card.text === slot.text) {
          card.used = true
          card.state = 'correct'
          slot.filled = true
          slot.filledWith = card.text
          playSound(this.sfxCorrect)
          if (this.slots.every(s => s.filled)) {
            this.locked = true
            if (this.currentProblem?.sound)
              setTimeout(() => this.playWordSound(this.currentProblem!.sound), 200)
            setTimeout(() => this.nextProblem(), 1200)
          }
        } else {
          card.state = 'wrong'
          playSound(this.sfxIncorrect)
          setTimeout(() => { card.state = 'normal' }, 700)
        }
        return
      }
    }
    // Dropped outside — card snaps back
    // (card.x/y are still origX/origY; no update needed)
  }

  private handleModeADown(x: number, y: number) {
    // Speaker
    const sr = 55
    if (Math.hypot(x - SPEAK_CX, y - SPEAK_CY) < sr) {
      if (this.currentProblem?.sound) this.playWordSound(this.currentProblem.sound)
      return
    }
    // Pick up available card
    for (const card of [...this.availCards].reverse()) {
      if (card.used) continue
      if (x >= card.origX && x <= card.origX + card.w &&
          y >= card.origY && y <= card.origY + card.h) {
        this.dragCard = card
        this.dragX = x
        this.dragY = y
        return
      }
    }
  }

  private handleModeBTap(x: number, y: number) {
    if (!this.currentProblem) return

    // Speaker
    const sr = 55
    if (Math.hypot(x - SPEAK_B_CX, y - SPEAK_B_CY) < sr) {
      if (this.currentProblem.sound) this.playWordSound(this.currentProblem.sound)
      return
    }

    const word = this.currentProblem.word.toLowerCase()

    for (const card of this.kbCards) {
      if (x < card.x || x > card.x + card.w || y < card.y || y > card.y + card.h) continue

      // Match check: try all variants (e.g. "m/n" → "m" or "n")
      let matchLen = 0
      for (const v of card.text.split('/')) {
        const vl = v.toLowerCase()
        if (word.slice(this.letterPos, this.letterPos + vl.length) === vl) {
          matchLen = vl.length
          break
        }
      }

      if (matchLen > 0) {
        // Fill the matched letter slots
        for (let k = 0; k < matchLen; k++) {
          const si = this.letterPos + k
          if (si < this.wordSlots.length) {
            this.wordSlots[si].filled = true
            this.wordSlots[si].filledWith = word[si]
          }
        }
        card.state = 'correct'
        setTimeout(() => { card.state = 'normal' }, 500)
        this.letterPos += matchLen
        playSound(this.sfxCorrect)

        if (this.letterPos >= word.length) {
          this.locked = true
          if (this.currentProblem.sound)
            setTimeout(() => this.playWordSound(this.currentProblem!.sound), 200)
          setTimeout(() => this.nextProblem(), 1200)
        }
      } else {
        card.state = 'wrong'
        playSound(this.sfxIncorrect)
        setTimeout(() => { card.state = 'normal' }, 600)
      }
      return
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

  private playWordSound(filename: string) {
    const url = assetUrl(`/assets/games/readingbird/sound/${filename}`)
    const audio = new Audio(url)
    audio.onerror = () => {}
    audio.play().catch(() => {})
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  update(_t: number, _dt: number) {}

  draw() {
    const { ctx } = this
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight)

    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const ox = (w - GAME_WIDTH  * this.gameScale) / 2
    const oy = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(this.gameScale, this.gameScale)

    // Background
    ctx.fillStyle = '#FFF8E7'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', CX, CY, 80, '#888')
      ctx.restore(); return
    }

    if (this.isModeB) {
      this.drawModeB(ctx)
    } else {
      this.drawModeA(ctx)
    }

    ctx.restore()
  }

  private drawModeA(ctx: CanvasRenderingContext2D) {
    const prob = this.currentProblem!

    // Left: word image or word text
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.beginPath(); this.rr(ctx, IMG_X, IMG_Y, IMG_W, IMG_H, 24); ctx.fill()
    ctx.restore()

    if (this.wordImage?.complete && this.wordImage.naturalWidth > 0) {
      ctx.drawImage(this.wordImage, IMG_X, IMG_Y, IMG_W, IMG_H)
    } else {
      this.txt(ctx, prob.word, IMG_X + IMG_W / 2, IMG_Y + IMG_H / 2, 100, '#2E4057')
    }

    // Speaker
    ctx.save()
    ctx.fillStyle = '#FF8A65'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(SPEAK_CX, SPEAK_CY, 55, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, '🔊', SPEAK_CX, SPEAK_CY, 60, '#fff')

    // Assembly slots
    for (const slot of this.slots) {
      ctx.save()
      ctx.fillStyle = slot.filled ? 'rgba(76,175,80,0.85)' : 'rgba(255,255,255,0.85)'
      ctx.strokeStyle = slot.filled ? '#2E7D32' : '#90CAF9'
      ctx.lineWidth = 5
      ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 8
      ctx.beginPath(); this.rr(ctx, slot.x, slot.y, slot.w, slot.h, 18)
      ctx.fill(); ctx.stroke(); ctx.restore()
      const label = slot.filled ? slot.filledWith : '_'
      this.txt(ctx, label, slot.x + slot.w / 2, slot.y + slot.h / 2, 76,
        slot.filled ? '#fff' : '#90CAF9')
    }

    // Instruction
    this.txt(ctx, `Spell: ${prob.word}`, CX, SLOT_Y - 90, 52, '#5D4037')

    // Available cards (not dragging)
    for (const card of this.availCards) {
      if (card.used) continue
      if (card === this.dragCard) continue  // drawn separately below
      this.drawCard(ctx, card, card.origX, card.origY)
    }

    // Drag ghost
    if (this.dragCard) {
      ctx.save(); ctx.globalAlpha = 0.85
      this.drawCard(ctx, this.dragCard,
        this.dragX - this.dragCard.w / 2,
        this.dragY - this.dragCard.h / 2)
      ctx.restore()
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`, GAME_WIDTH - 140, 80, 55, '#5D4037')
  }

  private drawModeB(ctx: CanvasRenderingContext2D) {
    const prob = this.currentProblem!

    // Word title
    this.txt(ctx, prob.word.toUpperCase(), CX, KB_WORD_Y, 88, '#2E4057')

    // Letter slots
    for (const slot of this.wordSlots) {
      ctx.save()
      ctx.fillStyle = slot.filled ? 'rgba(76,175,80,0.85)' : 'rgba(255,255,255,0.85)'
      ctx.strokeStyle = slot.filled ? '#2E7D32' : '#90CAF9'
      ctx.lineWidth = 5
      ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 6
      ctx.beginPath(); this.rr(ctx, slot.x, slot.y, slot.w, slot.h, 14)
      ctx.fill(); ctx.stroke(); ctx.restore()
      const label = slot.filled ? slot.filledWith : '_'
      this.txt(ctx, label, slot.x + slot.w / 2, slot.y + slot.h / 2, 68,
        slot.filled ? '#fff' : '#90CAF9')
    }

    // Speaker
    ctx.save()
    ctx.fillStyle = '#FF8A65'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(SPEAK_B_CX, SPEAK_B_CY, 55, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, '🔊', SPEAK_B_CX, SPEAK_B_CY, 60, '#fff')

    // Keyboard divider
    ctx.save()
    ctx.strokeStyle = '#D7CCC8'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(100, KB_Y - 24); ctx.lineTo(GAME_WIDTH - 100, KB_Y - 24)
    ctx.stroke(); ctx.restore()

    // Keyboard cards
    for (const card of this.kbCards) {
      this.drawCard(ctx, card, card.x, card.y)
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`, GAME_WIDTH - 140, 80, 55, '#5D4037')
  }

  private drawCard(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number) {
    const isWrong   = card.state === 'wrong'
    const isCorrect = card.state === 'correct'
    ctx.save()
    ctx.fillStyle   = isWrong   ? 'rgba(220,50,50,0.88)'
                    : isCorrect ? 'rgba(76,175,80,0.88)'
                    :             'rgba(255,183,77,0.92)'
    ctx.strokeStyle = isWrong   ? '#B71C1C'
                    : isCorrect ? '#2E7D32'
                    :             '#E65100'
    ctx.lineWidth = 4
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 8
    ctx.beginPath(); this.rr(ctx, x, y, card.w, card.h, 16)
    ctx.fill(); ctx.stroke(); ctx.restore()
    this.txt(ctx, card.text, x + card.w / 2, y + card.h / 2, 64,
      isWrong ? '#fff' : '#2E4057')
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private txt(ctx: CanvasRenderingContext2D, s: string,
              x: number, y: number, size: number, color: string) {
    ctx.save()
    ctx.fillStyle = color; ctx.font = `bold ${size}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(s, x, y); ctx.restore()
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
