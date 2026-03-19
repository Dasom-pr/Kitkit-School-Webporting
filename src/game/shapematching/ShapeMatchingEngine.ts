import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

// ─── Layout ──────────────────────────────────────────────────────────────────
const CARD_W   = 500
const CARD_H   = 560
const IMG_SIZE = 320
const DIVIDER_X = GAME_WIDTH / 2

// 2×2 grid per side
const LEFT_COLS  = [300,  900]
const RIGHT_COLS = [1660, 2260]
const ROWS       = [560, 1320]

const ASSET_BASE = '/assets/games/shapematching'

// ─── Types ───────────────────────────────────────────────────────────────────
type CardType = 'Image' | 'Object' | 'Name' | 'Attribute'

interface CardSpec {
  type:     CardType
  color:    string
  size:     string
  rotation: number | string
}

interface ProblemDef {
  numPairs:   number
  group:      string
  matchSound: boolean
  cardA:      CardSpec
  cardB:      CardSpec
}

interface ShapeInfo {
  is3D:   boolean
  sides?: number
  faces?: number
}

interface GameCard {
  pairId:      number      // cards with the same pairId belong to one pair
  shape:       string
  side:        'A' | 'B'
  type:        CardType
  rotationDeg: number
  x:           number
  y:           number
  image:       HTMLImageElement | null
  matched:     boolean
  selected:    boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ─── Engine ──────────────────────────────────────────────────────────────────
export class ShapeMatchingEngine extends BaseEngine {
  private levelNum: number

  private problems:    ProblemDef[]                   = []
  private shapeGroups: Record<string, string[]>       = {}
  private shapeInfo:   Record<string, ShapeInfo>      = {}

  private problemIndex  = 0
  private cards:        GameCard[] = []
  private selectedCard: GameCard | null = null
  private matchCount    = 0
  private totalPairs    = 0
  private loaded        = false
  private transitioning = false

  private sfxPick:  HTMLAudioElement
  private sfxMatch: HTMLAudioElement
  private sfxNames: Record<string, HTMLAudioElement> = {}
  private cardBg:   HTMLImageElement
  // number images: 0-10
  private numImgs:  HTMLImageElement[] = []

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.levelNum = level
    this.sfxPick  = loadAudio(assetUrl(`${ASSET_BASE}/sound/train_slotin.m4a`))
    this.sfxMatch = loadAudio(assetUrl(`${ASSET_BASE}/sound/quiz_correct.m4a`))
    this.cardBg   = loadImage(assetUrl(`${ASSET_BASE}/images/matching_shape_cardbg.png`))
    for (let i = 0; i <= 10; i++) {
      this.numImgs[i] = loadImage(
        assetUrl(`${ASSET_BASE}/images/matchinggame_numbers_type1_${i}.png`)
      )
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
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
    const res  = await fetch('/data/games/shapematching.json')
    const data = await res.json()

    this.shapeGroups = data.shapeGroups
    this.shapeInfo   = data.shapeInfo

    const levelData = (data.levels as Array<{ level: number; problems: ProblemDef[] }>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]

    this.problems     = levelData.problems
    this.problemIndex = 0

    for (const shape of Object.keys(this.shapeInfo)) {
      this.sfxNames[shape] = loadAudio(
        assetUrl(`${ASSET_BASE}/sound/${shape}.m4a`)
      )
    }

    this.loadProblem()
    this.loaded = true
  }

  private loadProblem() {
    const prob  = this.problems[this.problemIndex]
    const group = this.shapeGroups[prob.group] ?? []

    // ── Pick shapes: for Attribute cards ensure no duplicate attribute values ──
    const needsUniqueAttr =
      prob.cardA.type === 'Attribute' || prob.cardB.type === 'Attribute'
    const shapes = needsUniqueAttr
      ? this.pickUniqueAttrShapes(group, prob.numPairs)
      : shuffle(group).slice(0, prob.numPairs)

    this.matchCount   = 0
    this.totalPairs   = shapes.length   // may be < numPairs if not enough unique
    this.selectedCard = null

    const cardsA: GameCard[] = []
    const cardsB: GameCard[] = []

    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i]
      const info  = this.shapeInfo[shape] ?? { is3D: false, sides: 0 }
      cardsA.push(this.buildCard(i, shape, 'A', prob.cardA, info))
      cardsB.push(this.buildCard(i, shape, 'B', prob.cardB, info))
    }

    const posLeft  = this.getPositions('left',  shapes.length)
    const posRight = this.getPositions('right', shapes.length)
    const shuffledA = shuffle(cardsA)
    const shuffledB = shuffle(cardsB)

    shuffledA.forEach((c, i) => { c.x = posLeft[i].x;  c.y = posLeft[i].y  })
    shuffledB.forEach((c, i) => { c.x = posRight[i].x; c.y = posRight[i].y })

    this.cards = [...shuffledA, ...shuffledB]
    this.onProgressChange?.(this.matchCount, this.totalPairs)
  }

  /** Pick `count` shapes with unique attribute (sides / faces) values */
  private pickUniqueAttrShapes(group: string[], count: number): string[] {
    const shuffled = shuffle(group)
    const seen     = new Set<number>()
    const result:  string[] = []
    for (const shape of shuffled) {
      const info = this.shapeInfo[shape]
      if (!info) continue
      const val = info.is3D ? (info.faces ?? 0) : (info.sides ?? 0)
      if (!seen.has(val)) {
        seen.add(val)
        result.push(shape)
        if (result.length >= count) break
      }
    }
    return result
  }

  // ── Card factory ───────────────────────────────────────────────────────────
  private buildCard(
    id: number,
    shape: string,
    side: 'A' | 'B',
    spec: CardSpec,
    info: ShapeInfo
  ): GameCard {
    const rotationDeg = spec.rotation === 'Random'
      ? pick([0, 90, 180, 270])
      : (spec.rotation as number)

    let image: HTMLImageElement | null = null

    switch (spec.type) {
      case 'Image':
        image = loadImage(assetUrl(this.buildImageUrl(shape, spec.color, spec.size, info.is3D)))
        break
      case 'Object': {
        const objUrl = `${ASSET_BASE}/images/matchinggame_${shape}_object.png`
        image = loadImage(assetUrl(objUrl))
        break
      }
      case 'Attribute': {
        const attrVal = info.is3D ? (info.faces ?? 0) : (info.sides ?? 0)
        // Use the pre-loaded number image (0–10)
        image = this.numImgs[Math.min(attrVal, 10)] ?? null
        break
      }
      case 'Name':
        image = null  // drawn as text
        break
    }

    return {
      pairId: id, shape, side,
      type: spec.type, rotationDeg,
      x: 0, y: 0,
      image,
      matched: false, selected: false,
    }
  }

  private buildImageUrl(shape: string, color: string, size: string, is3D: boolean): string {
    if (is3D) {
      return `${ASSET_BASE}/images/matchinggame_${shape}.png`
    }
    const col = color === 'Random' ? pick(['1', '2']) : color
    const sz  = size  === 'Random' ? pick(['large', 'medium', 'small']) : size
    if (col === 'N/A' || sz === 'N/A') {
      return `${ASSET_BASE}/images/matchinggame_${shape}.png`
    }
    return `${ASSET_BASE}/images/matchinggame_${shape}_${col}_${sz}.png`
  }

  private getPositions(side: 'left' | 'right', count: number): Array<{ x: number; y: number }> {
    const cols = side === 'left' ? LEFT_COLS : RIGHT_COLS
    if (count <= 4) {
      return Array.from({ length: count }, (_, i) => ({
        x: cols[i % 2],
        y: ROWS[Math.floor(i / 2)],
      }))
    }
    // Fallback: vertical list (shouldn't normally occur with numPairs=4)
    return Array.from({ length: count }, (_, i) => ({
      x: side === 'left' ? 600 : 1960,
      y: 300 + i * 380,
    }))
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.transitioning) return

    for (const card of this.cards) {
      if (card.matched) continue
      if (!this.hitTest(x, y, card)) continue

      if (!this.selectedCard) {
        // No selection yet → select this card
        card.selected    = true
        this.selectedCard = card
        playSound(this.sfxPick)

      } else if (card === this.selectedCard) {
        // Tap same card again → deselect
        card.selected    = false
        this.selectedCard = null

      } else if (
        card.pairId === this.selectedCard.pairId &&
        card.side   !== this.selectedCard.side
      ) {
        // Correct match!
        this.triggerMatch(card)

      } else if (card.side === this.selectedCard.side) {
        // Same side, different card → change selection
        this.selectedCard.selected = false
        card.selected    = true
        this.selectedCard = card
        playSound(this.sfxPick)

      } else {
        // Wrong pair (opposite side, different shape) → clear selection
        this.selectedCard.selected = false
        this.selectedCard          = null
      }

      break
    }
  }

  onPointerMove(_x: number, _y: number) { /* tap-only game */ }
  onPointerUp(_x: number, _y: number)   { /* tap-only game */ }

  private triggerMatch(second: GameCard) {
    const shape = second.shape
    const prob  = this.problems[this.problemIndex]

    for (const c of this.cards) {
      if (c.pairId === second.pairId) {
        c.matched  = true
        c.selected = false
      }
    }
    this.selectedCard = null
    this.matchCount++

    if (prob.matchSound && this.sfxNames[shape]) {
      playSound(this.sfxNames[shape])
      setTimeout(() => playSound(this.sfxMatch), 700)
    } else {
      playSound(this.sfxMatch)
    }

    this.onProgressChange?.(this.matchCount, this.totalPairs)

    if (this.matchCount >= this.totalPairs) {
      const hasNext = this.problemIndex + 1 < this.problems.length
      this.transitioning = true
      setTimeout(() => {
        if (hasNext) {
          this.problemIndex++
          this.loadProblem()
          this.transitioning = false
        } else {
          this.transitioning = false
          this.gameState     = 'complete'
          this.onComplete?.()
        }
      }, 1000)
    }
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  update(_time: number, _dt: number) { /* state-based, no animation */ }

  draw() {
    const { ctx } = this
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    const offsetX = (w - GAME_WIDTH  * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(this.gameScale, this.gameScale)

    // Background
    ctx.fillStyle = '#7DB832'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded) {
      this.drawCenteredText(ctx, 'Loading…', 80, '#fff')
      ctx.restore()
      return
    }

    if (this.transitioning) {
      this.drawCenteredText(ctx, '✓  Great!', 100, '#fff')
      ctx.restore()
      return
    }

    // Divider
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth   = 8
    ctx.setLineDash([36, 24])
    ctx.beginPath()
    ctx.moveTo(DIVIDER_X, 170)
    ctx.lineTo(DIVIDER_X, GAME_HEIGHT - 80)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()

    // Header: problem index
    this.drawHeader(ctx)

    // Cards
    for (const card of this.cards) {
      if (!card.matched) this.drawCard(ctx, card)
    }

    ctx.restore()
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  private drawHeader(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.fillStyle    = 'rgba(0,0,0,0.28)'
    ctx.beginPath()
    roundRect(ctx, GAME_WIDTH / 2 - 300, 28, 600, 110, 22)
    ctx.fill()
    ctx.fillStyle    = '#FFFFFF'
    ctx.font         = 'bold 62px sans-serif'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `${this.problemIndex + 1}  /  ${this.problems.length}`,
      GAME_WIDTH / 2, 83
    )
    ctx.restore()
  }

  private drawCard(ctx: CanvasRenderingContext2D, card: GameCard) {
    ctx.save()
    ctx.translate(card.x, card.y)

    const hw = CARD_W / 2
    const hh = CARD_H / 2

    // Shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.32)'
    ctx.shadowBlur    = 22
    ctx.shadowOffsetY = 10

    // Card background
    ctx.beginPath()
    roundRect(ctx, -hw, -hh, CARD_W, CARD_H, 30)
    if (this.cardBg.complete && this.cardBg.naturalWidth > 0) {
      ctx.save()
      ctx.clip()
      ctx.drawImage(this.cardBg, -hw, -hh, CARD_W, CARD_H)
      ctx.restore()
    } else {
      ctx.fillStyle = '#FFFFFF'
      ctx.fill()
    }

    ctx.shadowColor   = 'transparent'
    ctx.shadowBlur    = 0
    ctx.shadowOffsetY = 0

    // Selection glow
    if (card.selected) {
      ctx.beginPath()
      roundRect(ctx, -hw, -hh, CARD_W, CARD_H, 30)
      ctx.strokeStyle = '#FFD600'
      ctx.lineWidth   = 14
      ctx.stroke()
      ctx.beginPath()
      roundRect(ctx, -hw + 7, -hh + 7, CARD_W - 14, CARD_H - 14, 24)
      ctx.strokeStyle = 'rgba(255,214,0,0.4)'
      ctx.lineWidth   = 10
      ctx.stroke()
    }

    // Content
    if (card.type === 'Image' || card.type === 'Object' || card.type === 'Attribute') {
      this.drawImageContent(ctx, card)
    } else if (card.type === 'Name') {
      this.drawNameContent(ctx, card)
    }

    ctx.restore()
  }

  private drawImageContent(ctx: CanvasRenderingContext2D, card: GameCard) {
    if (!card.image) return
    const s = IMG_SIZE

    ctx.save()
    if (card.rotationDeg !== 0) {
      ctx.rotate((card.rotationDeg * Math.PI) / 180)
    }
    if (card.image.complete && card.image.naturalWidth > 0) {
      ctx.drawImage(card.image, -s / 2, -s / 2, s, s)
    } else {
      // Placeholder while image loads
      ctx.fillStyle   = 'rgba(180,180,180,0.4)'
      ctx.strokeStyle = 'rgba(150,150,150,0.6)'
      ctx.lineWidth   = 4
      ctx.beginPath()
      roundRect(ctx, -s / 2, -s / 2, s, s, 14)
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawNameContent(ctx: CanvasRenderingContext2D, card: GameCard) {
    // Shape name as text – wrap underscored names to two lines
    const parts  = card.shape.split('_')
    const lines  = parts.length > 1
      ? [parts[0], parts.slice(1).join(' ')]
      : [card.shape]
    const lineH  = 82
    const totalH = lines.length * lineH

    ctx.fillStyle    = '#3E2723'
    ctx.font         = `bold ${lines.length > 1 ? 64 : 72}px sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    lines.forEach((line, i) => {
      ctx.fillText(line, 0, -totalH / 2 + lineH * i + lineH / 2)
    })
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  private drawCenteredText(ctx: CanvasRenderingContext2D, text: string, size: number, color: string) {
    ctx.fillStyle    = color
    ctx.font         = `bold ${size}px sans-serif`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, GAME_WIDTH / 2, GAME_HEIGHT / 2)
  }

  private hitTest(x: number, y: number, card: GameCard) {
    return (
      x >= card.x - CARD_W / 2 && x <= card.x + CARD_W / 2 &&
      y >= card.y - CARD_H / 2 && y <= card.y + CARD_H / 2
    )
  }
}
