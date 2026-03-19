import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShapeMatchingEngine } from '../../game/shapematching/ShapeMatchingEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

const AVAILABLE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const LEVEL_COLORS = [
  '#66BB6A','#42A5F5','#FFA726','#AB47BC','#EF5350',
  '#26C6DA','#8D6E63','#78909C','#EC407A','#7E57C2',
  '#29B6F6','#FF7043',
]

export default function ShapeMatchingPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ShapeMatchingEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 1 })
  const [showComplete, setShowComplete] = useState(false)

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 0, max: 1 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new ShapeMatchingEngine(canvas, level)
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
        background: 'linear-gradient(135deg, #8CBD33, #5a9e1f)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 40, fontWeight: 'bold',
                     textShadow: '2px 2px 6px rgba(0,0,0,0.3)', margin: 0 }}>
          Shape Matching
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, margin: 0 }}>
          Tap two cards with the same shape to match them!
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {AVAILABLE_LEVELS.map((lvl, i) => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 80, height: 80, borderRadius: 16,
              background: LEVEL_COLORS[i % LEVEL_COLORS.length],
              color: '#fff', fontSize: 26, fontWeight: 'bold',
              border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
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
