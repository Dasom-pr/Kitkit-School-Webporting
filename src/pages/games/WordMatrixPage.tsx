import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { WordMatrixEngine } from '../../game/wordmatrix/WordMatrixEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

const LEVEL_COLORS = [
  '#66BB6A','#42A5F5','#FFA726','#AB47BC','#EF5350',
  '#26C6DA','#8D6E63','#78909C','#EC407A','#7E57C2',
  '#29B6F6','#FF7043','#FFCA28','#81C784','#64B5F6',
  '#E57373','#FF8A65','#A1887F','#90A4AE','#F48FB1',
  '#80DEEA','#BCAAA4','#CE93D8','#80CBC4','#FFCC80',
  '#EF9A9A','#F48FB1','#9FA8DA','#80DEEA','#A5D6A7',
  '#FFF59D','#FFAB91','#BCAAA4',
]

export default function WordMatrixPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<WordMatrixEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 5 })
  const [showComplete, setShowComplete] = useState(false)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  useEffect(() => {
    fetch('/data/games/wordmatrix.json')
      .then(res => res.json())
      .then(data => {
        const lvls = (data.levels || [])
          .map((l: { level: number }) => l.level)
          .sort((a: number, b: number) => a - b)
        setAvailableLevels(lvls)
      })
      .catch(() => setAvailableLevels([]))
  }, [])

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 0, max: 5 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new WordMatrixEngine(canvas, level)
    engineRef.current = engine
    engine.onProgressChange = (current, max) => setProgress({ current, max })
    engine.onComplete = () => setShowComplete(true)
    engine.start()
    return () => engine.stop()
  }, [level])

  useEffect(() => {
    if (shellLevel && level === 0) startLevel(shellLevel)
  }, [shellLevel, level, startLevel])

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  if (level === 0) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: 'linear-gradient(135deg, #96fbc4, #f9f586)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#333" />
        <h1 style={{ color: '#333', fontSize: 40, fontWeight: 'bold',
                     textShadow: '1px 1px 3px rgba(0,0,0,0.15)', margin: 0 }}>
          Word Matrix
        </h1>
        <p style={{ color: 'rgba(0,0,0,0.65)', fontSize: 20, margin: 0 }}>
          Tap the correct word endings to build words!
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap',
                      justifyContent: 'center', maxWidth: 800 }}>
          {availableLevels.map((lvl, i) => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 70, height: 70, borderRadius: 14,
              background: LEVEL_COLORS[i % LEVEL_COLORS.length],
              color: '#fff', fontSize: 22, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {lvl}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%', touchAction: 'none',
      }} />
      <BackButton color="#fff" onClick={isFromShell ? shellBack : () => setLevel(0)} />
      <ProgressBar current={progress.current} max={progress.max} />

      {showComplete && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 200, gap: 28,
        }}>
          <div style={{ fontSize: 56, fontWeight: 'bold', color: '#fff',
                        textShadow: '2px 2px 10px rgba(0,0,0,0.5)' }}>
            🎉 Great Job!
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <button onClick={() => startLevel(level)} style={btnStyle('#4CAF50')}>Play Again</button>
            <button onClick={() => setLevel(0)}       style={btnStyle('#2196F3')}>Other Levels</button>
            <button onClick={() => isFromShell ? shellBack() : navigate('/')}
                    style={btnStyle('#FF5722')}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '14px 34px', borderRadius: 14,
    background: bg, color: '#fff',
    fontSize: 20, fontWeight: 'bold',
    border: 'none', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  }
}
