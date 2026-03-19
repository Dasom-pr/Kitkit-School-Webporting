import { useNavigate } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import './CategorySelectPage.css'

export default function CategorySelectPage() {
  const navigate = useNavigate()

  return (
    <div className="cat-root">

      {/* ── 1. 하늘 배경 ── */}
      <img
        src={assetUrl('/assets/mainscene/main_bg_sky.png')}
        alt=""
        className="cat-sky"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />

      {/* ── 2. 구름 애니메이션 ── */}
      <img src={assetUrl('/assets/mainscene/cloud_day_1.png')} alt="" className="cat-cloud cat-cloud-1"
        onError={(e) => { e.currentTarget.style.display = 'none' }} />
      <img src={assetUrl('/assets/mainscene/cloud_day_2.png')} alt="" className="cat-cloud cat-cloud-2"
        onError={(e) => { e.currentTarget.style.display = 'none' }} />
      <img src={assetUrl('/assets/mainscene/cloud_day_3.png')} alt="" className="cat-cloud cat-cloud-3"
        onError={(e) => { e.currentTarget.style.display = 'none' }} />

      {/* ── 3. 오른쪽 산 ── */}
      <img
        src={assetUrl('/assets/mainscene/right_mountain.png')}
        alt=""
        className="cat-mountain"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />

      {/* ── 4. 잔디 바닥 ── */}
      <img
        src={assetUrl('/assets/mainscene/day_grass_ground.png')}
        alt=""
        className="cat-ground"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />

      {/* ── 5. Literacy 건물 버튼 (원본 X:60.51%, Y:53.78%) ── */}
      <div
        className="cat-coop cat-coop-literacy"
        onClick={() => navigate('/coop?cat=L')}
      >
        <img
          src={assetUrl('/assets/mainscene/main_coop_literacy.png')}
          alt="Literacy"
          className="cat-coop-img"
          onError={(e) => { e.currentTarget.style.background = '#4a90d9' }}
        />
        <img
          src={assetUrl('/assets/coopscene/coop_woodpanel_title_literacy.png')}
          alt="Literacy"
          className="cat-coop-label"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const span = document.createElement('span')
            span.textContent = 'Literacy'
            span.className = 'cat-coop-label-text'
            e.currentTarget.parentElement?.appendChild(span)
          }}
        />
      </div>

      {/* ── 6. Math 건물 버튼 (원본 X:81.95%, Y:53.78%) ── */}
      <div
        className="cat-coop cat-coop-math"
        onClick={() => navigate('/coop?cat=M')}
      >
        <img
          src={assetUrl('/assets/mainscene/main_coop_math.png')}
          alt="Math"
          className="cat-coop-img"
          onError={(e) => { e.currentTarget.style.background = '#e8a020' }}
        />
        <img
          src={assetUrl('/assets/coopscene/coop_woodpanel_title_math.png')}
          alt="Math"
          className="cat-coop-label"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const span = document.createElement('span')
            span.textContent = 'Math'
            span.className = 'cat-coop-label-text'
            e.currentTarget.parentElement?.appendChild(span)
          }}
        />
      </div>

      {/* ── 7. 왼쪽 나뭇잎 장식 ── */}
      <img
        src={assetUrl('/assets/mainscene/main_leaves_left.png')}
        alt=""
        className="cat-leaves cat-leaves-left"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />

      {/* ── 8. 오른쪽 나뭇잎 장식 ── */}
      <img
        src={assetUrl('/assets/mainscene/main_leaves_right.png')}
        alt=""
        className="cat-leaves cat-leaves-right"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />

      {/* ── 9. 뒤로가기 버튼 (원본 quit 버튼 위치) ── */}
      <div
        className="cat-quit"
        onClick={() => navigate('/')}
      >
        <img
          src={assetUrl('/assets/mainscene/mainscreen_exitbutton_normal.png')}
          alt="Back"
          className="cat-quit-img"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>

    </div>
  )
}
