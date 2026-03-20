import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/wordmatrix'

// ─── Constants ───────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

const CELL_W   = 300   // 슬롯/버튼 너비
const CELL_H   = 160   // 슬롯/버튼 높이
const CELL_GAP = 18    // 셀 간격
const CORNER   = 14    // 모서리 반지름

const BOARD_PAD_X = 80
const BOARD_PAD_Y = 60

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  letter: string     // "d" or "d,l,ch"
  endings: string[]  // ["ot","amp","ean"]
}

interface SlotCell {
  row: number     // index into letters[]
  col: number     // index into endings[]
  word: string    // letter + ending
  filled: boolean
  animT: number   // 0→1 fill animation progress
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class WordMatrixEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  // current problem state
  private letters:  string[]    = []   // split from problem.letter
  private endings:  string[]    = []   // problem.endings
  private slots:    SlotCell[]  = []
  private filledCount = 0

  // layout (recalculated per problem)
  private gridX = 0   // x of first ending-header cell
  private gridY = 0   // y of first letter-header cell
  private cols  = 0
  private rows  = 0

  // Images
  private imgBg       = loadImage(assetUrl(`${A}/bg.png`))
  private imgBoard    = loadImage(assetUrl(`${A}/board.png`))
  private imgBtnH     = loadImage(assetUrl(`${A}/btn_horizontal.png`))
  private imgBtnHSel  = loadImage(assetUrl(`${A}/btn_horizontal_selected.png`))
  private imgBtnV     = loadImage(assetUrl(`${A}/btn_vertical.png`))
  private imgBtnVSel  = loadImage(assetUrl(`${A}/btn_vertical_selected.png`))
  private imgSlot     = loadImage(assetUrl(`${A}/slot_area.png`))
  private imgSlotSel  = loadImage(assetUrl(`${A}/slot_area_selected.png`))
  private imgBlockTop = [1,2,3,4,5].map(n => loadImage(assetUrl(`${A}/block_top_0${n}.png`)))

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.levelNum = level
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  start() {
    this.resize()
    this.gameState = 'playing'
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('resize', this.resize)
    this.lastTime = performance.now() / 1000
    this.loop()
    this.loadLevel()
  }

  private async loadLevel() {
    const res  = await fetch('/data/games/wordmatrix.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems  = shuffled   // 3 problems per level
    this.problemIndex = 0
    this.onProgressChange?.(0, this.problems.length)
    this.setupProblem()
    this.loaded = true
  }

  private setupProblem() {
    if (this.problemIndex >= this.problems.length) return
    const prob = this.problems[this.problemIndex]

    this.letters = prob.letter.split(',').map(s => s.trim())
    this.endings = [...prob.endings]
    this.rows = this.letters.length
    this.cols = this.endings.length
    this.filledCount = 0
    this.locked = false

    // Build slot cells
    this.slots = []
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.slots.push({
          row: r, col: c,
          word: this.letters[r] + this.endings[c],
          filled: false,
          animT: 0,
        })
      }
    }

    // Compute grid layout (centered)
    // Total grid = (cols+1) cells wide × (rows+1) cells tall
    const totalW = (this.cols + 1) * CELL_W + this.cols * CELL_GAP
    const totalH = (this.rows + 1) * CELL_H + this.rows * CELL_GAP
    this.gridX = CX - totalW / 2
    this.gridY = CY - totalH / 2 - 80

    // Play first ending sound to introduce
    this.playSound(this.endings[0])
  }

  // ── Input ────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Tap on an ending header → play its sound
    for (let c = 0; c < this.cols; c++) {
      const bx = this.gridX + (c + 1) * (CELL_W + CELL_GAP)
      const by = this.gridY
      if (this.hit(x, y, bx, by)) {
        this.playSound(this.endings[c])
        return
      }
    }

    // Tap on a letter header → play its sound
    for (let r = 0; r < this.rows; r++) {
      const bx = this.gridX
      const by = this.gridY + (r + 1) * (CELL_H + CELL_GAP)
      if (this.hit(x, y, bx, by)) {
        this.playSound(this.letters[r])
        return
      }
    }

    // Tap on a slot → fill it
    for (const slot of this.slots) {
      if (slot.filled) continue
      const sx = this.gridX + (slot.col + 1) * (CELL_W + CELL_GAP)
      const sy = this.gridY + (slot.row + 1) * (CELL_H + CELL_GAP)
      if (this.hit(x, y, sx, sy)) {
        this.fillSlot(slot)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private hit(x: number, y: number, bx: number, by: number) {
    return x >= bx && x <= bx + CELL_W && y >= by && y <= by + CELL_H
  }

  private fillSlot(slot: SlotCell) {
    slot.filled = true
    slot.animT  = 0
    this.filledCount++
    this.playSound(this.endings[slot.col])
    playSound(this.sfxCorrect)

    if (this.filledCount >= this.slots.length) {
      this.locked = true
      setTimeout(() => this.nextProblem(), 1200)
    }
  }

  private playSound(text: string) {
    const url   = assetUrl(`${A}/sound/${text}.m4a`)
    const audio = new Audio(url)
    audio.onerror = () => {}
    audio.play().catch(() => {})
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

  // ── Update ───────────────────────────────────────────────────────────────
  update(_t: number, dt: number) {
    for (const slot of this.slots) {
      if (slot.filled && slot.animT < 1) {
        slot.animT = Math.min(1, slot.animT + dt * 3)
      }
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────────────
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
    this.di(ctx, this.imgBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded) {
      this.txt(ctx, 'Loading…', CX, CY, 80, '#fff')
      ctx.restore(); return
    }

    // Board
    const boardW = (this.cols + 1) * (CELL_W + CELL_GAP) + BOARD_PAD_X * 2
    const boardH = (this.rows + 1) * (CELL_H + CELL_GAP) + BOARD_PAD_Y * 2
    const boardX = this.gridX - BOARD_PAD_X
    const boardY = this.gridY - BOARD_PAD_Y
    this.di(ctx, this.imgBoard, boardX, boardY, boardW, boardH)

    // Instruction
    const instrY = this.gridY - BOARD_PAD_Y - 60
    this.txt(ctx, 'Tap the squares to build words!', CX, instrY, 52, '#5D4037')

    // Ending header row (top)
    for (let c = 0; c < this.cols; c++) {
      const bx = this.gridX + (c + 1) * (CELL_W + CELL_GAP)
      const by = this.gridY
      this.di(ctx, this.imgBtnH, bx, by, CELL_W, CELL_H)
      this.txt(ctx, this.endings[c], bx + CELL_W / 2, by + CELL_H / 2, 80, '#1A237E')
    }

    // Letter header column (left)
    const letterColors = ['#E53935','#0288D1','#388E3C','#F57C00']
    for (let r = 0; r < this.rows; r++) {
      const bx = this.gridX
      const by = this.gridY + (r + 1) * (CELL_H + CELL_GAP)
      this.di(ctx, this.imgBlockTop[r % 5], bx, by, CELL_W, CELL_H)
      this.txt(ctx, this.letters[r], bx + CELL_W / 2, by + CELL_H / 2, 84, letterColors[r] ?? '#fff')
    }

    // Slot grid
    for (const slot of this.slots) {
      const sx = this.gridX + (slot.col + 1) * (CELL_W + CELL_GAP)
      const sy = this.gridY + (slot.row + 1) * (CELL_H + CELL_GAP)

      if (slot.filled) {
        // Scale-in animation
        const s = slot.animT
        ctx.save()
        ctx.translate(sx + CELL_W / 2, sy + CELL_H / 2)
        ctx.scale(s, s)
        this.di(ctx, this.imgSlotSel, -CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H)
        // Highlight tint
        ctx.fillStyle = `rgba(76,175,80,${0.25 * s})`
        this.roundRect(ctx, -CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, CORNER)
        ctx.fill()
        this.txt(ctx, slot.word, 0, 0, 68, '#1B5E20')
        ctx.restore()
      } else {
        this.di(ctx, this.imgSlot, sx, sy, CELL_W, CELL_H)
        // hint: letter in small grey
        this.txt(ctx, '?', sx + CELL_W / 2, sy + CELL_H / 2, 72, 'rgba(0,0,0,0.15)')
      }
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, 80, 60, 'rgba(255,255,255,0.9)')

    ctx.restore()
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private di(ctx: CanvasRenderingContext2D, img: HTMLImageElement,
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

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number,
                    w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  stop() { super.stop() }
}
