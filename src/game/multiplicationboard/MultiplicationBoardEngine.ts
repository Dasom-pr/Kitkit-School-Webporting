import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/multiplicationboard'

interface MBProblem {
  multiplicand: number
  multiplier: number
  product: number
}

interface AnswerCard {
  value: number
  x: number
  y: number
  w: number
  h: number
  isCorrect: boolean
  state: 'normal' | 'correct' | 'wrong'
}

const CX = GAME_WIDTH / 2
const BULB_SIZE = 120
const BULB_GAP = 20

export class MultiplicationBoardEngine extends BaseEngine {
  private levelNum: number
  private problems: MBProblem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false
  private currentProblem: MBProblem | null = null
  private answerCards: AnswerCard[] = []
  private litBulbs = 0
  private litTimer = 0

  private imgBgBoard = loadImage(assetUrl(`${A}/bg.png`))
  private imgBulbOff = loadImage(assetUrl(`${A}/bulb_shadow.png`))
  private imgBulbOn  = loadImage(assetUrl(`${A}/bulb_y_light.png`))

  private sfxCorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxWrong   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

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
    const res  = await fetch('/data/games/multiplicationboard.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:MBProblem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]
    this.problems = ld.problems.slice(0, 6)
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
    this.litBulbs = 0
    this.litTimer = 0

    // Build 3 answer cards: correct + 2 nearby distractors
    const correct = prob.product
    const wrong1 = correct + (Math.random() < 0.5 ? 1 : -1) * prob.multiplicand
    const wrong2 = correct + (Math.random() < 0.5 ? 2 : -2) * prob.multiplicand
    const choices = [correct, wrong1, wrong2]
      .map(v => Math.max(1, v))
      .sort(() => Math.random() - 0.5)

    const cardW = 280, cardH = 160
    const cardY = 1500
    const gap = 80
    const totalW = 3 * cardW + 2 * gap
    const startX = CX - totalW / 2

    this.answerCards = choices.map((val, i) => ({
      value: val,
      x: startX + i * (cardW + gap),
      y: cardY,
      w: cardW,
      h: cardH,
      isCorrect: val === correct,
      state: 'normal' as const,
    }))
  }

  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    for (const card of this.answerCards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.handleAnswer(card)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleAnswer(card: AnswerCard) {
    if (card.isCorrect) {
      card.state = 'correct'
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 1000)
    } else {
      card.state = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => { card.state = 'normal' }, 800)
    }
  }

  private nextProblem() {
    this.problemIndex++
    this.onProgressChange?.(this.problemIndex, this.problems.length)
    if (this.problemIndex >= this.problems.length) {
      setTimeout(() => { this.gameState = 'complete'; this.onComplete?.() }, 300)
      return
    }
    this.setupProblem()
  }

  update(_t: number, dt: number) {
    if (!this.loaded || !this.currentProblem) return
    // Animate bulbs lighting up one by one
    const total = this.currentProblem.multiplicand * this.currentProblem.multiplier
    if (this.litBulbs < total) {
      this.litTimer += dt
      if (this.litTimer > 0.08) {
        this.litTimer = 0
        this.litBulbs++
      }
    }
  }

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
    this.drawImg(ctx, this.imgBgBoard, 0, 0, GAME_WIDTH, GAME_HEIGHT)
    // Fallback
    if (!this.imgBgBoard.complete || !this.imgBgBoard.naturalWidth) {
      ctx.fillStyle = '#1A237E'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', CX, GAME_HEIGHT / 2, 80, '#fff')
      ctx.restore(); return
    }

    const prob = this.currentProblem
    const rows = prob.multiplicand
    const cols = prob.multiplier

    // Equation
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath(); ctx.roundRect(CX - 450, 60, 900, 180, 24); ctx.fill()
    ctx.restore()
    this.txt(ctx, `${rows} × ${cols} = ?`, CX, 150, 100, '#FFD600')

    // Bulb grid
    const gridW = cols * (BULB_SIZE + BULB_GAP) - BULB_GAP
    const gridH = rows * (BULB_SIZE + BULB_GAP) - BULB_GAP
    const gridX = CX - gridW / 2
    const gridY = 360

    let bulbIdx = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = gridX + c * (BULB_SIZE + BULB_GAP)
        const by = gridY + r * (BULB_SIZE + BULB_GAP)
        const isLit = bulbIdx < this.litBulbs

        if (isLit) {
          // Lit bulb (yellow glow)
          ctx.save()
          ctx.fillStyle = '#FFD600'
          ctx.shadowColor = '#FFD600'
          ctx.shadowBlur = 30
          ctx.beginPath(); ctx.arc(bx + BULB_SIZE/2, by + BULB_SIZE/2, BULB_SIZE/2 - 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0
          ctx.restore()
          this.drawImg(ctx, this.imgBulbOn, bx, by, BULB_SIZE, BULB_SIZE)
        } else {
          // Off bulb (dim)
          ctx.save()
          ctx.fillStyle = 'rgba(100,100,100,0.5)'
          ctx.beginPath(); ctx.arc(bx + BULB_SIZE/2, by + BULB_SIZE/2, BULB_SIZE/2 - 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          this.drawImg(ctx, this.imgBulbOff, bx, by, BULB_SIZE, BULB_SIZE)
        }
        bulbIdx++
      }
    }

    // Lit count
    if (this.litBulbs > 0) {
      this.txt(ctx, String(this.litBulbs), CX, gridY + gridH + 80, 80, '#FFD600')
    }

    // Answer cards
    for (const card of this.answerCards) {
      ctx.save()
      ctx.fillStyle = card.state === 'correct' ? 'rgba(76,175,80,0.9)' :
                      card.state === 'wrong'   ? 'rgba(220,50,50,0.88)' : 'rgba(255,255,255,0.9)'
      ctx.strokeStyle = card.state === 'correct' ? '#2E7D32' :
                        card.state === 'wrong'   ? '#B71C1C' : '#9E9E9E'
      ctx.lineWidth = card.state !== 'normal' ? 5 : 3
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.roundRect(card.x, card.y, card.w, card.h, 20)
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore()
      this.txt(ctx, String(card.value), card.x + card.w / 2, card.y + card.h / 2, 80,
        card.state !== 'normal' ? '#fff' : '#1A237E')
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      CX, GAME_HEIGHT - 40, 52, 'rgba(255,255,255,0.7)')

    ctx.restore()
  }

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
}
