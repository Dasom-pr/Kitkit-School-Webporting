import { useNavigate } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'

export default function CategorySelectPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundImage: `url(${assetUrl('/assets/mainscene/main_bg_sky.jpg')})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#87CEEB',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>

      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: 'rgba(0,0,0,0.4)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 16,
          cursor: 'pointer',
          fontFamily: 'TodoMainCurly, sans-serif',
          zIndex: 10,
        }}
      >
        ← Back
      </button>

      {/* 타이틀 */}
      <div style={{
        marginBottom: 40,
        textAlign: 'center',
      }}>
        <img
          src={assetUrl('/assets/launcher/launcher_kitkitschool_logo.png')}
          alt="Kitkit School"
          style={{ maxHeight: 80, objectFit: 'contain' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

      {/* 선택 버튼 2개 */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 60,
        alignItems: 'center',
        justifyContent: 'center',
      }}>

        {/* Literacy 버튼 */}
        <div
          onClick={() => navigate('/coop?cat=L')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '6px solid rgba(255,255,255,0.8)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            background: '#4a90d9',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'
            }}
          >
            <img
              src={assetUrl('/assets/mainscene/main_coop_literacy.png')}
              alt="Literacy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <span style={{
            marginTop: 16,
            fontSize: 28,
            fontFamily: 'TodoMainCurly, sans-serif',
            color: '#fff',
            textShadow: '2px 2px 6px rgba(0,0,0,0.5)',
            fontWeight: 'bold',
          }}>
            Literacy
          </span>
        </div>

        {/* Math 버튼 */}
        <div
          onClick={() => navigate('/coop?cat=M')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '6px solid rgba(255,255,255,0.8)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            background: '#e8a020',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.4)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
              ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'
            }}
          >
            <img
              src={assetUrl('/assets/mainscene/main_coop_math.png')}
              alt="Math"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <span style={{
            marginTop: 16,
            fontSize: 28,
            fontFamily: 'TodoMainCurly, sans-serif',
            color: '#fff',
            textShadow: '2px 2px 6px rgba(0,0,0,0.5)',
            fontWeight: 'bold',
          }}>
            Math
          </span>
        </div>

      </div>
    </div>
  )
}
