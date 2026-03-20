import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/soundtrain'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// Train display area (top portion)
const TRAIN_Y = CY - 300

// Sound bubble (play area)
const BUBBLE_Y = CY - 120
const BUBBLE_W = 400, BUBBLE_H = 220

// Choice cards (2×2 grid)
const CARD_W = 300, CARD_H = 180
const CARD_GAP = 60
const COLS = 2
const ROWS = 2
const GRID_W = COLS * CARD_W + (COLS - 1) * CARD_GAP
const GRID_H = ROWS * CARD_H + (ROWS - 1) * CARD_GAP
const CARD_START_X = CX - GRID_W / 2
const CARD_START_Y = CY + 150

// All letters and syllables for generating distractors
const ALL_LETTERS = 'a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z'.split(',')

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  answer: string
  parts: string[]
}

interface Card {
  text: string
  x: number
  y: number
  w: number
  h: number
  isCorrect: boolean
  state: 'normal' | 'correct' | 'wrong'
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class SoundTrainEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private currentProblem: Problem | null = null
  private cards: Card[] = []

  // Images
  private imgBg    = loadImage(assetUrl(`${A}/_train_sound_bg.png`))
  private imgTrain = loadImage(assetUrl(`${A}/train_compartment_front.png`))
  private imgBubble = loadImage(assetUrl(`${A}/train_soundbubble.png`))
  private imgSpeaker = loadImage(assetUrl(`${A}/train_sound_normal.png`))
  private imgSpeakerActive = loadImage(assetUrl(`${A}/train_sound_active.png`))
  private imgCardSurface  = loadImage(assetUrl(`${A}/train_card_surface.png`))
  private imgCardDepth    = loadImage(assetUrl(`${A}/train_card_depth.png`))
  private imgCardVowelS   = loadImage(assetUrl(`${A}/train_card_vowel_surface.png`))
  private imgCardVowelD   = loadImage(assetUrl(`${A}/train_card_vowel_depth.png`))
  private imgLion         = loadImage(assetUrl(`${A}/train_lion.png`))

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  private isPlaying = false

  private playLetterSound(text: string) {
    const clean = text.toLowerCase().trim()
    const url = assetUrl(`${A}/sounds/${clean}.m4a`)
    const audio = new Audio(url)
    this.isPlaying = true
    audio.onended = () => { this.isPlaying = false }
    audio.onerror = () => { this.isPlaying = false }
    audio.play().catch(() => { this.isPlaying = false })
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
    const res  = await fetch('/data/games/soundtrain.json')
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

    // Generate 3 distractors from all letters (not the answer)
    const answer = prob.answer
    const distractors = [...ALL_LETTERS]
      .filter(l => l !== answer && !prob.parts.includes(l))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)

    const choices = [answer, ...distractors].sort(() => Math.random() - 0.5)

    this.cards = choices.slice(0, 4).map((text, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      return {
        text,
        x: CARD_START_X + col * (CARD_W + CARD_GAP),
        y: CARD_START_Y + row * (CARD_H + CARD_GAP),
        w: CARD_W, h: CARD_H,
        isCorrect: text === answer,
        state: 'normal' as const,
      }
    })

    // Auto-play sound
    setTimeout(() => this.playLetterSound(answer), 300)
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Speaker button: replay sound
    const spkX = CX - 50, spkY = BUBBLE_Y + 50, spkW = 100, spkH = 100
    if (x >= spkX && x <= spkX + spkW && y >= spkY && y <= spkY + spkH) {
      if (this.currentProblem) this.playLetterSound(this.currentProblem.answer)
      return
    }

    for (const card of this.cards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.handleCardTap(card)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleCardTap(card: Card) {
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

    // Train at top
    const tW = 480, tH = 240
    this.drawImg(ctx, this.imgTrain, CX - tW / 2, TRAIN_Y, tW, tH)

    // Lion character
    const lW = 280, lH = 280
    this.drawImg(ctx, this.imgLion, CX + 200, BUBBLE_Y - 50, lW, lH)

    // Sound bubble
    this.drawImg(ctx, this.imgBubble, CX - BUBBLE_W / 2, BUBBLE_Y, BUBBLE_W, BUBBLE_H)

    // Speaker button (inside bubble)
    const spkImg = this.isPlaying ? this.imgSpeakerActive : this.imgSpeaker
    this.drawImg(ctx, spkImg, CX - 50, BUBBLE_Y + 55, 100, 100)

    // Choice cards
    for (const card of this.cards) {
      const isVowel = 'aeiou'.includes(card.text[0])
      const surfImg = isVowel ? this.imgCardVowelS : this.imgCardSurface
      const depthImg = isVowel ? this.imgCardVowelD : this.imgCardDepth
      this.drawImg(ctx, depthImg, card.x, card.y + 10, card.w, card.h)
      this.drawImg(ctx, surfImg, card.x, card.y, card.w, card.h)

      if (card.state === 'correct') {
        ctx.save(); ctx.fillStyle = 'rgba(76,175,80,0.4)'
        ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 16); ctx.fill(); ctx.restore()
      } else if (card.state === 'wrong') {
        ctx.save(); ctx.fillStyle = 'rgba(220,50,50,0.4)'
        ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 16); ctx.fill(); ctx.restore()
      }

      this.txt(ctx, card.text, card.x + card.w / 2, card.y + card.h / 2, 90,
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
