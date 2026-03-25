import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const C = '/assets/games/lrcomprehension/common/'
const S = '/assets/localized/en-us/games/lrcomprehension/sounds/'

const CX = GAME_WIDTH / 2   // 1280

// ── Layout constants (virtual 2560×1800) ─────────────────────────────────────

// Question highlight bar
const QH_LEFT = 200
const QH_CY   = 490
const QH_W    = 2067
const QH_H    = 128

// Speaker button inside highlight bar
const SPK_CX  = QH_LEFT + 88
const SPK_W   = 224
const SPK_H   = 225

// Story speaker (lcallinone replay button)
const STORY_SPK_CX = CX
const STORY_SPK_CY = 260
const STORY_SPK_W  = 300
const STORY_SPK_H  = 302

// Card dimensions
const CARD_SHORT_W = 1196, CARD_LONG_W = 2036
const CARD_H       = 180
const CARD_GAP     = 20
const CARD_TOP_Y   = 660
const LONG_THRESHOLD = 22

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// Reading phase layout
const READ_PAD_X  = 160
const READ_PAD_Y  = 120
const READ_TEXT_X = READ_PAD_X + 80
const READ_TEXT_Y = 340
const READ_TEXT_W = GAME_WIDTH - (READ_PAD_X + 80) * 2
const READ_FONT   = 58
const READ_LINE_H = 90

// Listening phase
const LISTEN_SPK_CY = 780
const LISTEN_SPK_W  = 300
const LISTEN_SPK_H  = 302

// "Next" button
const NEXT_CX = GAME_WIDTH - 350
const NEXT_CY = GAME_HEIGHT - 200
const NEXT_W  = 420
const NEXT_H  = 120

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReadingProblem  { type: 'readingonly';  text: string }
interface ListeningProblem { type: 'listeningonly'; script: string }
interface QuestionProblem {
  type: 'multiplechoices' | 'fillintheblank' | 'lcallinone'
  script?: string
  question: string
  audio: string
  options: string[]
  answer: string
}
type LRProblem = ReadingProblem | ListeningProblem | QuestionProblem

interface Story { title: string; problems: LRProblem[] }
interface LRLevel { level: number; stories: Story[] }

interface ChoiceCard {
  text: string
  x: number; y: number; w: number; h: number
  isCorrect: boolean
  state: 'normal' | 'correct' | 'wrong'
}

// ── Phase system ──────────────────────────────────────────────────────────────

interface ReadingPhase  { kind: 'reading';   title: string; text: string }
interface ListeningPhase { kind: 'listening'; title: string; audio: string }
interface QuestionPhase  { kind: 'question';  title: string; problem: QuestionProblem; cards: ChoiceCard[] }
type Phase = ReadingPhase | ListeningPhase | QuestionPhase

// ── Engine ────────────────────────────────────────────────────────────────────

export class LRComprehensionEngine extends BaseEngine {
  private levelNum: number
  private phases: Phase[] = []
  private phaseIndex = 0
  private loaded     = false
  private locked     = false
  private storyPhase = false   // lcallinone story audio playing

  private hasListened    = false  // for listening phase
  private isPlayingAudio = false
  private audio: HTMLAudioElement | null = null

  // ── Images ──────────────────────────────────────────────────────────────────
  private imgBg         = loadImage(assetUrl(`${C}comprehenson_background.png`))
  private imgPapersBot  = loadImage(assetUrl(`${C}comprehensive_papers_bottom.png`))
  private imgHighlight  = loadImage(assetUrl(`${C}comprehention_question_highlight.png`))
  private imgSpkNorm    = loadImage(assetUrl(`${C}comprehension-speaker-normal.png`))
  private imgSpkActive  = loadImage(assetUrl(`${C}comprehension-speaker-active.png`))
  private imgSpkBNorm   = loadImage(assetUrl(`${C}comprehension-speaker-b-normal.png`))
  private imgSpkBActive = loadImage(assetUrl(`${C}comprehension-speaker-b-active.png`))
  private imgCardN      = loadImage(assetUrl(`${C}comprehensivequiz_multiple_choice_text.png`))
  private imgCardR      = loadImage(assetUrl(`${C}comprehensivequiz_multiple_choice_text_right.png`))
  private imgCardW      = loadImage(assetUrl(`${C}comprehensivequiz_multiple_choice_text_wrong.png`))
  private imgCardLN     = loadImage(assetUrl(`${C}comprehensivequiz_multiple_choice_longtext.png`))
  private imgCardLR     = loadImage(assetUrl(`${C}comprehensivequiz_multiple_choice_longtext_right.png`))
  private imgCardLW     = loadImage(assetUrl(`${C}comprehensivequiz_multiple_choice_longtext_wrong.png`))

  // ── Sounds ──────────────────────────────────────────────────────────────────
  private sfxCorrect = loadAudio(assetUrl(`${C}ui_star_collected.m4a`))
  private sfxWrong   = loadAudio(assetUrl(`${C}card_miss.m4a`))

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.levelNum = level
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
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
    const res  = await fetch('/data/games/lrcomprehension.json')
    const data = await res.json()
    const ld   = (data.levels as LRLevel[]).find(l => l.level === this.levelNum) ?? data.levels[0]

    this.phases = []
    for (const story of ld.stories) {
      for (const prob of story.problems) {
        if (prob.type === 'readingonly') {
          this.phases.push({ kind: 'reading', title: story.title, text: prob.text })
        } else if (prob.type === 'listeningonly') {
          this.phases.push({ kind: 'listening', title: story.title, audio: prob.script })
        } else {
          const qp = prob as QuestionProblem
          this.phases.push({ kind: 'question', title: story.title, problem: qp, cards: this.buildCards(qp) })
        }
      }
    }

    const totalQ = this.phases.filter(p => p.kind === 'question').length
    this.phaseIndex = 0
    this.loaded = true
    this.onProgressChange?.(0, totalQ)
    this.startPhase()
  }

  private buildCards(prob: QuestionProblem): ChoiceCard[] {
    let options = [...prob.options]
    // fillintheblank: options are WRONG only → add correct answer & shuffle
    if (prob.type === 'fillintheblank') {
      options = [...options, prob.answer].sort(() => Math.random() - 0.5)
    }
    const useLong = options.some(o => o.length > LONG_THRESHOLD)
    const cardW   = useLong ? CARD_LONG_W : CARD_SHORT_W
    const cardX   = (GAME_WIDTH - cardW) / 2

    return options.slice(0, 6).map((text, i) => ({
      text,
      x: cardX,
      y: CARD_TOP_Y + i * (CARD_H + CARD_GAP),
      w: cardW,
      h: CARD_H,
      isCorrect: text === prob.answer,
      state: 'normal' as const,
    }))
  }

  private startPhase() {
    if (this.phaseIndex >= this.phases.length) {
      setTimeout(() => { this.gameState = 'complete'; this.onComplete?.() }, 300)
      return
    }
    const phase = this.phases[this.phaseIndex]
    this.locked     = false
    this.hasListened = false
    this.storyPhase  = false

    if (phase.kind === 'listening') {
      this.playAudio(phase.audio, () => { this.hasListened = true })
    } else if (phase.kind === 'question') {
      const prob = phase.problem
      if (prob.type === 'lcallinone' && prob.script) {
        this.storyPhase = true
        this.locked     = true
        this.playAudio(prob.script, () => {
          this.storyPhase = false
          this.locked     = false
          if (prob.audio) setTimeout(() => this.playAudio(prob.audio), 400)
        })
      } else if (prob.audio) {
        setTimeout(() => this.playAudio(prob.audio), 300)
      }
    }
  }

  // ── Audio ────────────────────────────────────────────────────────────────────
  private playAudio(filename: string, onEnd?: () => void) {
    this.stopAudio()
    if (!filename) { onEnd?.(); return }
    const audio = new Audio(assetUrl(`${S}${filename}`))
    this.audio          = audio
    this.isPlayingAudio = true
    const done = () => { this.isPlayingAudio = false; this.audio = null; onEnd?.() }
    audio.onended = done
    audio.onerror = done
    audio.play().catch(done)
  }

  private stopAudio() {
    if (this.audio) { this.audio.pause(); this.audio = null }
    this.isPlayingAudio = false
  }

  // ── Input ────────────────────────────────────────────────────────────────────
  onPointerDown(x: number, y: number) {
    if (!this.loaded) return
    const phase = this.phases[this.phaseIndex]
    if (!phase) return

    if (phase.kind === 'reading') {
      if (this.hitNext(x, y)) this.advancePhase()
      return
    }

    if (phase.kind === 'listening') {
      // Speaker tap → replay
      const dx = x - CX, dy = y - LISTEN_SPK_CY
      if (Math.sqrt(dx * dx + dy * dy) < 120) {
        this.playAudio(phase.audio, () => { this.hasListened = true })
        return
      }
      if (this.hasListened && !this.isPlayingAudio && this.hitNext(x, y)) this.advancePhase()
      return
    }

    if (phase.kind === 'question') {
      const prob = phase.problem
      // lcallinone story speaker
      if (prob.type === 'lcallinone' && prob.script) {
        const dx = x - STORY_SPK_CX, dy = y - STORY_SPK_CY
        if (Math.sqrt(dx * dx + dy * dy) < 100) { this.replayStory(prob); return }
      }
      // Question speaker
      if (!this.storyPhase && prob.audio) {
        const dx = x - SPK_CX, dy = y - QH_CY
        if (Math.sqrt(dx * dx + dy * dy) < 80) { this.playAudio(prob.audio); return }
      }
      // Cards
      if (this.locked) return
      for (const card of phase.cards) {
        if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
          this.handleChoice(phase, card); return
        }
      }
    }
  }
  onPointerMove(_x: number, _y: number) {}
  onPointerUp  (_x: number, _y: number) {}

  private hitNext(x: number, y: number) {
    return x >= NEXT_CX - NEXT_W / 2 && x <= NEXT_CX + NEXT_W / 2 &&
           y >= NEXT_CY - NEXT_H / 2 && y <= NEXT_CY + NEXT_H / 2
  }

  private replayStory(prob: QuestionProblem) {
    if (!prob.script) return
    this.storyPhase = true
    this.locked     = true
    this.playAudio(prob.script, () => {
      this.storyPhase = false
      this.locked     = false
      if (prob.audio) setTimeout(() => this.playAudio(prob.audio), 400)
    })
  }

  private handleChoice(phase: QuestionPhase, card: ChoiceCard) {
    if (card.state !== 'normal') return
    if (card.isCorrect) {
      card.state = 'correct'
      playSound(this.sfxCorrect)
      this.locked = true
      setTimeout(() => this.advancePhase(), 1000)
    } else {
      card.state = 'wrong'
      playSound(this.sfxWrong)
      setTimeout(() => { card.state = 'normal' }, 800)
    }
  }

  private advancePhase() {
    this.stopAudio()
    this.phaseIndex++
    const totalQ     = this.phases.filter(p => p.kind === 'question').length
    const doneQ      = this.phases.slice(0, this.phaseIndex).filter(p => p.kind === 'question').length
    this.onProgressChange?.(doneQ, totalQ)
    this.startPhase()
  }

  stop() { this.stopAudio(); super.stop() }

  // ── Render ───────────────────────────────────────────────────────────────────
  update(_t: number, _dt: number) {}

  draw() {
    const { ctx } = this
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight
    ctx.clearRect(0, 0, cw, ch)

    const ox = (cw - GAME_WIDTH  * this.gameScale) / 2
    const oy = (ch - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(this.gameScale, this.gameScale)

    this.drawImg(this.imgBg, 0, 0, GAME_WIDTH, GAME_HEIGHT)

    if (!this.loaded) {
      this.txt(ctx, 'Loading…', CX, GAME_HEIGHT / 2, 80, '#333')
      ctx.restore(); return
    }

    const phase = this.phases[this.phaseIndex]
    if (!phase) { ctx.restore(); return }

    if      (phase.kind === 'reading')   this.drawReading(phase)
    else if (phase.kind === 'listening') this.drawListening(phase)
    else                                 this.drawQuestion(phase)

    ctx.restore()
  }

  // ── Reading phase ─────────────────────────────────────────────────────────────
  private drawReading(phase: ReadingPhase) {
    const { ctx } = this

    // Paper overlay
    ctx.save()
    ctx.fillStyle = 'rgba(255, 252, 235, 0.93)'
    ctx.beginPath()
    ctx.roundRect(READ_PAD_X, READ_PAD_Y, GAME_WIDTH - READ_PAD_X * 2, GAME_HEIGHT - READ_PAD_Y - 100, 48)
    ctx.fill()
    ctx.restore()

    // Title
    if (phase.title) this.txt(ctx, phase.title, CX, READ_PAD_Y + 100, 72, '#1565C0')

    // Story text (word-wrapped)
    const lines = this.wrapText(phase.text, READ_TEXT_W, READ_FONT)
    lines.forEach((line, i) => {
      this.txt(ctx, line, CX, READ_TEXT_Y + i * READ_LINE_H, READ_FONT, '#2C2C2C')
    })

    // Next button
    this.drawNextBtn()
  }

  // ── Listening phase ───────────────────────────────────────────────────────────
  private drawListening(phase: ListeningPhase) {
    const { ctx } = this

    // Paper overlay
    ctx.save()
    ctx.fillStyle = 'rgba(255, 252, 235, 0.93)'
    ctx.beginPath()
    ctx.roundRect(READ_PAD_X, READ_PAD_Y, GAME_WIDTH - READ_PAD_X * 2, GAME_HEIGHT - READ_PAD_Y - 100, 48)
    ctx.fill()
    ctx.restore()

    // Title
    if (phase.title) this.txt(ctx, phase.title, CX, READ_PAD_Y + 100, 72, '#1565C0')

    // Speaker button
    const spkImg = this.isPlayingAudio ? this.imgSpkBActive : this.imgSpkBNorm
    this.drawImg(spkImg, CX - LISTEN_SPK_W / 2, LISTEN_SPK_CY - LISTEN_SPK_H / 2, LISTEN_SPK_W, LISTEN_SPK_H)

    const label = this.isPlayingAudio ? 'Listening…' : this.hasListened ? 'Tap to listen again' : 'Tap to listen'
    this.txt(ctx, label, CX, LISTEN_SPK_CY + LISTEN_SPK_H / 2 + 70, 58, '#1565C0')

    // Next button (only after at least one listen)
    if (this.hasListened && !this.isPlayingAudio) this.drawNextBtn()
  }

  // ── Question phase ────────────────────────────────────────────────────────────
  private drawQuestion(phase: QuestionPhase) {
    const { ctx } = this
    const prob = phase.problem

    this.drawImg(this.imgPapersBot, 0, 0, GAME_WIDTH, GAME_HEIGHT)

    // lcallinone story speaker
    if (prob.type === 'lcallinone' && prob.script) {
      const spkImg = this.storyPhase ? this.imgSpkBActive : this.imgSpkBNorm
      this.drawImg(spkImg, STORY_SPK_CX - STORY_SPK_W / 2, STORY_SPK_CY - STORY_SPK_H / 2, STORY_SPK_W, STORY_SPK_H)
      const label = this.storyPhase ? 'Listening to story…' : 'Tap to replay story'
      this.txt(ctx, label, STORY_SPK_CX, STORY_SPK_CY + STORY_SPK_H / 2 + 40, 52, '#1565C0')
    }

    // Question highlight bar
    this.drawImg(this.imgHighlight, QH_LEFT, QH_CY - QH_H / 2, QH_W, QH_H)

    const spkImg = this.isPlayingAudio ? this.imgSpkActive : this.imgSpkNorm
    this.drawImg(spkImg, SPK_CX - SPK_W / 2, QH_CY - SPK_H / 2, SPK_W, SPK_H)

    // Question text (fillintheblank: replace [word] with ___)
    const qRaw   = prob.question
    const qText  = prob.type === 'fillintheblank' ? qRaw.replace(/\[[^\]]+\]/, '___') : qRaw
    const textX  = SPK_CX + SPK_W / 2 + 30
    const maxW   = QH_LEFT + QH_W - textX - 60
    const qFsz   = qText.length > 60 ? 42 : qText.length > 40 ? 48 : qText.length > 25 ? 54 : 62
    this.txtClip(ctx, qText, textX, QH_CY, qFsz, '#383838', maxW)

    // Answer cards
    const useLong = phase.cards.some(c => c.text.length > LONG_THRESHOLD)
    const imgN = useLong ? this.imgCardLN : this.imgCardN
    const imgR = useLong ? this.imgCardLR : this.imgCardR
    const imgW = useLong ? this.imgCardLW : this.imgCardW

    for (let i = 0; i < phase.cards.length; i++) {
      const card = phase.cards[i]
      const bg   = card.state === 'correct' ? imgR : card.state === 'wrong' ? imgW : imgN
      this.drawImg(bg, card.x, card.y, card.w, card.h)

      const lColor = card.state === 'normal' ? '#07AB18' : card.state === 'wrong' ? '#949494' : '#FFFFFF'
      const tColor = card.state === 'normal' ? '#383838' : card.state === 'wrong' ? '#949494' : '#FFFFFF'

      this.txt(ctx, LETTERS[i], card.x + 60, card.y + card.h / 2, 60, lColor)
      const tsz = card.text.length > 40 ? 42 : card.text.length > 25 ? 48 : 55
      this.txtClip(ctx, card.text, card.x + 155, card.y + card.h / 2, tsz, tColor, card.w - 215, 'left')
    }

    // Progress
    const totalQ = this.phases.filter(p => p.kind === 'question').length
    const doneQ  = this.phases.slice(0, this.phaseIndex).filter(p => p.kind === 'question').length + 1
    this.txt(ctx, `${doneQ} / ${totalQ}`, CX, 80, 60, '#1565C0')
  }

  // ── Next button ───────────────────────────────────────────────────────────────
  private drawNextBtn() {
    const { ctx } = this
    ctx.save()
    ctx.fillStyle    = '#4CAF50'
    ctx.shadowColor  = 'rgba(0,0,0,0.2)'
    ctx.shadowBlur   = 20
    ctx.beginPath()
    ctx.roundRect(NEXT_CX - NEXT_W / 2, NEXT_CY - NEXT_H / 2, NEXT_W, NEXT_H, 60)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.restore()
    this.txt(ctx, 'Next ▶', NEXT_CX, NEXT_CY, 62, '#FFFFFF')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const { ctx } = this
    ctx.font = `${fontSize}px sans-serif`
    const words  = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const test = current ? current + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current); current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  }

  private drawImg(img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    if (img.complete && img.naturalWidth > 0) this.ctx.drawImage(img, x, y, w, h)
  }

  private txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
              size: number, color: string, align: CanvasTextAlign = 'center') {
    ctx.save()
    ctx.fillStyle    = color
    ctx.font         = `bold ${size}px sans-serif`
    ctx.textAlign    = align
    ctx.textBaseline = 'middle'
    ctx.fillText(s, x, y)
    ctx.restore()
  }

  private txtClip(ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
                  size: number, color: string, maxW: number, align: CanvasTextAlign = 'left') {
    ctx.save()
    ctx.fillStyle    = color
    ctx.font         = `bold ${size}px sans-serif`
    ctx.textAlign    = align
    ctx.textBaseline = 'middle'
    ctx.fillText(s, x, y, maxW)
    ctx.restore()
  }
}
