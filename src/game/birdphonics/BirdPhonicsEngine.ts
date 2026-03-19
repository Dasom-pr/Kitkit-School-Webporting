import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/birdphonics'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// Two birds: left (blue) and right (red)
const BIRD_W = 360, BIRD_H = 360
const BIRD_L_X = CX - 700
const BIRD_R_X = CX + 340
const BIRD_Y = CY - 280

// Bottom bar with bread (word) cards
const BOTTOM_Y = GAME_HEIGHT - 320
const BREAD_W = 280, BREAD_H = 150
const BREAD_GAP = 40

// ─── Types ───────────────────────────────────────────────────────────────────
interface Bread {
  word: string
  sound: string
  bird: string   // 'blue' | 'red'
}

interface Problem {
  blueSound: string
  redSound: string
  breads: Bread[]
}

interface BreadCard {
  word: string
  bird: string   // which bird this belongs to
  x: number
  y: number
  w: number
  h: number
  state: 'normal' | 'correct' | 'wrong'
  matched: boolean
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class BirdPhonicsEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private currentProblem: Problem | null = null
  private breadCards: BreadCard[] = []
  private matchedCount = 0
  private totalBreads = 0

  // Images
  private imgBg      = loadImage(assetUrl(`${A}/phonics_bg.jpg`))
  private imgBottomBg = loadImage(assetUrl(`${A}/phonics_bottom_bg.png`))
  private imgBlueBird = loadImage(assetUrl(`${A}/phonics_birdtypea_option1_normal.png`))
  private imgBlueBirdActive = loadImage(assetUrl(`${A}/phonics_birdtypea_option1_active.png`))
  private imgBlueBirdCorrect = loadImage(assetUrl(`${A}/phonics_birdtypea_option1_correct.png`))
  private imgRedBird  = loadImage(assetUrl(`${A}/phonics_birdtypeb_option1_normal.png`))
  private imgRedBirdActive = loadImage(assetUrl(`${A}/phonics_birdtypeb_option1_active.png`))
  private imgRedBirdCorrect = loadImage(assetUrl(`${A}/phonics_birdtypeb_option1_correct.png`))
  private imgBread    = loadImage(assetUrl(`${A}/phonics_bread_answers.png`))
  private imgSpotNormal = loadImage(assetUrl(`${A}/phonics_spotlight_normal.png`))
  private imgSpotActive = loadImage(assetUrl(`${A}/phonics_spotlight_active.png`))

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  // Which bird was last tapped (for highlighting)
  private lastBirdTapped: 'blue' | 'red' | null = null

  private playBirdPhonicsSound(filename: string) {
    if (!filename) return
    const url = assetUrl(`${A}/sounds/${filename}`)
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
    const res  = await fetch('/data/games/birdphonics.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
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
    this.lastBirdTapped = null

    const totalW = prob.breads.length * (BREAD_W + BREAD_GAP) - BREAD_GAP
    const startX = CX - totalW / 2

    // Shuffle breads
    const shuffledBreads = [...prob.breads].sort(() => Math.random() - 0.5)
    this.breadCards = shuffledBreads.map((b, i) => ({
      word: b.word,
      bird: b.bird,
      x: startX + i * (BREAD_W + BREAD_GAP),
      y: BOTTOM_Y,
      w: BREAD_W,
      h: BREAD_H,
      state: 'normal' as const,
      matched: false,
    }))

    this.matchedCount = 0
    this.totalBreads = shuffledBreads.length

    // Play blue bird sound
    if (prob.blueSound) setTimeout(() => this.playBirdPhonicsSound(prob.blueSound), 400)
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Blue bird tap (play blue sound)
    if (x >= BIRD_L_X && x <= BIRD_L_X + BIRD_W && y >= BIRD_Y && y <= BIRD_Y + BIRD_H) {
      this.lastBirdTapped = 'blue'
      if (this.currentProblem?.blueSound) this.playBirdPhonicsSound(this.currentProblem.blueSound)
      return
    }

    // Red bird tap (play red sound)
    if (x >= BIRD_R_X && x <= BIRD_R_X + BIRD_W && y >= BIRD_Y && y <= BIRD_Y + BIRD_H) {
      this.lastBirdTapped = 'red'
      if (this.currentProblem?.redSound) this.playBirdPhonicsSound(this.currentProblem.redSound)
      return
    }

    // Bread card taps
    for (const card of this.breadCards) {
      if (card.matched) continue
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.handleBreadTap(card)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleBreadTap(card: BreadCard) {
    if (!this.lastBirdTapped) {
      // Prompt: tap a bird first
      card.state = 'wrong'
      setTimeout(() => { card.state = 'normal' }, 600)
      return
    }

    if (card.bird === this.lastBirdTapped) {
      // Correct match
      card.state = 'correct'
      card.matched = true
      this.matchedCount++
      playSound(this.sfxCorrect)
      this.playBirdPhonicsSound(card.word + '.m4a'.replace('.m4a.m4a', '.m4a'))

      if (this.matchedCount >= this.totalBreads) {
        this.locked = true
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
    this.drawImg(ctx, this.imgBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)
    this.drawImg(ctx, this.imgBottomBg, 0, GAME_HEIGHT - 380, GAME_WIDTH, 380)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#fff')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Spotlight behind each bird
    const spW = 300, spH = 300
    const blueImg = this.lastBirdTapped === 'blue' ? this.imgSpotActive : this.imgSpotNormal
    const redImg  = this.lastBirdTapped === 'red'  ? this.imgSpotActive : this.imgSpotNormal
    this.drawImg(ctx, blueImg, BIRD_L_X + BIRD_W / 2 - spW / 2, BIRD_Y + BIRD_H - spH / 2, spW, spH)
    this.drawImg(ctx, redImg,  BIRD_R_X + BIRD_W / 2 - spW / 2, BIRD_Y + BIRD_H - spH / 2, spW, spH)

    // Birds
    const blueBirdImg = this.lastBirdTapped === 'blue' ? this.imgBlueBirdActive : this.imgBlueBird
    const redBirdImg  = this.lastBirdTapped === 'red'  ? this.imgRedBirdActive  : this.imgRedBird
    this.drawImg(ctx, blueBirdImg, BIRD_L_X, BIRD_Y, BIRD_W, BIRD_H)
    this.drawImg(ctx, redBirdImg,  BIRD_R_X, BIRD_Y, BIRD_W, BIRD_H)

    // Bird labels
    this.txt(ctx, '🔵 Tap to hear', BIRD_L_X + BIRD_W / 2, BIRD_Y - 40, 44, 'rgba(255,255,255,0.9)')
    this.txt(ctx, '🔴 Tap to hear', BIRD_R_X + BIRD_W / 2, BIRD_Y - 40, 44, 'rgba(255,255,255,0.9)')

    // Instruction
    if (!this.lastBirdTapped) {
      this.txt(ctx, 'Tap a bird to hear its sound, then tap the matching words!',
        CX, BOTTOM_Y - 70, 48, 'rgba(255,255,255,0.9)')
    } else {
      const color = this.lastBirdTapped === 'blue' ? '#64B5F6' : '#EF9A9A'
      this.txt(ctx, `Now tap words that start with the ${this.lastBirdTapped} bird's sound!`,
        CX, BOTTOM_Y - 70, 48, color)
    }

    // Bread cards
    for (const card of this.breadCards) {
      if (card.matched) {
        ctx.save(); ctx.globalAlpha = 0.4
        this.drawImg(ctx, this.imgBread, card.x, card.y, card.w, card.h)
        ctx.restore()
        continue
      }

      this.drawImg(ctx, this.imgBread, card.x, card.y, card.w, card.h)

      if (card.state === 'correct') {
        ctx.save(); ctx.fillStyle = 'rgba(76,175,80,0.4)'
        ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 16); ctx.fill(); ctx.restore()
      } else if (card.state === 'wrong') {
        ctx.save(); ctx.fillStyle = 'rgba(220,50,50,0.4)'
        ctx.beginPath(); this.rr(ctx, card.x, card.y, card.w, card.h, 16); ctx.fill(); ctx.restore()
      }

      this.txt(ctx, card.word, card.x + card.w / 2, card.y + card.h / 2, 68,
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
