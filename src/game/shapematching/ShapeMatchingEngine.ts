import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const SHAPE_IMG_PATH = assetUrl('/assets/games/linematching/images/planefigure')

const CARD_W = 380
const CARD_H = 460
const IMG_SIZE = 260

interface CardAnim {
  phase: 'snap' | 'match_move' | 'match_fade'
  progress: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  opacity: number
}

interface Card {
  id: number
  x: number
  y: number
  homeX: number
  homeY: number
  image: HTMLImageElement
  label: string
  matched: boolean
  dragging: boolean
  linked: boolean
  linkedWith: number
  scale: number
  anim: CardAnim | null
}

interface PairDef {
  id: number
  imageA: string
  imageB: string
  label: string
}

interface LevelData {
  level: number
  pairs: PairDef[]
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export class ShapeMatchingEngine extends BaseEngine {
  level: number
  cards: Card[] = []
  dragIndex = -1
  dragOffsetX = 0
  dragOffsetY = 0
  isAnimating = false
  matchCount = 0
  totalPairs = 0
  loaded = false

  onProgressChange?: (current: number, max: number) => void

  private sfxPick: HTMLAudioElement
  private sfxMatch: HTMLAudioElement

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level
    this.sfxPick  = loadAudio(assetUrl('/assets/games/linematching/linestart.m4a'))
    this.sfxMatch = loadAudio(assetUrl('/assets/games/linematching/boom.m4a'))
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
    const res = await fetch('/data/games/shapematching.json')
    const data = await res.json()
    const levelData: LevelData =
      data.levels.find((l: LevelData) => l.level === this.level) ?? data.levels[0]

    this.totalPairs = levelData.pairs.length
    this.matchCount = 0
    this.cards = []

    const defs: Array<{ id: number; image: HTMLImageElement; label: string }> = []
    for (const pair of levelData.pairs) {
      defs.push({ id: pair.id, image: loadImage(`${SHAPE_IMG_PATH}/${pair.imageA}`), label: pair.label })
      defs.push({ id: pair.id, image: loadImage(`${SHAPE_IMG_PATH}/${pair.imageB}`), label: pair.label })
    }

    // Shuffle
    for (let i = defs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[defs[i], defs[j]] = [defs[j], defs[i]]
    }

    const positions = this.generatePositions(defs.length)

    this.cards = defs.map((d, i) => ({
      ...d,
      x: positions[i].x,
      y: positions[i].y,
      homeX: positions[i].x,
      homeY: positions[i].y,
      matched: false,
      dragging: false,
      linked: false,
      linkedWith: -1,
      scale: 1.0,
      anim: null,
    }))

    this.onProgressChange?.(0, this.totalPairs)
    this.loaded = true
  }

  private generatePositions(count: number) {
    const marginX = CARD_W * 0.65
    const marginY = CARD_H * 0.65
    const minY = marginY + 120
    const maxY = GAME_HEIGHT - marginY
    const minDist = CARD_W * 1.05
    const positions: Array<{ x: number; y: number }> = []

    for (let i = 0; i < count; i++) {
      let best = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }
      let bestDist = -1

      for (let attempt = 0; attempt < 120; attempt++) {
        const half = i % 2 === 0
        const x = half
          ? marginX + Math.random() * (GAME_WIDTH / 2 - marginX * 1.5)
          : GAME_WIDTH / 2 + marginX * 0.5 + Math.random() * (GAME_WIDTH / 2 - marginX * 1.5)
        const y = minY + Math.random() * (maxY - minY)

        const d = positions.reduce((m, p) => {
          const dx = x - p.x, dy = y - p.y
          return Math.min(m, Math.sqrt(dx * dx + dy * dy))
        }, Infinity)

        if (d > bestDist) { bestDist = d; best = { x, y } }
        if (d >= minDist) break
      }
      positions.push(best)
    }
    return positions
  }

  onPointerDown(x: number, y: number) {
    if (this.isAnimating || !this.loaded) return

    for (let i = this.cards.length - 1; i >= 0; i--) {
      const card = this.cards[i]
      if (card.matched || card.dragging) continue
      if (!this.hitTest(x, y, card)) continue

      card.dragging = true
      card.scale = 1.12
      card.anim = null
      this.dragOffsetX = x - card.x
      this.dragOffsetY = y - card.y
      // Move picked card to front
      this.cards.splice(i, 1)
      this.cards.push(card)
      this.dragIndex = this.cards.length - 1
      playSound(this.sfxPick)
      break
    }
  }

  onPointerMove(x: number, y: number) {
    if (this.isAnimating || this.dragIndex < 0) return

    const card = this.cards[this.dragIndex]
    card.x = x - this.dragOffsetX
    card.y = y - this.dragOffsetY

    // Update link
    const prevLink = card.linkedWith
    let newLink = -1

    for (let i = 0; i < this.cards.length; i++) {
      if (i === this.dragIndex) continue
      const other = this.cards[i]
      if (other.matched || other.linked) continue
      if (other.id !== card.id) continue
      if (this.cardsOverlap(card, other)) { newLink = i; break }
    }

    if (newLink !== prevLink) {
      if (prevLink >= 0) {
        this.cards[prevLink].linked = false
        this.cards[prevLink].linkedWith = -1
        this.cards[prevLink].scale = 1.0
      }
      card.linkedWith = newLink
      if (newLink >= 0) {
        this.cards[newLink].linked = true
        this.cards[newLink].linkedWith = this.dragIndex
        this.cards[newLink].scale = 1.12
      }
    }
  }

  onPointerUp(_x: number, _y: number) {
    if (this.isAnimating || this.dragIndex < 0) return

    const card = this.cards[this.dragIndex]
    card.dragging = false

    if (card.linkedWith >= 0) {
      this.triggerMatch(this.dragIndex, card.linkedWith)
    } else {
      card.scale = 1.0
      card.anim = {
        phase: 'snap', progress: 0, opacity: 1,
        startX: card.x, startY: card.y,
        targetX: card.homeX, targetY: card.homeY,
      }
    }
    this.dragIndex = -1
  }

  private triggerMatch(idxA: number, idxB: number) {
    this.isAnimating = true
    const a = this.cards[idxA]
    const b = this.cards[idxB]
    playSound(this.sfxMatch)

    a.matched = true; b.matched = true
    a.linked = false;  b.linked = false
    a.linkedWith = -1; b.linkedWith = -1

    const cx = GAME_WIDTH / 2
    const cy = GAME_HEIGHT / 2

    a.anim = { phase: 'match_move', progress: 0, opacity: 1,
               startX: a.x, startY: a.y, targetX: cx - CARD_W * 0.55, targetY: cy }
    b.anim = { phase: 'match_move', progress: 0, opacity: 1,
               startX: b.x, startY: b.y, targetX: cx + CARD_W * 0.55, targetY: cy }
  }

  update(_time: number, dt: number) {
    const ANIM_SPEED = 3.5

    for (const card of this.cards) {
      if (!card.anim) continue
      card.anim.progress = Math.min(1, card.anim.progress + dt * ANIM_SPEED)
      const t = easeOut(card.anim.progress)

      if (card.anim.phase === 'snap') {
        card.x = lerp(card.anim.startX, card.anim.targetX, t)
        card.y = lerp(card.anim.startY, card.anim.targetY, t)
        if (card.anim.progress >= 1) card.anim = null

      } else if (card.anim.phase === 'match_move') {
        card.x = lerp(card.anim.startX, card.anim.targetX, t)
        card.y = lerp(card.anim.startY, card.anim.targetY, t)
        if (card.anim.progress >= 1) {
          card.anim = { phase: 'match_fade', progress: 0, opacity: 1,
                        startX: card.x, startY: card.y, targetX: card.x, targetY: card.y }
        }

      } else if (card.anim.phase === 'match_fade') {
        card.anim.opacity = 1 - t
        if (card.anim.progress >= 1) card.anim = null
      }
    }

    if (this.isAnimating) {
      const busy = this.cards.some(c => c.matched && c.anim !== null)
      if (!busy) {
        this.isAnimating = false
        this.matchCount++
        this.onProgressChange?.(this.matchCount, this.totalPairs)
        if (this.matchCount >= this.totalPairs) {
          setTimeout(() => {
            this.gameState = 'complete'
            this.onComplete?.()
          }, 500)
        }
      }
    }
  }

  draw() {
    const { ctx } = this
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    ctx.clearRect(0, 0, w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(this.gameScale, this.gameScale)

    // Background — same green as original C++ game
    ctx.fillStyle = '#8CBD33'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = 'bold 80px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Loading...', GAME_WIDTH / 2, GAME_HEIGHT / 2)
      ctx.restore()
      return
    }

    // Draw non-dragging cards first, dragging card on top
    for (const card of this.cards) {
      if (card.dragging) continue
      if (card.matched && card.anim === null) continue
      this.drawCard(ctx, card)
    }
    if (this.dragIndex >= 0) {
      this.drawCard(ctx, this.cards[this.dragIndex])
    }

    ctx.restore()
  }

  private drawCard(ctx: CanvasRenderingContext2D, card: Card) {
    const opacity = card.anim ? card.anim.opacity : 1
    if (opacity <= 0) return

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.translate(card.x, card.y)
    ctx.scale(card.scale, card.scale)

    const hw = CARD_W / 2
    const hh = CARD_H / 2

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10

    // Card background
    ctx.fillStyle = card.linked ? '#FFF9C4' : '#FFFFFF'
    ctx.beginPath()
    this.roundRect(ctx, -hw, -hh, CARD_W, CARD_H, 28)
    ctx.fill()

    if (card.linked) {
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
      ctx.strokeStyle = '#FFC107'
      ctx.lineWidth = 8
      ctx.stroke()
    }

    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Shape image
    const imgY = -hh + (CARD_H - 100) / 2 - IMG_SIZE / 2
    if (card.image.complete && card.image.naturalWidth > 0) {
      ctx.drawImage(card.image, -IMG_SIZE / 2, imgY, IMG_SIZE, IMG_SIZE)
    } else {
      ctx.fillStyle = '#EEEEEE'
      ctx.fillRect(-IMG_SIZE / 2, imgY, IMG_SIZE, IMG_SIZE)
    }

    // Label
    ctx.fillStyle = '#5D4037'
    ctx.font = 'bold 52px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(card.label, 0, hh - 55)

    ctx.restore()
  }

  private roundRect(
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

  private hitTest(x: number, y: number, card: Card) {
    return (
      x >= card.x - CARD_W / 2 &&
      x <= card.x + CARD_W / 2 &&
      y >= card.y - CARD_H / 2 &&
      y <= card.y + CARD_H / 2
    )
  }

  private cardsOverlap(a: Card, b: Card) {
    return Math.abs(a.x - b.x) < CARD_W * 0.65 && Math.abs(a.y - b.y) < CARD_H * 0.65
  }
}
