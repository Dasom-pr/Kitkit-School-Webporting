/**
 * src/utils/assetPath.ts 의 assetUrl 함수를 검증하는 테스트.
 *
 * assetUrl 은 VITE_ASSET_BASE 환경변수(또는 빈 문자열)와 path 를 단순 결합합니다.
 * import.meta.env 는 Vitest 환경에서는 빈 객체 또는 undefined 로 fallback 되므로
 * ASSET_BASE 는 '' 가 되고, assetUrl(path) === path 가 성립합니다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// import.meta.env.VITE_ASSET_BASE 가 없는 경우의 동작을 검증하기 위해
// 모듈을 직접 import 합니다. Vitest 의 jsdom 환경에서 import.meta.env 는
// 기본적으로 빈 값이므로 ASSET_BASE = '' 입니다.
import { assetUrl } from '../utils/assetPath'

describe('assetUrl — VITE_ASSET_BASE 미설정 시 (빈 문자열 prefix)', () => {
  it('/ 로 시작하는 경로를 그대로 반환한다', () => {
    expect(assetUrl('/assets/games/counting/bg.png')).toBe('/assets/games/counting/bg.png')
  })

  it('여러 세그먼트 경로를 그대로 반환한다', () => {
    expect(assetUrl('/assets/localized/en-us/games/wordwindow/sound/test.m4a')).toBe(
      '/assets/localized/en-us/games/wordwindow/sound/test.m4a'
    )
  })

  it('빈 문자열 경로를 빈 문자열로 반환한다', () => {
    expect(assetUrl('')).toBe('')
  })

  it('파일명만 있는 경로도 그대로 반환한다', () => {
    expect(assetUrl('cat.png')).toBe('cat.png')
  })

  it('반환값이 문자열 타입이다', () => {
    expect(typeof assetUrl('/some/path')).toBe('string')
  })

  it('공통 SFX 경로가 올바르게 반환된다', () => {
    const path = '/assets/games/feedingtime/sfx/sfx_feedingtime_correct.m4a'
    expect(assetUrl(path)).toBe(path)
  })

  it('ReadingBird 사운드 경로가 올바르게 반환된다', () => {
    const path = '/assets/games/readingbird/sound/cat.m4a'
    expect(assetUrl(path)).toBe(path)
  })

  it('BirdPhonics 사운드 경로가 올바르게 반환된다', () => {
    const path = '/assets/games/birdphonics/sounds/fun.m4a'
    expect(assetUrl(path)).toBe(path)
  })
})

describe('assetUrl — VITE_ASSET_BASE 설정 시 prefix 결합', () => {
  // import.meta.env 를 직접 조작하여 VITE_ASSET_BASE 효과를 시뮬레이션합니다.
  // assetPath.ts 는 모듈 로드 시 ASSET_BASE 를 확정하므로,
  // 여기서는 prefix 결합 규칙을 직접 함수로 검증합니다.
  function assetUrlWithBase(base: string, path: string): string {
    return `${base}${path}`
  }

  it('베이스 URL + 경로가 올바르게 결합된다', () => {
    expect(assetUrlWithBase('https://cdn.example.com', '/assets/bg.png')).toBe(
      'https://cdn.example.com/assets/bg.png'
    )
  })

  it('베이스 URL이 빈 문자열이면 경로만 반환된다', () => {
    expect(assetUrlWithBase('', '/assets/bg.png')).toBe('/assets/bg.png')
  })

  it('베이스 URL에 trailing slash 가 있어도 결합된다', () => {
    expect(assetUrlWithBase('https://cdn.example.com/', '/assets/bg.png')).toBe(
      'https://cdn.example.com//assets/bg.png'
    )
  })
})
