import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import { useCurriculum } from '../context/CurriculumContext'
import { getBirdIdleSrc, getEggSrc } from '../data/birdMap'
import {
  COOP_DESIGN, NEST_WIDTH_PCT, PANEL_WIDTH_PCT,
  birdTransform, birdSizePct, EGG_WIDTH_PCT, EGG_HEIGHT_PCT,
} from '../data/coopLayout'
import './CoopScenePage.css'

/**
 * CoopScene – Egg course selection screen.
 *
 * C++ layout (2560×1800 design, Cocos Y=0 at bottom):
 *   gridX = L ? 1-(lv%2) : 2+(lv%2)
 *   gridY = 2-(lv/2)  (integer division)
 *   panelPos = Vec2(2560/8*(1+2*gridX), 545*gridY)
 *
 *   Panel:  ANCHOR_MIDDLE_BOTTOM  at panelPos
 *   Nest:   ANCHOR_MIDDLE_BOTTOM  at panelPos + (0, 20)
 *   Bird:   per-type anchor       at panelPos + (0, 120)
 *
 * CSS conversion:
 *   left  = posX / 2560 * 100%
 *   bottom = posY / 1800 * 100%
 *   transform = translate(-anchorX*100%, anchorY*100%)
 */
export default function CoopScenePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const catFilter = searchParams.get('cat') // 'L' | 'M' | null
  const { getLevels, isLevelOpen, ratioDayCleared, loading } = useCurriculum()
  const [page] = useState(0)

  // 카테고리 없이 접근하면 카테고리 선택 화면으로 리다이렉트
  useEffect(() => {
    if (!catFilter) {
      navigate('/category', { replace: true })
    }
  }, [catFilter, navigate])

  if (loading || !catFilter) {
    return <div className="coop-loading">Loading...</div>
  }

  const allLevels = getLevels('en-US')
  const filteredByCategory = allLevels.filter(l => l.category === catFilter)

  // 단일 카테고리: 전체 12개 한 화면 (4열×3행)
  const singleCat = true
  const totalPages = 1
  const levels = filteredByCategory

  // 4열 배치를 위한 사이즈 축소 비율
  const scale = 0.72

  return (
    <div className="coop-root">
      <div className="coop-container">
        <img src={assetUrl('/assets/coopscene/coop_bg.jpg')} alt="" className="coop-bg" draggable={false} />

        <button className="coop-back" onClick={() => navigate(catFilter ? '/category' : '/')}>
          ← Back
        </button>

        {/* 페이지 이동 / 점 UI 불필요 (단일 카테고리 한 화면 표시) */}

        {levels.map(level => {
          if (level.numDays === 0) return null

          const lv = level.categoryLevel
          const isL = level.category === 'L'

          // 단일 카테고리: 4열×3행 / 혼합: 기존 2열×3행
          let cx: number, cy: number
          if (singleCat) {
            const col = lv % 4               // 0,1,2,3
            const row = Math.floor(lv / 4)   // 0,1,2
            cx = COOP_DESIGN.width / 8 * (1 + 2 * col)  // 320, 960, 1600, 2240
            cy = 1200 - row * 500            // 1200, 700, 200
          } else {
            const lvMod = lv % 6
            const gridX = isL ? 1 - (lvMod % 2) : 2 + (lvMod % 2)
            const gridY = 2 - Math.floor(lvMod / 2)
            cx = COOP_DESIGN.width / 8 * (1 + 2 * gridX)
            cy = 545 * gridY
          }

          // CSS percentages (position)
          const leftPct     = (cx / COOP_DESIGN.width) * 100
          const panelBotPct = (cy / COOP_DESIGN.height) * 100
          const nestBotPct  = ((cy + 20)  / COOP_DESIGN.height) * 100
          const birdBotPct  = ((cy + 120) / COOP_DESIGN.height) * 100

          const open = isLevelOpen(level.levelID)
          const ratio = ratioDayCleared(level.levelID)

          let panelImg = isL ? 'coop_woodpanel_english.png' : 'coop_woodpanel_math.png'
          if (lv === 0) panelImg = 'coop_woodpanel_prek.png'
          const nestImg = isL ? 'coop_english_nest.png' : 'coop_math_nest.png'

          // Per-bird sizing and anchor (실제 categoryLevel 기준)
          const birdSize = birdSizePct(level.category, level.categoryLevel)
          const birdXform = birdTransform(level.category, level.categoryLevel)

          return (
            <div
              key={level.levelID}
              className={`coop-slot ${open ? 'coop-slot--open' : 'coop-slot--locked'}`}
              onClick={() => { if (open) navigate(`/coop/${level.levelID}`) }}
            >
              {/* Bird or Egg at panelPos+(0,120) */}
              {open ? (
                <img
                  src={getBirdIdleSrc(level.category, level.categoryLevel)}
                  alt={level.levelTitle}
                  className="coop-bird-img"
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${birdBotPct}%`,
                    width: `${birdSize.widthPct * scale}%`,
                    transform: birdXform,
                  }}
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <img
                  src={getEggSrc(level.category, level.categoryLevel)}
                  alt="egg"
                  className="coop-egg"
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${birdBotPct}%`,
                    width: `${EGG_WIDTH_PCT * scale}%`,
                    // Egg anchor: (0.5, 0.05) → translate(-50%, 5%)
                    transform: 'translate(-50%, 5%)',
                  }}
                  draggable={false}
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              )}

              {/* Progress ring (shown on open birds with progress) */}
              {open && ratio > 0 && (
                <div
                  className="coop-progress-ring"
                  style={{
                    left: `${leftPct}%`,
                    bottom: `${birdBotPct}%`,
                    width: `${Math.max(birdSize.widthPct * scale, 4)}%`,
                    height: `${Math.max(birdSize.heightPct * scale, 5)}%`,
                  }}
                >
                  <svg viewBox="0 0 36 36" className="coop-ring-svg">
                    <path className="coop-ring-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="coop-ring-fill"
                      strokeDasharray={`${ratio * 100}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                </div>
              )}

              {/* Nest – ANCHOR_MIDDLE_BOTTOM at panelPos+(0,20) */}
              <img
                src={assetUrl(`/assets/coopscene/${nestImg}`)}
                alt=""
                className="coop-nest"
                style={{
                  left: `${leftPct}%`,
                  bottom: `${nestBotPct}%`,
                  width: `${NEST_WIDTH_PCT * scale}%`,
                }}
                draggable={false}
              />

              {/* Wood panel – ANCHOR_MIDDLE_BOTTOM at panelPos */}
              <div
                className="coop-panel-wrap"
                style={{
                  left: `${leftPct}%`,
                  bottom: `${panelBotPct}%`,
                  width: `${PANEL_WIDTH_PCT * scale}%`,
                }}
              >
                <img
                  src={assetUrl(`/assets/coopscene/${panelImg}`)}
                  alt=""
                  className="coop-panel-img"
                  draggable={false}
                />
                <span className="coop-panel-label">{level.levelTitle}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
