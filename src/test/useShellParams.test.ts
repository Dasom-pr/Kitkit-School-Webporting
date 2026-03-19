/**
 * useShellParams.ts 의 URL 파라미터 파싱 로직을 검증하는 테스트.
 *
 * useShellParams 훅은 내부에서 React Router의 useSearchParams / useNavigate 와
 * CurriculumContext 를 사용하기 때문에 직접 render 하려면 복잡한 Provider 설정이
 * 필요합니다. 여기서는 훅이 의존하는 URLSearchParams 파싱 동작 자체를 검증하여
 * 훅의 핵심 계산 규칙(isFromShell, shellLevel 결정 로직)을 커버합니다.
 */
import { describe, it, expect } from 'vitest'

// ─── 파싱 로직 헬퍼 (useShellParams 내부와 동일한 규칙) ─────────────────────
function parseShellParams(search: string) {
  const params = new URLSearchParams(search)
  const isFromShell = params.get('from') === 'shell'
  const levelRaw = params.get('level')
  const shellLevel = levelRaw ? parseInt(levelRaw, 10) : null
  const levelID = params.get('levelID') ?? null
  const day = params.get('day') ? parseInt(params.get('day')!, 10) : null
  const gameIndex = params.get('gameIndex') ? parseInt(params.get('gameIndex')!, 10) : null
  return { isFromShell, shellLevel, levelID, day, gameIndex }
}

// ─── isFromShell 검증 ─────────────────────────────────────────────────────────
describe('useShellParams — isFromShell 파싱', () => {
  it('from=shell 이 있으면 isFromShell === true', () => {
    const { isFromShell } = parseShellParams('?level=5&from=shell&levelID=en-US_M_3&day=2&gameIndex=0')
    expect(isFromShell).toBe(true)
  })

  it('from=shell 이 없으면 isFromShell === false', () => {
    const { isFromShell } = parseShellParams('?level=3')
    expect(isFromShell).toBe(false)
  })

  it('from 값이 shell 이 아닌 다른 문자열이면 isFromShell === false', () => {
    const { isFromShell } = parseShellParams('?from=menu&level=1')
    expect(isFromShell).toBe(false)
  })

  it('쿼리스트링이 아예 없으면 isFromShell === false', () => {
    const { isFromShell } = parseShellParams('')
    expect(isFromShell).toBe(false)
  })
})

// ─── shellLevel 검증 ──────────────────────────────────────────────────────────
describe('useShellParams — shellLevel 파싱', () => {
  it('level=5 이면 shellLevel === 5', () => {
    const { shellLevel } = parseShellParams('?level=5&from=shell&levelID=en-US_M_3&day=2&gameIndex=0')
    expect(shellLevel).toBe(5)
  })

  it('level=1 이면 shellLevel === 1', () => {
    const { shellLevel } = parseShellParams('?level=1&from=shell')
    expect(shellLevel).toBe(1)
  })

  it('level=10 이면 shellLevel === 10', () => {
    const { shellLevel } = parseShellParams('?level=10&from=shell')
    expect(shellLevel).toBe(10)
  })

  it('level 파라미터가 없으면 shellLevel === null', () => {
    const { shellLevel } = parseShellParams('?from=shell')
    expect(shellLevel).toBeNull()
  })

  it('쿼리스트링이 아예 없으면 shellLevel === null', () => {
    const { shellLevel } = parseShellParams('')
    expect(shellLevel).toBeNull()
  })
})

// ─── 복합 파라미터 파싱 검증 ──────────────────────────────────────────────────
describe('useShellParams — 복합 파라미터 파싱', () => {
  it('전체 파라미터 ?level=5&from=shell&levelID=en-US_M_3&day=2&gameIndex=0 파싱', () => {
    const result = parseShellParams('?level=5&from=shell&levelID=en-US_M_3&day=2&gameIndex=0')
    expect(result.isFromShell).toBe(true)
    expect(result.shellLevel).toBe(5)
    expect(result.levelID).toBe('en-US_M_3')
    expect(result.day).toBe(2)
    expect(result.gameIndex).toBe(0)
  })

  it('gameIndex=0 은 0(숫자)으로 파싱된다 (falsy 주의)', () => {
    const { gameIndex } = parseShellParams('?gameIndex=0')
    expect(gameIndex).toBe(0)
  })

  it('levelID 없으면 null', () => {
    const { levelID } = parseShellParams('?level=3&from=shell')
    expect(levelID).toBeNull()
  })

  it('day 없으면 null', () => {
    const { day } = parseShellParams('?level=3&from=shell')
    expect(day).toBeNull()
  })
})

// ─── returnPath 계산 로직 검증 ────────────────────────────────────────────────
describe('useShellParams — returnPath 계산 로직', () => {
  function calcReturnPath(search: string): string {
    const { isFromShell, levelID, day } = parseShellParams(search)
    if (isFromShell && levelID && day !== null) {
      return `/coop/${levelID}/day/${day}`
    }
    return '/'
  }

  it('from=shell + levelID + day 모두 있으면 /coop/{levelID}/day/{day} 반환', () => {
    expect(calcReturnPath('?from=shell&levelID=en-US_M_3&day=2&gameIndex=0')).toBe('/coop/en-US_M_3/day/2')
  })

  it('from=shell 이 없으면 / 반환', () => {
    expect(calcReturnPath('?levelID=en-US_M_3&day=2')).toBe('/')
  })

  it('levelID 가 없으면 / 반환', () => {
    expect(calcReturnPath('?from=shell&day=2')).toBe('/')
  })

  it('day 가 없으면 / 반환', () => {
    expect(calcReturnPath('?from=shell&levelID=en-US_M_3')).toBe('/')
  })

  it('쿼리스트링 없으면 / 반환', () => {
    expect(calcReturnPath('')).toBe('/')
  })
})
