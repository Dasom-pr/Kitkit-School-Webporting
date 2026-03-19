import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/numbertrain'

interface Problem {
  numbers: number[]
  targetType: 'smallest' | 'largest'
  answer: number
}

interface TrainCar {
  number: number
  x: number
  y: number
  w: number
  h: number
  state: 'normal' | 'correct' | 'wrong'
}

const CAR_W = 320, CAR_H = 220
const CAR_Y = GAME_HEIGHT / 2 - 80
const TRACK_Y = CAR_Y + CAR_H + 20

export class NumberTrainEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false
  private currentProblem: Problem | null = null
  private cars: TrainCar[] = []

  private imgBgTop    = loadImage(assetUrl(`${A}/smallest_largest_bg_top.png`))
  private imgBgBottom = loadImage(assetUrl(`${A}/smallest_largest_bg_bottom.png`))
  private imgRail     = loadImage(assetUrl(`${A}/smallest_largest_rail.png`))
  private imgTrain1   = loadImage(assetUrl(`${A}/smallest_largest_train_1.png`))
  private imgCarSurf  = loadImage(assetUrl(`${A}/smallest_largest_1_answerblcok_surface.png`))
  private imgCarDepth = loadImage(assetUrl(`${A}/smallest_largest_2_answerblcok_depth.png`))
  private imgBtnActive   = loadImage(assetUrl(`${A}/smallest_largest_butoon_active.png`))
  private imgBtnInactive = loadImage(assetUrl(`${A}/smallest_largest_butoon_inactive.png`))

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
    const res  = await fetch('/data/games/numbertrain.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]
    this.problems = ld.problems
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

    const count = prob.numbers.length
    const totalW = count * CAR_W + (count - 1) * 20
    const startX = (GAME_WIDTH - totalW) / 2

    this.cars = prob.numbers.map((num, i) => ({
      number: num,
      x: startX + i * (CAR_W + 20),
      y: CAR_Y,
      w: CAR_W,
      h: CAR_H,
      state: 'normal' as const,
    }))
  }

  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    for (const car of this.cars) {
      if (x >= car.x && x <= car.x + car.w && y >= car.y && y <= car.y + car.h) {
        this.handleCarTap(car)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleCarTap(car: TrainCar) {
    if (!this.currentProblem) return
    if (car.number === this.currentProblem.answer) {
      car.state = 'correct'
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 1000)
    } else {
      car.state = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => { car.state = 'normal' }, 800)
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
    this.drawImg(ctx, this.imgBgTop,    0, 0,              GAME_WIDTH, GAME_HEIGHT / 2)
    this.drawImg(ctx, this.imgBgBottom, 0, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT / 2)

    // Rail
    this.drawImg(ctx, this.imgRail, 0, TRACK_Y, GAME_WIDTH, 60)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading\u2026', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Instruction text
    const instruction = prob.targetType === 'smallest'
      ? 'Tap the SMALLEST number!' : 'Tap the LARGEST number!'
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.roundRect(GAME_WIDTH / 2 - 500, 60, 1000, 110, 20)
    ctx.fill()
    ctx.restore()
    this.txt(ctx, instruction, GAME_WIDTH / 2, 115, 72, '#FFD600')

    // Train engine (left side)
    this.drawImg(ctx, this.imgTrain1, 30, CAR_Y - 30, 280, 280)

    // Train cars
    for (const car of this.cars) {
      // Car body
      ctx.save()
      if (car.state === 'correct') {
        ctx.fillStyle = 'rgba(76,175,80,0.9)'
      } else if (car.state === 'wrong') {
        ctx.fillStyle = 'rgba(220,50,50,0.85)'
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
      }
      ctx.shadowColor = 'rgba(0,0,0,0.2)'
      ctx.shadowBlur = 16
      ctx.beginPath()
      ctx.roundRect(car.x, car.y, car.w, car.h, 16)
      ctx.fill()
      ctx.strokeStyle = car.state === 'correct' ? '#2E7D32' : car.state === 'wrong' ? '#B71C1C' : '#78909C'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()

      // Number
      const fontSize = car.number >= 100 ? 72 : 90
      this.txt(ctx, String(car.number), car.x + car.w / 2, car.y + car.h / 2,
        fontSize, car.state !== 'normal' ? '#fff' : '#1A237E')

      // Wheels
      for (let wi = 0; wi < 2; wi++) {
        const wx = car.x + 60 + wi * (car.w - 100)
        ctx.save()
        ctx.fillStyle = '#455A64'
        ctx.beginPath()
        ctx.arc(wx, car.y + car.h + 12, 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#90A4AE'
        ctx.beginPath()
        ctx.arc(wx, car.y + car.h + 12, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, GAME_HEIGHT - 80, 60, 'rgba(255,255,255,0.9)')

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
