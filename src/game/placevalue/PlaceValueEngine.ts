import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/placevalue'

interface Problem {
  objectNo: number
  suggestNo: number
}

export class PlaceValueEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false
  private currentProblem: Problem | null = null

  // Player's current values
  private hundreds = 0
  private tens = 0
  private ones = 0

  private imgBgSky   = loadImage(assetUrl(`${A}/bg-sky.png`))
  private imgBgBush  = loadImage(assetUrl(`${A}/bg-bush.png`))

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
    const res  = await fetch('/data/games/placevalue.json')
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

    if (prob.suggestNo > 0) {
      // Pre-fill with suggestion
      this.hundreds = Math.floor(prob.suggestNo / 100)
      this.tens = Math.floor((prob.suggestNo % 100) / 10)
      this.ones = prob.suggestNo % 10
    } else {
      this.hundreds = 0
      this.tens = 0
      this.ones = 0
    }
  }

  private get currentTotal() {
    return this.hundreds * 100 + this.tens * 10 + this.ones
  }

  private checkAnswer() {
    if (!this.currentProblem) return
    const target = this.currentProblem.objectNo || this.currentProblem.suggestNo
    if (target === 0) return
    if (this.currentTotal === target) {
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 1000)
    }
  }

  // Button layout
  // 3 "+" buttons: add 100, add 10, add 1
  // 3 "-" buttons: remove 100, remove 10, remove 1
  private getButtonHitAreas() {
    const btns: Array<{id: string; x: number; y: number; w: number; h: number}> = []
    const labels = ['100', '10', '1']
    const xStart = GAME_WIDTH / 2 - 400
    const xStep = 400
    for (let i = 0; i < 3; i++) {
      const cx = xStart + i * xStep
      btns.push({ id: `add_${labels[i]}`,    x: cx - 80, y: 1200, w: 160, h: 160 })
      btns.push({ id: `remove_${labels[i]}`, x: cx - 80, y: 1420, w: 160, h: 160 })
    }
    btns.push({ id: 'submit', x: GAME_WIDTH / 2 - 160, y: 1620, w: 320, h: 120 })
    return btns
  }

  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    for (const btn of this.getButtonHitAreas()) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.handleButton(btn.id)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleButton(id: string) {
    if (!this.currentProblem) return
    const target = this.currentProblem.objectNo || this.currentProblem.suggestNo
    switch (id) {
      case 'add_100':    if (this.hundreds < 9 && this.currentTotal + 100 <= target) this.hundreds++; break
      case 'add_10':     if (this.tens < 9     && this.currentTotal + 10  <= target) this.tens++;     break
      case 'add_1':      if (this.ones < 9     && this.currentTotal + 1   <= target) this.ones++;     break
      case 'remove_100': if (this.hundreds > 0) this.hundreds--; break
      case 'remove_10':  if (this.tens > 0)     this.tens--;     break
      case 'remove_1':   if (this.ones > 0)     this.ones--;     break
      case 'submit':     this.checkAnswer(); return
    }
    this.checkAnswer()
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
    this.drawImg(ctx, this.imgBgSky,  0, 0,               GAME_WIDTH, GAME_HEIGHT * 0.6)
    this.drawImg(ctx, this.imgBgBush, 0, GAME_HEIGHT * 0.6, GAME_WIDTH, GAME_HEIGHT * 0.4)

    // Fallback background if images not loaded
    ctx.save()
    ctx.fillStyle = '#87CEEB'
    ctx.globalAlpha = this.imgBgSky.complete && this.imgBgSky.naturalWidth > 0 ? 0 : 1
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.restore()

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading\u2026', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    const prob = this.currentProblem
    const target = prob.objectNo || prob.suggestNo

    // Target number display
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 20
    ctx.beginPath(); ctx.roundRect(GAME_WIDTH / 2 - 400, 80, 800, 200, 24); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, 'Make this number:', GAME_WIDTH / 2, 140, 54, '#1565C0')
    this.txt(ctx, String(target), GAME_WIDTH / 2, 220, 100, '#1B5E20')

    // Place value display panel
    const xStart = GAME_WIDTH / 2 - 500
    const xStep = 500
    const labels = ['100s', '10s', '1s']
    const values = [this.hundreds, this.tens, this.ones]
    const colors  = ['#7B1FA2', '#1565C0', '#2E7D32']
    const dropColors = ['#CE93D8', '#90CAF9', '#A5D6A7']

    for (let i = 0; i < 3; i++) {
      const cx = xStart + i * xStep + 150

      // Panel
      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 16
      ctx.beginPath(); ctx.roundRect(cx - 130, 380, 260, 780, 20); ctx.fill()
      ctx.shadowBlur = 0; ctx.restore()

      // Label
      this.txt(ctx, labels[i], cx, 430, 58, colors[i])

      // Drop count display
      ctx.save()
      ctx.fillStyle = dropColors[i]
      ctx.beginPath(); ctx.roundRect(cx - 80, 480, 160, 100, 16); ctx.fill()
      ctx.restore()
      this.txt(ctx, String(values[i]), cx, 530, 80, '#fff')

      // Add button (+)
      ctx.save()
      ctx.fillStyle = colors[i]
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.roundRect(cx - 80, 1200 - 380 + 380, 160, 160, 16); ctx.fill()
      ctx.shadowBlur = 0; ctx.restore()
      this.txt(ctx, '+', cx, 1200 - 380 + 380 + 80, 90, '#fff')

      // Remove button (-)
      ctx.save()
      ctx.fillStyle = '#78909C'
      ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.roundRect(cx - 80, 1420 - 380 + 380, 160, 160, 16); ctx.fill()
      ctx.shadowBlur = 0; ctx.restore()
      this.txt(ctx, '\u2212', cx, 1420 - 380 + 380 + 80, 90, '#fff')
    }

    // Current total
    const totalColor = this.currentTotal === target ? '#2E7D32' : '#B71C1C'
    this.txt(ctx, `${this.currentTotal} / ${target}`, GAME_WIDTH / 2, 1580, 70, totalColor)

    // Submit button
    ctx.save()
    const canSubmit = this.currentTotal === target
    ctx.fillStyle = canSubmit ? '#2E7D32' : '#78909C'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 12
    ctx.beginPath(); ctx.roundRect(GAME_WIDTH / 2 - 160, 1620, 320, 120, 20); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, canSubmit ? '\u2713 Check!' : 'Check', GAME_WIDTH / 2, 1680, 62, '#fff')

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, GAME_HEIGHT - 40, 52, 'rgba(255,255,255,0.9)')

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
