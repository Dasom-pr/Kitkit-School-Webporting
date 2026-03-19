import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/numbertraceext'

export class NumberTracingExtEngine extends BaseEngine {
  private levelNum: number
  private numbersToTrace: number[] = []
  private currentIndex = 0
  private loaded = false

  // Drawing
  private isDrawing = false
  private strokes: Array<Array<{x: number; y: number}>> = []
  private currentStroke: Array<{x: number; y: number}> = []

  // Images
  private imgBg = loadImage(assetUrl(`${A}/tracing-2_image_background.png`))

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

  private loadLevel() {
    // Generate numbers for this level
    // Level 1: 0-9, Level 2: 10-19, Level 3: 20-29, etc.
    const start = (this.levelNum - 1) * 10
    this.numbersToTrace = []
    for (let i = start; i < start + 10 && i <= 200; i++) {
      this.numbersToTrace.push(i)
    }
    this.currentIndex = 0
    this.strokes = []
    this.currentStroke = []
    this.onProgressChange?.(0, this.numbersToTrace.length)
    this.loaded = true
  }

  private get currentNumber(): number {
    return this.numbersToTrace[this.currentIndex] ?? 0
  }

  private isInTraceArea(x: number, y: number): boolean {
    return x >= 480 && x <= 2080 && y >= 300 && y <= 1400
  }

  private isOnClearButton(x: number, y: number): boolean {
    return x >= 200 && x <= 500 && y >= 1500 && y <= 1700
  }

  private isOnNextButton(x: number, y: number): boolean {
    return x >= 2060 && x <= 2360 && y >= 1500 && y <= 1700
  }

  onPointerDown(x: number, y: number) {
    if (!this.loaded) return
    if (this.isOnClearButton(x, y)) {
      this.strokes = []
      this.currentStroke = []
      return
    }
    if (this.isOnNextButton(x, y)) {
      this.advanceNumber()
      return
    }
    if (this.isInTraceArea(x, y)) {
      this.isDrawing = true
      this.currentStroke = [{ x, y }]
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.isDrawing || !this.loaded) return
    if (this.isInTraceArea(x, y)) {
      this.currentStroke.push({ x, y })
    }
  }

  onPointerUp(_x: number, _y: number) {
    if (this.isDrawing && this.currentStroke.length > 0) {
      this.strokes.push([...this.currentStroke])
      this.currentStroke = []
    }
    this.isDrawing = false
  }

  private advanceNumber() {
    this.currentIndex++
    this.strokes = []
    this.currentStroke = []
    this.onProgressChange?.(this.currentIndex, this.numbersToTrace.length)
    if (this.currentIndex >= this.numbersToTrace.length) {
      setTimeout(() => { this.gameState = 'complete'; this.onComplete?.() }, 300)
    }
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
    this.drawImg(ctx, this.imgBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)
    // Fallback bg
    if (!this.imgBg.complete || !this.imgBg.naturalWidth) {
      ctx.fillStyle = '#FFF8E1'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }

    if (!this.loaded) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    const CX = GAME_WIDTH / 2

    // Tracing area background
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 20
    ctx.beginPath(); ctx.roundRect(480, 300, 1600, 1100, 24); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()

    // Dotted border for trace area
    ctx.save()
    ctx.strokeStyle = '#BDBDBD'
    ctx.lineWidth = 4
    ctx.setLineDash([16, 12])
    ctx.beginPath(); ctx.roundRect(480, 300, 1600, 1100, 24); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // Large number guide (faded)
    ctx.save()
    ctx.globalAlpha = 0.12
    this.txt(ctx, String(this.currentNumber), CX, 900, 700, '#1565C0')
    ctx.globalAlpha = 1
    ctx.restore()

    // "Number to trace" label
    ctx.save()
    ctx.fillStyle = '#1565C0'
    ctx.beginPath(); ctx.roundRect(CX - 200, 100, 400, 160, 20); ctx.fill()
    ctx.restore()
    this.txt(ctx, String(this.currentNumber), CX, 180, 120, '#fff')

    // User strokes
    ctx.save()
    ctx.strokeStyle = '#E91E63'
    ctx.lineWidth = 14
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of this.strokes) {
      if (stroke.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y)
      }
      ctx.stroke()
    }
    // Current stroke
    if (this.currentStroke.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(this.currentStroke[0].x, this.currentStroke[0].y)
      for (let i = 1; i < this.currentStroke.length; i++) {
        ctx.lineTo(this.currentStroke[i].x, this.currentStroke[i].y)
      }
      ctx.stroke()
    }
    ctx.restore()

    // Clear button
    ctx.save()
    ctx.fillStyle = '#F44336'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 12
    ctx.beginPath(); ctx.roundRect(200, 1500, 300, 200, 20); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, '🗑 Clear', 350, 1600, 56, '#fff')

    // Next button
    ctx.save()
    ctx.fillStyle = this.currentIndex < this.numbersToTrace.length - 1 ? '#4CAF50' : '#FF9800'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 12
    ctx.beginPath(); ctx.roundRect(2060, 1500, 300, 200, 20); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, this.currentIndex < this.numbersToTrace.length - 1 ? 'Next ▶' : 'Done ✓',
      2210, 1600, 56, '#fff')

    // Progress dots
    const dotCount = this.numbersToTrace.length
    const dotSpacing = Math.min(80, 1400 / dotCount)
    const dotStartX = CX - (dotCount * dotSpacing) / 2
    for (let i = 0; i < dotCount; i++) {
      ctx.save()
      ctx.fillStyle = i < this.currentIndex ? '#4CAF50' : i === this.currentIndex ? '#1565C0' : 'rgba(0,0,0,0.2)'
      ctx.beginPath(); ctx.arc(dotStartX + i * dotSpacing, GAME_HEIGHT - 60, 16, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

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
