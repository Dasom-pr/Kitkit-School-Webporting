import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

interface TPProblem {
  columns: number[]
  suggests: number[]
  problemNumber: number
}

interface NumberTile {
  value: number
  x: number
  y: number
  w: number
  h: number
  selected: boolean
  suggested: boolean
  state: 'normal' | 'correct' | 'wrong'
}

const TARGET_SUM = 30
const CX = GAME_WIDTH / 2

export class ThirtyPuzzleEngine extends BaseEngine {
  private levelNum: number
  private problems: TPProblem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false
  private currentProblem: TPProblem | null = null
  private tiles: NumberTile[] = []

  private sfxCorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxWrong   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))
  private sfxSelect  = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))

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
    const res  = await fetch('/data/games/thirtypuzzle.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:TPProblem[]}>)
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

    const count = prob.columns.length
    const cols = Math.min(count, 5)
    const rows = Math.ceil(count / cols)
    const TILE_W = 280, TILE_H = 180, GAP = 20
    const gridW = cols * TILE_W + (cols - 1) * GAP
    const gridH = rows * TILE_H + (rows - 1) * GAP
    const startX = CX - gridW / 2
    const startY = 500

    this.tiles = prob.columns.map((val, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      return {
        value: val,
        x: startX + col * (TILE_W + GAP),
        y: startY + row * (TILE_H + GAP),
        w: TILE_W,
        h: TILE_H,
        selected: prob.suggests.includes(val),
        suggested: prob.suggests.includes(val),
        state: 'normal' as const,
      }
    })
  }

  private get selectedSum(): number {
    return this.tiles.filter(t => t.selected).reduce((sum, t) => sum + t.value, 0)
  }

  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    for (const tile of this.tiles) {
      if (tile.suggested) continue  // can't deselect suggested tiles
      if (x >= tile.x && x <= tile.x + tile.w && y >= tile.y && y <= tile.y + tile.h) {
        tile.selected = !tile.selected
        const sum = this.selectedSum
        if (sum === TARGET_SUM) {
          this.handleCorrect()
        } else if (sum > TARGET_SUM) {
          // Over sum, flash wrong
          tile.selected = false
          tile.state = 'wrong'
          playSound(this.sfxWrong)
          setTimeout(() => { tile.state = 'normal' }, 600)
        }
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleCorrect() {
    for (const tile of this.tiles) {
      if (tile.selected) tile.state = 'correct'
    }
    playSound(this.sfxCorrect)
    this.locked = true
    setTimeout(() => this.nextProblem(), 1200)
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
    ctx.fillStyle = '#FFF3E0'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Top bar
    ctx.fillStyle = '#FF6F00'
    ctx.fillRect(0, 0, GAME_WIDTH, 120)
    this.txt(ctx, 'Select numbers that add up to 30!', CX, 60, 62, '#fff')

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', CX, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    // Current sum display
    const sum = this.selectedSum
    const sumColor = sum === TARGET_SUM ? '#2E7D32' : sum > TARGET_SUM ? '#B71C1C' : '#E65100'
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 16
    ctx.beginPath(); ctx.roundRect(CX - 300, 180, 600, 160, 24); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, `Sum: ${sum} / ${TARGET_SUM}`, CX, 260, 80, sumColor)

    // Number tiles
    for (const tile of this.tiles) {
      ctx.save()
      if (tile.state === 'correct') {
        ctx.fillStyle = 'rgba(76,175,80,0.9)'
      } else if (tile.state === 'wrong') {
        ctx.fillStyle = 'rgba(220,50,50,0.85)'
      } else if (tile.selected) {
        ctx.fillStyle = 'rgba(255,152,0,0.9)'
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
      }
      ctx.shadowColor = tile.selected ? 'rgba(255,152,0,0.4)' : 'rgba(0,0,0,0.1)'
      ctx.shadowBlur = tile.selected ? 20 : 8
      ctx.strokeStyle = tile.selected ? '#E65100' : '#BDBDBD'
      ctx.lineWidth = tile.selected ? 5 : 2
      ctx.beginPath(); ctx.roundRect(tile.x, tile.y, tile.w, tile.h, 16)
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore()

      const numColor = tile.state !== 'normal' ? '#fff' : tile.selected ? '#fff' : '#E65100'
      this.txt(ctx, String(tile.value), tile.x + tile.w / 2, tile.y + tile.h / 2, 80, numColor)

      // Small star for suggested tiles
      if (tile.suggested) {
        this.txt(ctx, '★', tile.x + tile.w - 30, tile.y + 28, 32, '#FFD600')
      }
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      CX, GAME_HEIGHT - 60, 56, '#E65100')

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
