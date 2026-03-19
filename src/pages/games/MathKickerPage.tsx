import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { WordKickerEngine } from '../../game/wordkicker/WordKickerEngine'
import ProgressBar from '../../components/ProgressBar'
import BackButton from '../../components/BackButton'
import { useShellParams } from '../../hooks/useShellParams'

const LEVEL_COLORS = [
  '#EF5350','#FF7043','#FFA726','#FFD54F','#AED581',
  '#4DB6AC','#4FC3F7','#42A5F5','#7986CB','#AB47BC',
  '#F06292','#A1887F','#78909C','#26C6DA',
]

export default function MathKickerPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<WordKickerEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 6 })
  const [showComplete, setShowComplete] = useState(false)
  const [availableLevels, setAvailableLevels] = useState<number[]>([])

  useEffect(() => {
    fetch('/data/games/mathkicker.json')
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
    setProgress({ current: 0, max: 6 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new WordKickerEngine(canvas, level, 'math')
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
        background: 'linear-gradient(135deg, #f093fb, #f5576c)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <BackButton color="#fff" />
        <h1 style={{ color: '#fff', fontSize: 40, fontWeight: 'bold',
                     textShadow: '2px 2px 6px rgba(0,0,0,0.3)', margin: 0 }}>
          Math Kicker
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, margin: 0 }}>
          Solve the math problem and choose the correct answer!
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap',
                      justifyContent: 'center', maxWidth: 700 }}>
          {availableLevels.map((lvl, i) => (
            <button key={lvl} onClick={() => startLevel(lvl)} style={{
              width: 76, height: 76, borderRadius: 16,
              background: LEVEL_COLORS[i % LEVEL_COLORS.length],
              color: '#fff', fontSize: 24, fontWeight: 'bold',
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
