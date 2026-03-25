import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/soundtrain'
const SND = `${A}/sounds`

// ── Scale: original assets drawn at 677 loco-width → we display at 480 ──────
const SC = 480 / 677   // ≈ 0.709

// ── Locomotive ───────────────────────────────────────────────────────────────
const LOCO_W = 480
const LOCO_H = Math.round(657 * SC)   // 466

// ── Wagon (freight car) ──────────────────────────────────────────────────────
// Normal (1-char): 372×452  Long (2+ chars): 450×452
const WAGON_W_S = Math.round(372 * SC)  // 264
const WAGON_W_L = Math.round(450 * SC)  // 319
const WAGON_H   = Math.round(452 * SC)  // 321

// ── Lion inside locomotive ────────────────────────────────────────────────────
// Original position in loco local coords (bottom-left origin): (510, 504)
const LION_W  = Math.round(218 * SC)  // 155
const LION_H  = Math.round(220 * SC)  // 156
const LION_OX = Math.round(510 * SC)  // 362  offset from loco left
const LION_OY = Math.round(504 * SC)  // 358  offset from loco bottom

// ── Sound bubble ─────────────────────────────────────────────────────────────
// Original local coords: (630, 870) — so 870-657=213px above loco top
const BUBBLE_W       = Math.round(283 * SC)   // 201
const BUBBLE_H       = Math.round(333 * SC)   // 236
const BUBBLE_OX      = Math.round(630 * SC)   // 447  offset from loco left
const BUBBLE_OY_UP   = Math.round(213 * SC)   // 151  above loco top

// Speaker display size inside bubble
const SPKR_W_D = 110
const SPKR_H_D = Math.round(110 * 240 / 275)  // 96

// ── Train layout ──────────────────────────────────────────────────────────────
const NUM_CHOICES = 4
const WAGON_GAP   = 15
const TRAIN_TOP   = 280   // top of locomotive in canvas coords

// ── Types ─────────────────────────────────────────────────────────────────────
interface Problem { answer: string; parts: string[] }

interface Wagon {
  text:      string
  x: number; y: number; w: number; h: number
  isCorrect: boolean
  state:     'normal' | 'correct' | 'wrong'
}

// ── Engine ────────────────────────────────────────────────────────────────────
export class SoundTrainEngine extends BaseEngine {
  private levelNum: number
  private problems:    Problem[] = []
  private allProblems: Problem[] = []
  private problemIndex = 0
  private loaded  = false
  private locked  = false

  private currentProblem: Problem | null = null
  private wagons: Wagon[] = []

  // Dynamic layout (updated per problem)
  private locoX    = 0
  private locoBotY = TRAIN_TOP + LOCO_H
  private bubbleCX = 0
  private bubbleCY = 0

  // ── Images ──────────────────────────────────────────────────────────────────
  private imgBg      = loadImage(assetUrl(`${A}/_train_sound_bg.png`))
  private imgLoco    = loadImage(assetUrl(`${A}/train_compartment_front.png`))
  private imgWagonS  = loadImage(assetUrl(`${A}/train_compartment_normal.png`))
  private imgWagonL  = loadImage(assetUrl(`${A}/train_compartment_long.png`))
  private imgLion    = loadImage(assetUrl(`${A}/train_lion.png`))
  private imgBubble  = loadImage(assetUrl(`${A}/train_soundbubble.png`))
  private imgSpkNorm = loadImage(assetUrl(`${A}/train_sound_normal.png`))
  private imgSpkAct  = loadImage(assetUrl(`${A}/train_sound_active.png`))
  private imgCardS   = loadImage(assetUrl(`${A}/train_card_surface.png`))
  private imgCardD   = loadImage(assetUrl(`${A}/train_card_depth.png`))
  private imgCardLS  = loadImage(assetUrl(`${A}/train_card_long_surface.png`))
  private imgCardLD  = loadImage(assetUrl(`${A}/train_card_long_depth.png`))

  // ── Sounds ──────────────────────────────────────────────────────────────────
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  private isPlaying = false

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.levelNum = level
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
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
    const ld   = (data.levels as Array<{ level: number; problems: Problem[] }>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    const shuffled   = [...ld.problems].sort(() => Math.random() - 0.5)
    this.allProblems = shuffled
    this.problems    = shuffled.slice(0, 6)
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

    const useLong = prob.answer.length > 1
    const wW      = useLong ? WAGON_W_L : WAGON_W_S

    // 3 distractors — prefer same-length answers from same level
    const answer = prob.answer
    const pool   = [...this.allProblems].filter(p => p.answer !== answer)
    const sameLen = pool.filter(p => p.answer.length === answer.length).sort(() => Math.random() - 0.5)
    const other   = pool.filter(p => p.answer.length !== answer.length).sort(() => Math.random() - 0.5)
    const distractors: string[] = []
    for (const p of [...sameLen, ...other]) {
      if (distractors.length >= 3) break
      if (!distractors.includes(p.answer)) distractors.push(p.answer)
    }
    // Fallback to alphabet
    for (const l of 'abcdefghijklmnopqrstuvwxyz'.split('').sort(() => Math.random() - 0.5)) {
      if (distractors.length >= 3) break
      if (l !== answer && !distractors.includes(l)) distractors.push(l)
    }

    const choices = [answer, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5)

    // ── Horizontal layout: loco(left) + wagons(right), centred on screen ──────
    const totalW  = LOCO_W + WAGON_GAP + NUM_CHOICES * wW + (NUM_CHOICES - 1) * WAGON_GAP
    const lx      = Math.round((GAME_WIDTH - totalW) / 2)
    const locoBot = TRAIN_TOP + LOCO_H
    const wagonY  = locoBot - WAGON_H      // align wagon bottoms with loco bottom
    const wagon0X = lx + LOCO_W + WAGON_GAP

    this.locoX    = lx
    this.locoBotY = locoBot

    // Sound bubble: above loco, at x = loco_left + BUBBLE_OX (centre of bubble)
    this.bubbleCX = lx + BUBBLE_OX
    this.bubbleCY = TRAIN_TOP - BUBBLE_OY_UP

    this.wagons = choices.slice(0, NUM_CHOICES).map((text, i) => ({
      text,
      x: wagon0X + i * (wW + WAGON_GAP),
      y: wagonY,
      w: wW,
      h: WAGON_H,
      isCorrect: text === answer,
      state: 'normal' as const,
    }))

    setTimeout(() => this.playLetterSound(answer), 350)
  }

  // ── Audio ────────────────────────────────────────────────────────────────────
  private playLetterSound(text: string) {
    const clean = text.toLowerCase().trim()
    const audio = new Audio(assetUrl(`${SND}/${clean}.m4a`))
    this.isPlaying = true
    audio.onended = () => { this.isPlaying = false }
    audio.onerror = () => { this.isPlaying = false }
    audio.play().catch(() => { this.isPlaying = false })
  }

  // ── Input ────────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Entire bubble area = speaker button
    const bLeft = this.bubbleCX - BUBBLE_W / 2
    const bTop  = this.bubbleCY - BUBBLE_H / 2
    if (x >= bLeft && x <= bLeft + BUBBLE_W && y >= bTop && y <= bTop + BUBBLE_H) {
      if (this.currentProblem) this.playLetterSound(this.currentProblem.answer)
      return
    }

    // Wagons
    for (const wagon of this.wagons) {
      if (x >= wagon.x && x <= wagon.x + wagon.w && y >= wagon.y && y <= wagon.y + wagon.h) {
        this.handleWagonTap(wagon)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp  (_x: number, _y: number) {}

  private handleWagonTap(wagon: Wagon) {
    if (wagon.state !== 'normal') return
    if (wagon.isCorrect) {
      wagon.state = 'correct'
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 900)
    } else {
      wagon.state = 'wrong'
      playSound(this.sfxIncorrect)
      setTimeout(() => { wagon.state = 'normal' }, 700)
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

  // ── Render ───────────────────────────────────────────────────────────────────
  update(_t: number, _dt: number) {}

  draw() {
    const { ctx } = this
    const cw = this.canvas.clientWidth
    const ch = this.canvas.clientHeight
    ctx.clearRect(0, 0, cw, ch)

    const ox = (cw - GAME_WIDTH  * this.gameScale) / 2
    const oy = (ch - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(this.gameScale, this.gameScale)

    // Background
    this.di(this.imgBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded || !this.currentProblem) {
      this.txt('Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#fff')
      ctx.restore(); return
    }

    // ── Sound bubble (drawn before loco so loco overlaps it slightly) ─────────
    const bx = this.bubbleCX - BUBBLE_W / 2
    const by = this.bubbleCY - BUBBLE_H / 2
    this.di(this.imgBubble, bx, by, BUBBLE_W, BUBBLE_H)
    const spkImg = this.isPlaying ? this.imgSpkAct : this.imgSpkNorm
    this.di(spkImg,
      this.bubbleCX - SPKR_W_D / 2,
      this.bubbleCY - SPKR_H_D / 2 + 15,
      SPKR_W_D, SPKR_H_D)

    // ── Locomotive ────────────────────────────────────────────────────────────
    this.di(this.imgLoco, this.locoX, TRAIN_TOP, LOCO_W, LOCO_H)

    // Lion (local origin = loco bottom-left)
    this.di(this.imgLion,
      this.locoX + LION_OX - LION_W / 2,
      this.locoBotY - LION_OY - LION_H / 2,
      LION_W, LION_H)

    // ── Wagons ────────────────────────────────────────────────────────────────
    for (const w of this.wagons) {
      const useLong = w.w > WAGON_W_S

      // Wagon body
      this.di(useLong ? this.imgWagonL : this.imgWagonS, w.x, w.y, w.w, w.h)

      // Letter card inside wagon
      const cardW = Math.round(w.w * 0.82)
      const cardH = Math.round(w.h * 0.52)
      const cardX = w.x + (w.w - cardW) / 2
      const cardY = w.y + Math.round(w.h * 0.10)

      this.di(useLong ? this.imgCardLD : this.imgCardD, cardX, cardY + 8, cardW, cardH)
      this.di(useLong ? this.imgCardLS : this.imgCardS, cardX, cardY,     cardW, cardH)

      // State colour overlay
      if (w.state !== 'normal') {
        ctx.save()
        ctx.fillStyle = w.state === 'correct' ? 'rgba(76,175,80,0.50)' : 'rgba(220,50,50,0.50)'
        ctx.beginPath()
        ctx.roundRect(cardX, cardY, cardW, cardH, 12)
        ctx.fill()
        ctx.restore()
      }

      // Letter text
      const tColor = w.state === 'correct' ? '#1B5E20' : w.state === 'wrong' ? '#B71C1C' : '#2E4057'
      const tSize  = w.text.length > 4 ? 64 : w.text.length > 2 ? 80 : 100
      this.txt(w.text, cardX + cardW / 2, cardY + cardH / 2, tSize, tColor)
    }

    // ── Progress ──────────────────────────────────────────────────────────────
    this.txt(
      `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, 80, 60, 'rgba(255,255,255,0.9)'
    )

    ctx.restore()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private di(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    if (img.complete && img.naturalWidth > 0) this.ctx.drawImage(img, x, y, w, h)
  }

  private txt(s: string, x: number, y: number, size: number, color: string) {
    const { ctx } = this
    ctx.save()
    ctx.fillStyle    = color
    ctx.font         = `bold ${size}px sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s, x, y)
    ctx.restore()
  }

  stop() { super.stop() }
}
