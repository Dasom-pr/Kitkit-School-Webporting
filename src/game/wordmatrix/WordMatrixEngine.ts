import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/wordmatrix'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2
const CY = GAME_HEIGHT / 2

// Letter block (center)
const LETTER_W = 220, LETTER_H = 220
const LETTER_X = CX - LETTER_W / 2
const LETTER_Y = CY - LETTER_H / 2 - 120

// Ending blocks (4 options arranged in 2×2 grid below)
const END_W = 280, END_H = 160
const END_GAP_X = 100, END_GAP_Y = 60
const END_COLS = 2
const TOTAL_END_W = END_COLS * END_W + (END_COLS - 1) * END_GAP_X
const END_START_X = CX - TOTAL_END_W / 2
const END_START_Y = CY + 140

// Words display (completed words shown below)
const WORDS_Y = GAME_HEIGHT - 220

// ─── Types ───────────────────────────────────────────────────────────────────
interface Problem {
  letter: string
  endings: string[]
}

interface Block {
  text: string
  x: number
  y: number
  w: number
  h: number
  isCorrect: boolean
  state: 'normal' | 'selected' | 'correct' | 'wrong'
}

// Pool of common endings for generating distractors
const DISTRACTOR_POOL = [
  'it','at','an','in','un','og','eg','ig','ug','ot',
  'op','ox','ob','od','am','ap','ag','ab','ed','en',
  'et','em','el','ep','ow','ew','aw','ay','ee','oo',
  'ank','ing','ong','ung','ink','ack','eck','ick','ock','uck',
]

// ─── Engine ──────────────────────────────────────────────────────────────────
export class WordMatrixEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false

  private currentProblem: Problem | null = null
  private blocks: Block[] = []
  private selectedCount = 0
  private correctCount = 0

  // Images
  private imgBg        = loadImage(assetUrl(`${A}/bg.png`))
  private imgBoard     = loadImage(assetUrl(`${A}/board.png`))
  private imgBlockTop  = [1,2,3,4,5].map(n => loadImage(assetUrl(`${A}/block_top_0${n}.png`)))
  private imgBlockSlot = loadImage(assetUrl(`${A}/block_top_slot.png`))
  private imgSlotArea  = loadImage(assetUrl(`${A}/slot_area.png`))
  private imgSlotAreaSel = loadImage(assetUrl(`${A}/slot_area_selected.png`))
  private imgBtnH      = loadImage(assetUrl(`${A}/btn_horizontal.png`))
  private imgBtnV      = loadImage(assetUrl(`${A}/btn_vertical.png`))

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxIncorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  private playWordSound(text: string) {
    const audio = new Audio(assetUrl(`${A}/sound/${text}.m4a`))
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
    const res  = await fetch('/data/games/wordmatrix.json')
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
    this.selectedCount = 0
    this.correctCount = 0
    this.locked = false

    // Generate distractors: pick endings from pool that aren't already in the problem
    const correctEndings = new Set(prob.endings)
    const distractors = DISTRACTOR_POOL
      .filter(e => !correctEndings.has(e))
      .sort(() => Math.random() - 0.5)
      .slice(0, 4 - prob.endings.length)

    // All options: correct endings + distractors, shuffled
    const allOptions = [...prob.endings, ...distractors].sort(() => Math.random() - 0.5)

    this.blocks = allOptions.map((text, i) => {
      const col = i % END_COLS
      const row = Math.floor(i / END_COLS)
      return {
        text,
        x: END_START_X + col * (END_W + END_GAP_X),
        y: END_START_Y + row * (END_H + END_GAP_Y),
        w: END_W,
        h: END_H,
        isCorrect: correctEndings.has(text),
        state: 'normal' as const,
      }
    })

    // Play the center letter sound
    this.playWordSound(prob.letter)
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return

    // Center letter block: replay sound
    if (this.currentProblem &&
        x >= LETTER_X && x <= LETTER_X + LETTER_W &&
        y >= LETTER_Y && y <= LETTER_Y + LETTER_H) {
      this.playWordSound(this.currentProblem.letter)
      return
    }

    for (const block of this.blocks) {
      if (block.state === 'correct') continue  // already matched
      if (x >= block.x && x <= block.x + block.w && y >= block.y && y <= block.y + block.h) {
        this.handleBlockTap(block)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleBlockTap(block: Block) {
    if (block.isCorrect) {
      block.state = 'correct'
      this.correctCount++
      this.playWordSound(block.text)
      playSound(this.sfxCorrect)

      if (this.correctCount >= (this.currentProblem?.endings.length ?? 2)) {
        this.locked = true
        setTimeout(() => this.nextProblem(), 1200)
      }
    } else {
      block.state = 'wrong'
      playSound(this.sfxIncorrect)
      setTimeout(() => { block.state = 'normal' }, 700)
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
    this.drawImg(ctx, this.imgBoard, CX - 700, 100, 1400, GAME_HEIGHT - 200)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#fff')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Center letter block (clickable)
    const blockImg = this.imgBlockTop[0]
    this.drawImg(ctx, blockImg, LETTER_X, LETTER_Y, LETTER_W, LETTER_H)
    this.txt(ctx, prob.letter, LETTER_X + LETTER_W / 2, LETTER_Y + LETTER_H / 2, 100, '#fff')

    // Instruction
    this.txt(ctx, 'Tap the correct word endings!', CX, LETTER_Y + LETTER_H + 60, 52, '#5D4037')

    // Ending blocks
    const colors = ['#FF8A65','#FFB74D','#66BB6A','#42A5F5']
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i]
      const slotImg = block.state === 'correct' ? this.imgBlockTop[1] :
                      block.state === 'wrong'   ? this.imgBlockTop[4] : this.imgBlockTop[2]
      this.drawImg(ctx, slotImg, block.x, block.y, block.w, block.h)

      if (block.state === 'correct') {
        ctx.save(); ctx.fillStyle = 'rgba(76,175,80,0.3)'
        ctx.beginPath(); this.rr(ctx, block.x, block.y, block.w, block.h, 14); ctx.fill(); ctx.restore()
      } else if (block.state === 'wrong') {
        ctx.save(); ctx.fillStyle = 'rgba(220,50,50,0.3)'
        ctx.beginPath(); this.rr(ctx, block.x, block.y, block.w, block.h, 14); ctx.fill(); ctx.restore()
      }

      this.txt(ctx, block.text, block.x + block.w / 2, block.y + block.h / 2, 72,
        block.state === 'correct' ? '#1B5E20' : block.state === 'wrong' ? '#B71C1C' : '#2E4057')
    }

    // Show formed words at bottom
    const formed = this.blocks.filter(b => b.state === 'correct')
    if (formed.length > 0) {
      const words = formed.map(b => prob.letter + b.text).join('  ')
      this.txt(ctx, words, CX, WORDS_Y, 80, '#FF6F00')
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
