import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { WordWindowEngine } from '../../game/wordwindow/WordWindowEngine'
import { useShellParams } from '../../hooks/useShellParams'

const TOTAL_LEVELS = 17

export default function WordWindowPage() {
  const navigate = useNavigate()
  const { shellLevel, isFromShell, onGameComplete, shellBack } = useShellParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<WordWindowEngine | null>(null)
  const [level, setLevel] = useState(0)
  const [progress, setProgress] = useState({ current: 0, max: 5 })
  const [showComplete, setShowComplete] = useState(false)

  const startLevel = useCallback((lvl: number) => {
    setLevel(lvl)
    setShowComplete(false)
    setProgress({ current: 0, max: 5 })
  }, [])

  useEffect(() => {
    if (level === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new WordWindowEngine(canvas, level)
    engineRef.current = engine
    engine.onProgressChange = (current, max) => setProgress({ current, max })
    engine.onComplete = () => setShowComplete(true)
    engine.start()
    return () => { engine.stop(); engineRef.current = null }
  }, [level])

  useEffect(() => {
    if (shellLevel && level === 0) startLevel(shellLevel)
  }, [shellLevel, level, startLevel])

  useEffect(() => {
    if (showComplete && isFromShell) onGameComplete()
  }, [showComplete, isFromShell, onGameComplete])

  if (level === 0) {
    return (
      <div style={{ background: '#1B5E20', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ color: '#A5D6A7', fontSize: 48, marginBottom: 32 }}>📖 Word Window</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, maxWidth: 600 }}>
          {Array.from({ length: TOTAL_LEVELS }, (_, i) => (
            <button key={i + 1} onClick={() => startLevel(i + 1)} style={{
              background: 'rgba(255,255,255,0.1)', border: '2px solid #A5D6A7',
              color: '#A5D6A7', borderRadius: 12, padding: '12px 0', fontSize: 22, cursor: 'pointer',
            }}>
              {i + 1}
            </button>
          ))}
        </div>
        <button onClick={() => navigate(-1)} style={{ marginTop: 32, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>← Back</button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: 16, left: 16, color: '#fff', fontSize: 20, background: 'rgba(0,0,0,0.5)', padding: '6px 16px', borderRadius: 20 }}>
        Lv.{level} {progress.current}/{progress.max}
      </div>
      <button onClick={isFromShell ? shellBack : () => setLevel(0)} style={{
        position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)',
        color: '#fff', border: 'none', borderRadius: 20, padding: '8px 20px', cursor: 'pointer', fontSize: 18,
      }}>✕</button>
      {showComplete && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 80 }}>🎉</div>
          <div style={{ color: '#A5D6A7', fontSize: 48, marginBottom: 24 }}>Level Complete!</div>
          <button onClick={isFromShell ? shellBack : () => { setShowComplete(false); setLevel(0) }} style={{
            background: '#A5D6A7', color: '#1B5E20', border: 'none', borderRadius: 16,
            padding: '16px 48px', fontSize: 28, cursor: 'pointer', fontWeight: 'bold',
          }}>
            {isFromShell ? 'Back' : 'Choose Level'}
          </button>
        </div>
      )}
    </div>
  )
}
