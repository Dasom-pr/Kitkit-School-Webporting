import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/quickfacts'

interface QFProblem {
  a: number
  b: number
  sign: string
  answer: number
  comboTime: number
  examples: string[]
}

interface FallingNumber {
  value: string
  x: number
  y: number
  vy: number
  isCorrect: boolean
  state: 'normal' | 'correct' | 'wrong' | 'missed'
}

const CARD_W = 200, CARD_H = 200
const FALL_SPEED_BASE = 180 // pixels per second in game coords

export class QuickFactsEngine extends BaseEngine {
  private levelNum: number
  private problems: QFProblem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false
  private currentProblem: QFProblem | null = null

  private fallingNumbers: FallingNumber[] = []
  private spawnTimer = 0
  private spawnInterval = 0.8
  private pendingAnswers: string[] = []
  private spawnIndex = 0

  private gems = 0  // score

  private sfxCorrect = loadAudio(assetUrl(`${A}/sounds/correct_0.m4a`))
  private sfxWrong   = loadAudio(assetUrl(`${A}/sounds/wrong.m4a`))
  private sfxGem     = loadAudio(assetUrl(`${A}/sounds/create_gem.m4a`))

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
    const res  = await fetch('/data/games/quickfacts.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:QFProblem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]
    // Take up to 8 problems per session
    this.problems = ld.problems.slice(0, 8)
    this.problemIndex = 0
    this.gems = 0
    this.onProgressChange?.(0, this.problems.length)
    this.setupProblem()
    this.loaded = true
  }

  private setupProblem() {
    if (this.problemIndex >= this.problems.length) return
    const prob = this.problems[this.problemIndex]
    this.currentProblem = prob
    this.locked = false
    this.fallingNumbers = []
    this.spawnTimer = 0
    this.spawnIndex = 0

    // Pick 3 choices: correct + 2 from examples (excluding correct)
    const wrongChoices = prob.examples.filter(e => e !== String(prob.answer))
    const shuffled = [...wrongChoices].sort(() => Math.random() - 0.5).slice(0, 2)
    const allChoices = [String(prob.answer), ...shuffled].sort(() => Math.random() - 0.5)
    this.pendingAnswers = [...allChoices, ...allChoices]  // repeat so all choices appear
  }

  private spawnNumber() {
    if (!this.currentProblem) return
    const value = this.pendingAnswers[this.spawnIndex % this.pendingAnswers.length]
    this.spawnIndex++

    const x = 200 + Math.random() * (GAME_WIDTH - 400 - CARD_W)
    this.fallingNumbers.push({
      value,
      x,
      y: -CARD_H - 20,
      vy: FALL_SPEED_BASE + Math.random() * 80,
      isCorrect: value === String(this.currentProblem.answer),
      state: 'normal',
    })
  }

  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    // Check falling numbers (tap to catch)
    for (const fn of this.fallingNumbers) {
      if (fn.state !== 'normal') continue
      if (x >= fn.x && x <= fn.x + CARD_W && y >= fn.y && y <= fn.y + CARD_H) {
        this.handleTap(fn)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleTap(fn: FallingNumber) {
    if (fn.isCorrect) {
      fn.state = 'correct'
      this.gems++
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 800)
    } else {
      fn.state = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => { fn.state = 'normal' }, 600)
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
    if (!this.loaded || this.locked) return

    // Spawn
    this.spawnTimer += dt
    if (this.spawnTimer >= this.spawnInterval && this.fallingNumbers.filter(f => f.state === 'normal').length < 3) {
      this.spawnTimer = 0
      this.spawnNumber()
    }

    // Move falling numbers
    for (const fn of this.fallingNumbers) {
      if (fn.state !== 'normal') continue
      fn.y += fn.vy * dt
    }

    // Remove fallen off screen
    this.fallingNumbers = this.fallingNumbers.filter(fn => fn.y < GAME_HEIGHT + 100)
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
    ctx.fillStyle = '#1A237E'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Stars background
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137 + 50) % GAME_WIDTH)
      const sy = ((i * 89 + 30) % GAME_HEIGHT)
      const sr = 2 + (i % 4)
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill()
    }

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#fff')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Equation display
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath(); ctx.roundRect(GAME_WIDTH / 2 - 550, 80, 1100, 220, 30); ctx.fill()
    ctx.restore()
    const equation = `${prob.a} ${prob.sign} ${prob.b} = ?`
    this.txt(ctx, equation, GAME_WIDTH / 2, 190, 120, '#FFD600')

    // Gems score
    this.txt(ctx, `💎 ${this.gems}`, 200, 80, 64, '#80D8FF')

    // Falling numbers
    for (const fn of this.fallingNumbers) {
      ctx.save()
      if (fn.state === 'correct') {
        ctx.fillStyle = 'rgba(76,175,80,0.9)'
        ctx.shadowColor = '#4CAF50'; ctx.shadowBlur = 30
      } else if (fn.state === 'wrong') {
        ctx.fillStyle = 'rgba(220,50,50,0.85)'
      } else {
        ctx.fillStyle = 'rgba(33,150,243,0.85)'
        ctx.shadowColor = '#2196F3'; ctx.shadowBlur = 20
      }
      ctx.beginPath()
      ctx.roundRect(fn.x, fn.y, CARD_W, CARD_H, 20)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = fn.state === 'correct' ? '#2E7D32' : fn.state === 'wrong' ? '#B71C1C' : '#64B5F6'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.restore()

      this.txt(ctx, fn.value, fn.x + CARD_W / 2, fn.y + CARD_H / 2, 90, '#fff')
    }

    // Ground
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(0, GAME_HEIGHT - 60, GAME_WIDTH, 60)
    ctx.restore()
    this.txt(ctx, '— tap the correct answer —', GAME_WIDTH / 2, GAME_HEIGHT - 30, 44, 'rgba(255,255,255,0.4)')

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH - 150, 80, 52, 'rgba(255,255,255,0.6)')

    ctx.restore()
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
