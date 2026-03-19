import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const A = '/assets/games/wordwindow'

interface WWProblem {
  sentence: string
  voice: string
  examples: string[]
  answer: number  // index into examples
  formula: string
}

interface AnswerCard {
  text: string
  x: number
  y: number
  w: number
  h: number
  isCorrect: boolean
  state: 'normal' | 'correct' | 'wrong'
}

const CARD_W = 320, CARD_H = 180
const CX = GAME_WIDTH / 2

export class WordWindowEngine extends BaseEngine {
  private levelNum: number
  private problems: WWProblem[] = []
  private problemIndex = 0
  private loaded = false
  private locked = false
  private currentProblem: WWProblem | null = null
  private answerCards: AnswerCard[] = []
  private isPlayingVoice = false
  private voiceAudio: HTMLAudioElement | null = null

  private sfxCorrect = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'))
  private sfxWrong   = loadAudio(assetUrl('/assets/games/feedingtime/sfx/sfx_feedingtime_incorrect.m4a'))

  private playVoice(filename: string, onEnd?: () => void) {
    if (this.voiceAudio) { this.voiceAudio.pause(); this.voiceAudio = null }
    if (!filename) { onEnd?.(); return }
    const url = assetUrl(`/assets/localized/en-us/games/wordwindow/sound/${filename}`)
    const audio = new Audio(url)
    this.voiceAudio = audio
    this.isPlayingVoice = true
    audio.onended = () => { this.isPlayingVoice = false; this.voiceAudio = null; onEnd?.() }
    audio.play().catch(() => { this.isPlayingVoice = false; onEnd?.() })
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
    const res  = await fetch('/data/games/wordwindow.json')
    const data = await res.json()
    const ld   = (data.levels as Array<{level:number; problems:WWProblem[]}>)
      .find(l => l.level === this.levelNum) ?? data.levels[0]
    const shuffled = [...ld.problems].sort(() => Math.random() - 0.5)
    this.problems = shuffled.slice(0, 5)
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

    // Build answer cards (2x2 grid)
    const cards = prob.examples.slice(0, 4)
    const cardPositions = [
      { x: CX - CARD_W - 30, y: 1180 },
      { x: CX + 30,           y: 1180 },
      { x: CX - CARD_W - 30, y: 1400 },
      { x: CX + 30,           y: 1400 },
    ]
    this.answerCards = cards.map((text, i) => ({
      text,
      ...cardPositions[i] ?? { x: CX - CARD_W / 2, y: 1400 + i * 200 },
      w: CARD_W,
      h: CARD_H,
      isCorrect: i === prob.answer,
      state: 'normal' as const,
    }))

    // Play voice
    if (prob.voice) {
      setTimeout(() => this.playVoice(prob.voice), 400)
    }
  }

  onPointerDown(x: number, y: number) {
    if (!this.loaded || this.locked) return
    // Speaker replay button
    if (x >= CX - 80 && x <= CX + 80 && y >= 1060 && y <= 1160) {
      if (this.currentProblem?.voice) this.playVoice(this.currentProblem.voice)
      return
    }
    for (const card of this.answerCards) {
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.handleAnswer(card)
        return
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp(_x: number, _y: number) {}

  private handleAnswer(card: AnswerCard) {
    if (card.isCorrect) {
      card.state = 'correct'
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.nextProblem(), 1000)
    } else {
      card.state = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => { card.state = 'normal' }, 800)
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

  stop() {
    if (this.voiceAudio) { this.voiceAudio.pause(); this.voiceAudio = null }
    super.stop()
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
    ctx.fillStyle = '#E8F5E9'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Decorative top bar
    ctx.fillStyle = '#4CAF50'
    ctx.fillRect(0, 0, GAME_WIDTH, 100)

    if (!this.loaded || !this.currentProblem) {
      this.txt(ctx, 'Loading…', GAME_WIDTH / 2, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    const prob = this.currentProblem

    // Story card
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 24
    ctx.beginPath(); ctx.roundRect(CX - 900, 140, 1800, 880, 28); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()

    // Sentence text (wrap by @ symbol)
    const parts = prob.sentence.split('@')
    const lineY = 250 + (4 - parts.length) * 60
    for (let i = 0; i < parts.length; i++) {
      const fontSize = parts[i].length > 60 ? 46 : parts[i].length > 40 ? 52 : 58
      this.txt(ctx, parts[i], CX, lineY + i * 140, fontSize, '#1B5E20')
    }

    // Speaker button
    const speakerColor = this.isPlayingVoice ? '#FF9800' : '#2196F3'
    ctx.save()
    ctx.fillStyle = speakerColor
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 14
    ctx.beginPath(); ctx.arc(CX, 1110, 80, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0; ctx.restore()
    this.txt(ctx, '🔊', CX, 1110, 72, '#fff')

    // Answer cards
    for (const card of this.answerCards) {
      ctx.save()
      ctx.fillStyle = card.state === 'correct' ? 'rgba(76,175,80,0.92)' :
                      card.state === 'wrong'   ? 'rgba(220,50,50,0.88)' : 'rgba(255,255,255,0.95)'
      ctx.strokeStyle = card.state === 'correct' ? '#2E7D32' :
                        card.state === 'wrong'   ? '#B71C1C' : '#81C784'
      ctx.lineWidth = card.state !== 'normal' ? 5 : 3
      ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.roundRect(card.x, card.y, card.w, card.h, 20)
      ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.restore()

      this.txt(ctx, card.text, card.x + card.w / 2, card.y + card.h / 2, 80,
        card.state !== 'normal' ? '#fff' : '#1B5E20')
    }

    // Progress
    this.txt(ctx, `${this.problemIndex + 1} / ${this.problems.length}`,
      GAME_WIDTH / 2, GAME_HEIGHT - 60, 56, '#2E7D32')

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
