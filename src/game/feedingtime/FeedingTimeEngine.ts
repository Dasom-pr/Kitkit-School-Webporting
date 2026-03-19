import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/feedingtime'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CX = GAME_WIDTH / 2          // 1280
const CY = GAME_HEIGHT / 2 - 100   // 800
const SIDE_W = 900                 // width of each side panel
const LEFT_CX  = CX - SIDE_W / 2 - 60   // ~770
const RIGHT_CX = CX + SIDE_W / 2 + 60   // ~1790
const FRUIT_SIZE = 140
const BTN_W = 280, BTN_H = 220
const BTN_Y = GAME_HEIGHT - 250

// ─── Types ───────────────────────────────────────────────────────────────────
type CellType = 'image' | 'number'

interface CellDef {
  type: CellType
  count: number
  op: string
  count2: number
}

interface Problem {
  left: CellDef
  right: CellDef
}

// Compute numeric value of a cell
function cellValue(c: CellDef): number {
  if (c.op === '+') return c.count + c.count2
  if (c.op === '-') return c.count - c.count2
  if (c.op === '*') return c.count * c.count2
  return c.count
}

// ─── Fruit grid positions (unit cell = 1, scale by spacing) ──────────────────
const GRID: Array<Array<[number, number]>> = [
  [],
  [[0,0]],
  [[-1,0],[1,0]],
  [[-1,0],[0,0],[1,0]],
  [[-1,-1],[1,-1],[-1,1],[1,1]],
  [[-1,-1],[0,-1],[1,-1],[-0.5,1],[0.5,1]],
  [[-1,-1],[0,-1],[1,-1],[-1,1],[0,1],[1,1]],
  [[-1.5,-1],[-0.5,-1],[0.5,-1],[1.5,-1],[-1,1],[0,1],[1,1]],
  [[-1.5,-1],[-0.5,-1],[0.5,-1],[1.5,-1],[-1.5,1],[-0.5,1],[0.5,1],[1.5,1]],
  [[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]],
  [[-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],[-2,1],[-1,1],[0,1],[1,1],[2,1]],
]

// ─── Engine ──────────────────────────────────────────────────────────────────
export class FeedingTimeEngine extends BaseEngine {
  private levelNum: number
  private problems: Problem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false     // input locked during feedback

  // Button states: 'normal' | 'correct' | 'wrong'
  private btnState: ['normal' | 'correct' | 'wrong',
                     'normal' | 'correct' | 'wrong',
                     'normal' | 'correct' | 'wrong'] = ['normal','normal','normal']

  // Images
  private imgBg    = loadImage(assetUrl(`${A}/whichisbigger_rsc_bg.png`))
  private imgGrass = loadImage(assetUrl(`${A}/whichisbigger_rsc_grass.png`))
  private imgWoodL = loadImage(assetUrl(`${A}/whichisbigger_rsc_wood_left.png`))
  private imgWoodR = loadImage(assetUrl(`${A}/whichisbigger_rsc_wood_right.png`))
  private imgBalloon = loadImage(assetUrl(`${A}/whichisbigger_rsc_balloon.png`))
  private imgAnimal: HTMLImageElement
  // Fruit images (fruit_0_0 … fruit_9_0)
  private fruits: HTMLImageElement[] = Array.from({length:10}, (_,i) =>
    loadImage(assetUrl(`${A}/objects/fruit_${i}_0.png`))
  )
  // Inequality images: ['>','=','<']
  private imgInq = [
    loadImage(assetUrl(`${A}/ui/whichisbigger_rsc_inequality_0.png`)),
    loadImage(assetUrl(`${A}/ui/whichisbigger_rsc_inequality_1.png`)),
    loadImage(assetUrl(`${A}/ui/whichisbigger_rsc_inequality_0.png`)),  // '<' = flipped '>'
  ]
  private imgSlotNormal  = loadImage(assetUrl(`${A}/ui/whichisbigger_rsc_slot_normal.png`))
  private imgSlotCorrect = loadImage(assetUrl(`${A}/ui/whichisbigger_rsc_slot_correct.png`))

  // Sounds
  private sfxCorrect   = loadAudio(assetUrl(`${A}/sfx/sfx_feedingtime_correct.m4a`))
  private sfxIncorrect = loadAudio(assetUrl(`${A}/sfx/sfx_feedingtime_incorrect.m4a`))

  // Fruit type used for this session (0-9)
  private fruitType = 0

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.levelNum = level
    this.imgAnimal = loadImage(assetUrl(`${A}/animals/${['croc','frog','hippo'][Math.floor(Math.random()*3)]}.png`))
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
    const res  = await fetch('/data/games/feedingtime.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:Problem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    // Pick 5 random problems from this level
    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems  = shuffled.slice(0, 5)
    this.problemIndex = 0
    this.fruitType  = Math.floor(Math.random() * 10)
    this.locked     = false
    this.btnState   = ['normal','normal','normal']
    this.onProgressChange?.(0, this.problems.length)
    this.loaded = true
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    const btns = this.buttonRects()
    for (let i = 0; i < 3; i++) {
      const b = btns[i]
      if (x >= b.x && x <= b.x+b.w && y >= b.y && y <= b.y+b.h) {
        this.handleChoice(i)
        break
      }
    }
  }
  onPointerMove(_x:number,_y:number) {}
  onPointerUp(_x:number,_y:number) {}

  private buttonRects() {
    const gap = 60
    const totalW = 3*BTN_W + 2*gap
    const startX = CX - totalW/2
    return [0,1,2].map(i => ({
      x: startX + i*(BTN_W+gap),
      y: BTN_Y - BTN_H/2,
      w: BTN_W, h: BTN_H,
    }))
  }

  private handleChoice(idx: number) {
    // idx: 0=>'>',  1=>'=',  2=>'<'
    const prob = this.problems[this.problemIndex]
    const lv   = cellValue(prob.left)
    const rv   = cellValue(prob.right)
    const correct =
      (idx === 0 && lv >  rv) ||
      (idx === 1 && lv === rv) ||
      (idx === 2 && lv <  rv)

    this.locked = true

    if (correct) {
      this.btnState[idx] = 'correct'
      playSound(this.sfxCorrect)
      setTimeout(() => this.nextProblem(), 1000)
    } else {
      this.btnState[idx] = 'wrong'
      playSound(this.sfxIncorrect)
      setTimeout(() => {
        this.btnState = ['normal','normal','normal']
        this.locked = false
      }, 800)
    }
  }

  private nextProblem() {
    this.problemIndex++
    this.btnState = ['normal','normal','normal']
    this.locked   = false
    this.onProgressChange?.(this.problemIndex, this.problems.length)
    if (this.problemIndex >= this.problems.length) {
      setTimeout(() => { this.gameState = 'complete'; this.onComplete?.() }, 300)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  update(_t:number,_dt:number){}

  draw() {
    const {ctx} = this
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    ctx.clearRect(0,0,w,h)

    const ox = (w - GAME_WIDTH  * this.gameScale) / 2
    const oy = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(this.gameScale, this.gameScale)

    // Background
    this.drawImg(ctx, this.imgBg,    0, 0, GAME_WIDTH, GAME_HEIGHT)
    this.drawImg(ctx, this.imgGrass, 0, GAME_HEIGHT*0.55, GAME_WIDTH, GAME_HEIGHT*0.45)
    this.drawImg(ctx, this.imgWoodL, 0,   GAME_HEIGHT*0.2, GAME_WIDTH*0.12, GAME_HEIGHT*0.6)
    this.drawImg(ctx, this.imgWoodR, GAME_WIDTH*0.88, GAME_HEIGHT*0.2, GAME_WIDTH*0.12, GAME_HEIGHT*0.6)

    if (!this.loaded) {
      this.txt(ctx, 'Loading…', GAME_WIDTH/2, GAME_HEIGHT/2, 80, '#fff')
      ctx.restore(); return
    }

    const prob = this.problems[this.problemIndex]

    // Left panel
    this.drawPanel(ctx, prob.left,  LEFT_CX,  CY)
    // Right panel
    this.drawPanel(ctx, prob.right, RIGHT_CX, CY)

    // Center: animal + balloon
    this.drawAnimalBalloon(ctx)

    // Buttons
    this.drawButtons(ctx)

    // Progress
    this.txt(ctx, `${this.problemIndex+1} / ${this.problems.length}`,
      GAME_WIDTH/2, 80, 60, 'rgba(255,255,255,0.9)')

    ctx.restore()
  }

  private drawPanel(ctx: CanvasRenderingContext2D, cell: CellDef, cx: number, cy: number) {
    const val = cellValue(cell)
    const panW = 620, panH = 460

    // Panel background
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.shadowColor = 'rgba(0,0,0,0.2)'
    ctx.shadowBlur  = 20
    ctx.beginPath()
    this.rr(ctx, cx - panW/2, cy - panH/2, panW, panH, 28)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.restore()

    if (cell.type === 'image' && val <= 10 && val >= 1) {
      // Fruits grid
      const grid  = GRID[val] ?? []
      const step  = val <= 4 ? 170 : val <= 6 ? 150 : 130
      const fruit = this.fruits[this.fruitType]
      const fs    = val <= 4 ? FRUIT_SIZE : val <= 7 ? 110 : 90
      for (const [gx, gy] of grid) {
        const fx = cx + gx * step - fs/2
        const fy = cy + gy * step - fs/2
        this.drawImg(ctx, fruit, fx, fy, fs, fs)
      }
    } else {
      // Number text (including expression)
      let label = String(val)
      if (cell.op) {
        label = `${cell.count}${cell.op}${cell.count2}`
      }
      const fontSize = label.length > 4 ? 90 : label.length > 2 ? 110 : 160
      this.txt(ctx, label, cx, cy+20, fontSize, '#2E4057')
    }
  }

  private drawAnimalBalloon(ctx: CanvasRenderingContext2D) {
    // Balloon with '?'
    const bw = 280, bh = 280
    this.drawImg(ctx, this.imgBalloon, CX - bw/2, CY - bh*1.4, bw, bh)
    this.txt(ctx, '?', CX, CY - bh, 120, '#fff')

    // Animal (sprite sheet shown as-is, clipped to reasonable size)
    if (this.imgAnimal.complete && this.imgAnimal.naturalWidth > 0) {
      const aw = 340, ah = 340
      ctx.drawImage(this.imgAnimal, CX - aw/2, CY - ah/4, aw, ah)
    }
  }

  private drawButtons(ctx: CanvasRenderingContext2D) {
    const rects = this.buttonRects()
    const labels = ['>', '=', '<']

    for (let i = 0; i < 3; i++) {
      const {x, y, w, h} = rects[i]
      const state = this.btnState[i]

      ctx.save()

      // Slot background
      const slotImg = state === 'correct' ? this.imgSlotCorrect : this.imgSlotNormal
      this.drawImg(ctx, slotImg, x, y, w, h)

      // Color overlay for wrong
      if (state === 'wrong') {
        ctx.fillStyle = 'rgba(220,50,50,0.4)'
        ctx.beginPath()
        this.rr(ctx, x, y, w, h, 20)
        ctx.fill()
      }

      // Inequality symbol
      const inqW = 120, inqH = 100
      const img = this.imgInq[i]
      if (img.complete && img.naturalWidth > 0) {
        ctx.save()
        if (i === 2) {
          // '<' = flip '>' horizontally
          ctx.translate(x + w/2 + inqW/2, y + h/2)
          ctx.scale(-1, 1)
          ctx.drawImage(img, -inqW/2, -inqH/2, inqW, inqH)
        } else {
          ctx.drawImage(img, x + w/2 - inqW/2, y + h/2 - inqH/2, inqW, inqH)
        }
        ctx.restore()
      } else {
        this.txt(ctx, labels[i], x + w/2, y + h/2 + 20, 120,
          state === 'correct' ? '#2e7d32' : state === 'wrong' ? '#c62828' : '#fff')
      }

      ctx.restore()
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private drawImg(ctx: CanvasRenderingContext2D, img: HTMLImageElement,
                  x:number, y:number, w:number, h:number) {
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x, y, w, h)
  }

  private txt(ctx: CanvasRenderingContext2D, s: string, x:number, y:number,
              size:number, color:string) {
    ctx.save()
    ctx.fillStyle    = color
    ctx.font         = `bold ${size}px sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s, x, y)
    ctx.restore()
  }

  private rr(ctx: CanvasRenderingContext2D, x:number, y:number,
             w:number, h:number, r:number) {
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y)
    ctx.quadraticCurveTo(x+w,y,x+w,y+r)
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r)
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y)
    ctx.closePath()
  }
}
