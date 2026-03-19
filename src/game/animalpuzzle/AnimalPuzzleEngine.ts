import { BaseEngine, GAME_WIDTH, GAME_HEIGHT, loadImage, loadAudio, playSound } from '../common/BaseEngine'
import { assetUrl } from '../../utils/assetPath'

const ASSET_PATH = assetUrl('/assets/games/animalpuzzle')

// C++ constants from AnimalPuzzleSceneSpace
const BOARD_WIDTH = 2407
const BOARD_HEIGHT = 1296
const FRAME_WIDTH = 2426
const FRAME_HEIGHT = 1315
const SNAP_RADIUS_MOVED = 20
const SNAP_RADIUS_ENDED = 80

// Board origin in canvas coordinates (top-left of puzzle board)
const BOARD_ORIGIN_X = (GAME_WIDTH - BOARD_WIDTH) / 2   // 76.5
const BOARD_ORIGIN_Y = (GAME_HEIGHT - BOARD_HEIGHT) / 2 // 252

interface PieceData {
  pieceNumber: number
  filenamePrefix: string
  posX: number
  posY: number
  depth: string | null
  shadow: string | null
}

interface PuzzleData {
  languageTag: string
  level: number
  puzzleIndex: number
  text: string
  folderName: string
  background: string
  pieceCount: number
  mask: string | null
  sound: string | null
  pieces: PieceData[]
}

interface PuzzlePiece {
  data: PieceData
  image: HTMLImageElement
  depthImage: HTMLImageElement | null
  shadowImage: HTMLImageElement | null
  currentX: number
  currentY: number
  targetX: number
  targetY: number
  width: number
  height: number
  placed: boolean
  dragging: boolean
  snapAnim: number
  // For scatter animation: pieces start at target then animate out
  scatterTargetX: number
  scatterTargetY: number
  scatterDelay: number
  scatterProgress: number
  bodyVisible: boolean
}

export default class AnimalPuzzleEngine extends BaseEngine {
  level: number
  puzzles: PuzzleData[] = []
  currentPuzzleIndex = 0
  pieces: PuzzlePiece[] = []
  dragPiece: PuzzlePiece | null = null
  dragOffsetX = 0
  dragOffsetY = 0
  totalPuzzles = 0
  solvedCount = 0

  bgImage: HTMLImageElement
  boardFrame: HTMLImageElement
  puzzleBgImage: HTMLImageElement | null = null

  sfxPick: HTMLAudioElement
  sfxSnap: HTMLAudioElement
  sfxSolve: HTMLAudioElement

  onProgressChange?: (current: number, max: number) => void

  constructor(canvas: HTMLCanvasElement, level: number) {
    super(canvas)
    this.level = level

    this.bgImage = loadImage(`${ASSET_PATH}/_ap_woodbackground.jpg`)
    this.boardFrame = loadImage(`${ASSET_PATH}/ap_boardframe.png`)

    // C++: SFX_Wood_SlideOut, SFX_Wood_Correct, SFX_Counting_Win
    this.sfxPick = loadAudio(assetUrl('/assets/games/animalpuzzle/sound/sfx_wood_slideout.m4a'))
    this.sfxSnap = loadAudio(assetUrl('/assets/games/animalpuzzle/sound/sfx_wood_correct.m4a'))
    this.sfxSolve = loadAudio(assetUrl('/assets/games/animalpuzzle/sound/sfx_counting_win.m4a'))
  }

  async loadLevel() {
    const resp = await fetch('/data/games/animalpuzzle.json')
    const data = await resp.json()
    const levelKey = String(this.level)
    this.puzzles = data.levels[levelKey] || []

    if (this.puzzles.length === 0) return

    // C++: for level >= 5, shuffle puzzles and pick only 1
    if (this.level >= 5) {
      for (let i = this.puzzles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.puzzles[i], this.puzzles[j]] = [this.puzzles[j], this.puzzles[i]]
      }
      this.puzzles = [this.puzzles[0]]
    }

    this.totalPuzzles = this.puzzles.length
    this.solvedCount = 0
    this.currentPuzzleIndex = 0
    this.setupPuzzle()
  }

  /**
   * Convert piece data position (Cocos2d bottom-left relative to board)
   * to canvas position (top-left coordinates in game space).
   *
   * C++ computes: piece->_targetPos = boardOrigin + posVector + pSize/2
   * where boardOrigin is bottom-left of board in Cocos2d (Y-up).
   * The piece anchor is MIDDLE, so _targetPos is the center.
   *
   * For canvas (Y-down), we draw from top-left corner:
   *   canvasX = BOARD_ORIGIN_X + posX
   *   canvasY = BOARD_ORIGIN_Y + (BOARD_HEIGHT - posY - pieceHeight)
   */
  pieceTargetCanvasPos(posX: number, posY: number, pieceW: number, pieceH: number): { x: number; y: number } {
    return {
      x: BOARD_ORIGIN_X + posX,
      y: BOARD_ORIGIN_Y + (BOARD_HEIGHT - posY - pieceH),
    }
  }

  setupPuzzle() {
    const puzzle = this.puzzles[this.currentPuzzleIndex]
    if (!puzzle) return

    this.pieces = []
    this.dragPiece = null

    // Load puzzle background
    this.puzzleBgImage = loadImage(`${ASSET_PATH}/${puzzle.folderName}${puzzle.background}`)

    // C++ scatter logic: pieces are placed below the board area initially.
    // The C++ code converts board origin to world space and scatters pieces
    // in the area below the board (from screen bottom to board bottom edge).
    // In our canvas coords, that means from the board bottom to the game bottom.
    const boardBottomY = BOARD_ORIGIN_Y + BOARD_HEIGHT // canvas Y of board bottom

    // C++ start delay depends on text length
    const startDelay = puzzle.text.length > 15 ? 2.0 : 1.2

    for (let i = 0; i < puzzle.pieces.length; i++) {
      const pieceData = puzzle.pieces[i]
      const image = loadImage(`${ASSET_PATH}/${puzzle.folderName}${pieceData.filenamePrefix}.png`)

      // Load depth image (for placed pieces clipped to board)
      let depthImage: HTMLImageElement | null = null
      depthImage = loadImage(`${ASSET_PATH}/${puzzle.folderName}${pieceData.filenamePrefix}depth.png`)

      // Load shadow image
      let shadowImage: HTMLImageElement | null = null
      shadowImage = loadImage(`${ASSET_PATH}/${puzzle.folderName}${pieceData.filenamePrefix}shadow.png`)

      // We need piece dimensions to compute target position.
      // Use a default estimate; actual dimensions update when image loads.
      const defaultW = 400
      const defaultH = 400

      // Compute target position (will be refined when image loads)
      const target = this.pieceTargetCanvasPos(pieceData.posX, pieceData.posY, defaultW, defaultH)

      // C++ scatter area: below the board, across the full width.
      // piecePlaceOrigin = convertToNodeSpace(Vec2(0,0)) -> game node's bottom-left
      // piecePlaceEnd = convertToNodeSpace(Vec2(winSize.width, boardOriginWorldPos.y)) -> game node coords of board bottom
      // In canvas coords: scatter from 0 to GAME_WIDTH horizontally,
      // from boardBottomY to GAME_HEIGHT vertically (below board).
      const scatterX = Math.random() * (GAME_WIDTH - defaultW)
      const scatterY = boardBottomY + Math.random() * (GAME_HEIGHT - boardBottomY - defaultH / 2)
      const scatterDelay = startDelay + Math.random() * 0.5

      this.pieces.push({
        data: pieceData,
        image,
        depthImage,
        shadowImage,
        // Start at the target position (like C++) then animate out
        currentX: target.x,
        currentY: target.y,
        targetX: target.x,
        targetY: target.y,
        width: defaultW,
        height: defaultH,
        placed: false,
        dragging: false,
        snapAnim: 0,
        scatterTargetX: scatterX,
        scatterTargetY: scatterY,
        scatterDelay,
        scatterProgress: -scatterDelay, // negative = waiting for delay
        bodyVisible: false,
      })
    }

    this.onProgressChange?.(this.solvedCount + 1, this.totalPuzzles)
  }

  /**
   * Update target positions once images are loaded (we need actual dimensions).
   */
  updatePieceTargetsFromImages() {
    for (const piece of this.pieces) {
      if (piece.image.complete && (piece.width !== piece.image.width || piece.height !== piece.image.height)) {
        const oldW = piece.width
        const oldH = piece.height
        piece.width = piece.image.width
        piece.height = piece.image.height

        // Recompute target position with actual dimensions
        const target = this.pieceTargetCanvasPos(piece.data.posX, piece.data.posY, piece.width, piece.height)
        const wasAtOldTarget = (piece.currentX === piece.targetX && piece.currentY === piece.targetY)
        piece.targetX = target.x
        piece.targetY = target.y

        if (wasAtOldTarget && piece.scatterProgress < 0) {
          // Piece hasn't started scattering yet, keep at target
          piece.currentX = target.x
          piece.currentY = target.y
        }

        // Update scatter target with proper size constraints
        const boardBottomY = BOARD_ORIGIN_Y + BOARD_HEIGHT
        piece.scatterTargetX = Math.random() * (GAME_WIDTH - piece.width)
        piece.scatterTargetY = boardBottomY + Math.random() * Math.max(0, GAME_HEIGHT - boardBottomY - piece.height / 2)
      }
    }
  }

  start() {
    super.start()
    this.loadLevel()
  }

  onPointerDown(x: number, y: number) {
    if (this.dragPiece) return

    // Find topmost unplaced piece under pointer (reverse order = topmost)
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i]
      if (piece.placed) continue
      if (!piece.bodyVisible) continue // not yet scattered

      const pw = piece.image.complete ? piece.image.width : piece.width
      const ph = piece.image.complete ? piece.image.height : piece.height

      // C++ uses bounding box check: getBoundingBox().containsPoint(pos)
      if (x >= piece.currentX && x <= piece.currentX + pw &&
          y >= piece.currentY && y <= piece.currentY + ph) {
        piece.dragging = true
        this.dragPiece = piece
        this.dragOffsetX = x - piece.currentX
        this.dragOffsetY = y - piece.currentY

        playSound(this.sfxPick)

        // Move to top of render order (C++: removeFromParent + addChild)
        const idx = this.pieces.indexOf(piece)
        this.pieces.splice(idx, 1)
        this.pieces.push(piece)
        return
      }
    }
  }

  onPointerMove(x: number, y: number) {
    if (!this.dragPiece) return
    this.dragPiece.currentX = x - this.dragOffsetX
    this.dragPiece.currentY = y - this.dragOffsetY

    // C++: snapRadiusOnMoved = 20 -- snap while dragging if very close
    const piece = this.dragPiece
    const cx = piece.currentX + piece.width / 2
    const cy = piece.currentY + piece.height / 2
    const tx = piece.targetX + piece.width / 2
    const ty = piece.targetY + piece.height / 2
    const dist = Math.sqrt((cx - tx) ** 2 + (cy - ty) ** 2)
    if (dist < SNAP_RADIUS_MOVED) {
      this.snapPiece(piece)
    }
  }

  onPointerUp(_x: number, _y: number) {
    if (!this.dragPiece) return
    const piece = this.dragPiece

    // C++ snapRadiusOnEnded = 80
    const cx = piece.currentX + piece.width / 2
    const cy = piece.currentY + piece.height / 2
    const tx = piece.targetX + piece.width / 2
    const ty = piece.targetY + piece.height / 2
    const dist = Math.sqrt((cx - tx) ** 2 + (cy - ty) ** 2)

    if (dist < SNAP_RADIUS_ENDED) {
      this.snapPiece(piece)
    }

    piece.dragging = false
    this.dragPiece = null
  }

  snapPiece(piece: PuzzlePiece) {
    if (piece.placed) return

    // C++: setPosition(_targetPos), setPicked(false), shadow hidden, _snapped = true
    piece.currentX = piece.targetX
    piece.currentY = piece.targetY
    piece.placed = true
    piece.dragging = false
    piece.snapAnim = 0
    this.dragPiece = null

    // Check if all pieces placed
    const allPlaced = this.pieces.every(p => p.placed)
    if (allPlaced) {
      this.solvedCount++
      playSound(this.sfxSolve)

      // C++: voice delay then advance
      const puzzle = this.puzzles[this.currentPuzzleIndex]
      const voiceDelay = puzzle && puzzle.text.length > 15 ? 2.0 : 1.0
      setTimeout(() => {
        this.advancePuzzle()
      }, (voiceDelay + 1.0) * 1000)
    } else {
      playSound(this.sfxSnap)
    }
  }

  advancePuzzle() {
    if (this.currentPuzzleIndex < this.puzzles.length - 1) {
      this.currentPuzzleIndex++
      this.setupPuzzle()
    } else {
      this.gameState = 'complete'
      this.onComplete?.()
    }
  }

  update(_time: number, dt: number) {
    // Update target positions when images finish loading
    this.updatePieceTargetsFromImages()

    for (const piece of this.pieces) {
      // Scatter animation: pieces start at target, then fly out to random positions
      if (!piece.placed && piece.scatterProgress < 1) {
        piece.scatterProgress += dt
        if (piece.scatterProgress >= 0 && !piece.bodyVisible) {
          // Scatter starts now - C++ does NOT play sound per piece scatter
          piece.bodyVisible = true
        }
        if (piece.bodyVisible) {
          // EaseOut animation over 0.5 seconds
          const t = Math.min(Math.max((piece.scatterProgress) / 0.5, 0), 1)
          const eased = 1 - (1 - t) * (1 - t) // EaseOut quadratic
          piece.currentX = piece.targetX + (piece.scatterTargetX - piece.targetX) * eased
          piece.currentY = piece.targetY + (piece.scatterTargetY - piece.targetY) * eased
        }
      }

      // Snap animation
      if (piece.placed && piece.snapAnim < 1) {
        piece.snapAnim = Math.min(piece.snapAnim + dt * 4, 1)
      }
    }
  }

  draw() {
    const { ctx, canvas } = this
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    ctx.clearRect(0, 0, w, h)
    this.drawBackgroundImage(this.bgImage, w, h)

    const offsetX = (w - GAME_WIDTH * this.gameScale) / 2
    const offsetY = (h - GAME_HEIGHT * this.gameScale) / 2
    ctx.save()
    ctx.translate(offsetX, offsetY)
    const gs = this.gameScale

    // Draw puzzle area background - C++ board: 2407x1296, centered in 2560x1800
    const puzzleAreaX = BOARD_ORIGIN_X * gs
    const puzzleAreaY = BOARD_ORIGIN_Y * gs
    const puzzleAreaW = BOARD_WIDTH * gs
    const puzzleAreaH = BOARD_HEIGHT * gs

    // Draw board frame - C++ frame size: 2426 x 1315, centered
    if (this.boardFrame.complete) {
      const frameW = FRAME_WIDTH * gs
      const frameH = FRAME_HEIGHT * gs
      const frameX = ((GAME_WIDTH - FRAME_WIDTH) / 2) * gs
      const frameY = ((GAME_HEIGHT - FRAME_HEIGHT) / 2) * gs
      ctx.drawImage(this.boardFrame, frameX, frameY, frameW, frameH)
    }

    // Draw puzzle background image (clipped to board area)
    if (this.puzzleBgImage?.complete) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(puzzleAreaX, puzzleAreaY, puzzleAreaW, puzzleAreaH)
      ctx.clip()
      ctx.drawImage(this.puzzleBgImage, puzzleAreaX, puzzleAreaY, puzzleAreaW, puzzleAreaH)
      ctx.restore()
    }

    // Draw shadow/outline hints at target positions for unplaced pieces
    // C++: shadows are children of the piece node, drawn at piece center.
    // When piece is not picked, shadow is at size/2 (centered in piece).
    // The shadow image is the same size as the piece and drawn at the target.
    for (const piece of this.pieces) {
      if (!piece.placed) {
        this.drawPieceShadowAtTarget(piece, gs)
      }
    }

    // C++ PLACED: switchTo2D — face only (no depth, no shadow)
    for (const piece of this.pieces) {
      if (piece.placed) {
        this.drawPiece(piece, gs, true)
      }
    }

    // C++ UNPLACED: 3D mode — depth + shadow + face (depth gives thickness)
    for (const piece of this.pieces) {
      if (!piece.placed && piece.bodyVisible) {
        this.drawPieceWithDepth(piece, gs)
      }
    }

    // Draw puzzle title text
    // C++: Label at (winSize.width/2, gameNode.boundingBox.origin.y) with font size 160
    const puzzle = this.puzzles[this.currentPuzzleIndex]
    if (puzzle && this.pieces.every(p => p.placed)) {
      ctx.fillStyle = '#464646'
      ctx.font = `bold ${80 * gs}px TodoMainCurly, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 4 * gs
      ctx.fillText(puzzle.text, (GAME_WIDTH / 2) * gs, (GAME_HEIGHT - 80) * gs)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }

    ctx.restore()
  }

  /**
   * Draw the shadow image at the piece's target position on the board.
   * C++: shadow is a child sprite of the piece, positioned at piece center (size/2).
   * The shadow image is drawn at the same position as the piece face,
   * giving a silhouette hint where the piece should go.
   */
  drawPieceShadowAtTarget(piece: PuzzlePiece, gs: number) {
    const { ctx } = this

    const pw = piece.image.complete ? piece.image.width : piece.width
    const ph = piece.image.complete ? piece.image.height : piece.height
    const tx = piece.targetX * gs
    const ty = piece.targetY * gs

    if (piece.shadowImage?.complete) {
      ctx.globalAlpha = 0.5
      ctx.drawImage(piece.shadowImage, tx, ty, pw * gs, ph * gs)
      ctx.globalAlpha = 1
    } else {
      // Fallback: semi-transparent version of the piece image
      if (piece.image.complete) {
        ctx.globalAlpha = 0.2
        ctx.drawImage(piece.image, tx, ty, pw * gs, ph * gs)
        ctx.globalAlpha = 1
      }
    }
  }

  /**
   * Draw a puzzle piece (face image).
   * C++ picked state: face moves up 5px, shadow moves right+5/down-5 relative to piece center.
   * In canvas Y-down: "up" = -5 canvas pixels, shadow "down" in Cocos = +5 canvas pixels.
   */
  /** C++ switchTo2D: placed piece — face only at target */
  drawPiece(piece: PuzzlePiece, gs: number, atTarget: boolean) {
    const { ctx } = this
    if (!piece.image.complete) return

    const pw = piece.width
    const ph = piece.height
    const baseX = (atTarget ? piece.targetX : piece.currentX) * gs
    const baseY = (atTarget ? piece.targetY : piece.currentY) * gs

    if (piece.placed && piece.snapAnim < 1) {
      // Snap animation: scale bounce from center
      const scale = 1 + Math.sin(piece.snapAnim * Math.PI) * 0.15
      ctx.save()
      ctx.translate(baseX + pw * gs / 2, baseY + ph * gs / 2)
      ctx.scale(scale, scale)
      ctx.drawImage(piece.image, -pw * gs / 2, -ph * gs / 2, pw * gs, ph * gs)
      ctx.restore()
    } else {
      ctx.drawImage(piece.image, baseX, baseY, pw * gs, ph * gs)
    }
  }

  /** C++ 3D mode: unplaced piece — shadow + depth + face (gives thickness) */
  drawPieceWithDepth(piece: PuzzlePiece, gs: number) {
    const { ctx } = this
    if (!piece.image.complete) return

    const pw = piece.width
    const ph = piece.height
    const baseX = piece.currentX * gs
    const baseY = piece.currentY * gs

    if (piece.dragging) {
      // Dragging: drop shadow offset, depth+face lifted
      if (piece.shadowImage?.complete) {
        ctx.drawImage(piece.shadowImage,
          baseX + 6 * gs, baseY + 6 * gs,
          pw * gs, ph * gs)
      }
      if (piece.depthImage?.complete) {
        ctx.drawImage(piece.depthImage, baseX, baseY - 4 * gs, pw * gs, ph * gs)
      }
      ctx.drawImage(piece.image, baseX, baseY - 4 * gs, pw * gs, ph * gs)
    } else {
      // Normal: shadow + depth + face stacked (3D look)
      if (piece.shadowImage?.complete) {
        ctx.drawImage(piece.shadowImage, baseX, baseY, pw * gs, ph * gs)
      }
      if (piece.depthImage?.complete) {
        ctx.drawImage(piece.depthImage, baseX, baseY, pw * gs, ph * gs)
      }
      ctx.drawImage(piece.image, baseX, baseY, pw * gs, ph * gs)
    }
  }
}
