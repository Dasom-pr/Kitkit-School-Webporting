import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// JSON 파일을 public/data/games/ 폴더에서 파싱해 반환하는 헬퍼
function loadJson(filename: string): unknown {
  const filePath = resolve(__dirname, '../../public/data/games', filename)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

// 공통 구조 타입
interface LevelEntry {
  level: number
  problems: unknown[]
}

interface GameData {
  levels: LevelEntry[]
}

// 공통 구조 검증 헬퍼
function assertGameDataStructure(data: unknown, label: string) {
  const game = data as GameData

  it(`${label}: 최상위에 levels 배열이 있다`, () => {
    expect(Array.isArray(game.levels)).toBe(true)
    expect(game.levels.length).toBeGreaterThan(0)
  })

  it(`${label}: 각 level에 level(number)과 problems(array) 필드가 있다`, () => {
    for (const lvl of game.levels) {
      expect(typeof lvl.level).toBe('number')
      expect(Array.isArray(lvl.problems)).toBe(true)
    }
  })

  it(`${label}: 모든 level의 problems 배열이 비어있지 않다`, () => {
    for (const lvl of game.levels) {
      expect(lvl.problems.length).toBeGreaterThan(0)
    }
  })
}

// ─── readingbird.json ───────────────────────────────────────────────────────
describe('readingbird.json', () => {
  const data = loadJson('readingbird.json')
  const game = data as GameData

  assertGameDataStructure(data, 'readingbird')

  it('총 18개 level이 있다', () => {
    expect(game.levels.length).toBe(18)
  })

  it('각 problem에 word 와 sound 필드가 있다', () => {
    for (const lvl of game.levels) {
      for (const p of lvl.problems as { word: string; sound: string }[]) {
        expect(typeof p.word).toBe('string')
        expect(typeof p.sound).toBe('string')
        expect(p.word.length).toBeGreaterThan(0)
        expect(p.sound.length).toBeGreaterThan(0)
      }
    }
  })
})

// ─── birdphonics.json ────────────────────────────────────────────────────────
describe('birdphonics.json', () => {
  const data = loadJson('birdphonics.json')
  const game = data as GameData

  assertGameDataStructure(data, 'birdphonics')

  it('총 16개 level이 있다', () => {
    expect(game.levels.length).toBe(16)
  })

  it('각 problem에 blueSound, redSound, breads 필드가 있다', () => {
    for (const lvl of game.levels) {
      for (const p of lvl.problems as { blueSound: string; redSound: string; breads: unknown[] }[]) {
        expect(typeof p.blueSound).toBe('string')
        expect(typeof p.redSound).toBe('string')
        expect(Array.isArray(p.breads)).toBe(true)
        expect(p.breads.length).toBeGreaterThan(0)
      }
    }
  })
})

// ─── wordwindow.json ─────────────────────────────────────────────────────────
describe('wordwindow.json', () => {
  const data = loadJson('wordwindow.json')
  const game = data as GameData

  assertGameDataStructure(data, 'wordwindow')

  it('총 17개 level이 있다', () => {
    expect(game.levels.length).toBe(17)
  })

  it('각 problem에 sentence, examples, answer 필드가 있다', () => {
    for (const lvl of game.levels) {
      for (const p of lvl.problems as { sentence: string; examples: string[]; answer: number }[]) {
        expect(typeof p.sentence).toBe('string')
        expect(Array.isArray(p.examples)).toBe(true)
        expect(typeof p.answer).toBe('number')
      }
    }
  })

  it('[특별 검증] answer 값이 모두 0~3 범위이다 (1-based 오류 수정 검증)', () => {
    for (const lvl of game.levels) {
      for (const p of lvl.problems as { answer: number }[]) {
        expect(p.answer).toBeGreaterThanOrEqual(0)
        expect(p.answer).toBeLessThanOrEqual(3)
      }
    }
  })

  it('[특별 검증] answer가 4 이상인 값이 존재하지 않는다 (1-based 버그 없음)', () => {
    const allAnswers = game.levels.flatMap(lvl =>
      (lvl.problems as { answer: number }[]).map(p => p.answer)
    )
    const outOfRange = allAnswers.filter(a => a >= 4)
    expect(outOfRange).toHaveLength(0)
  })
})

// ─── multiplicationboard.json ────────────────────────────────────────────────
describe('multiplicationboard.json', () => {
  const data = loadJson('multiplicationboard.json')
  const game = data as GameData

  assertGameDataStructure(data, 'multiplicationboard')

  it('총 9개 level이 있다', () => {
    expect(game.levels.length).toBe(9)
  })

  it('각 problem에 multiplicand, multiplier, product 필드가 있다', () => {
    for (const lvl of game.levels) {
      for (const p of lvl.problems as { multiplicand: number; multiplier: number; product: number }[]) {
        expect(typeof p.multiplicand).toBe('number')
        expect(typeof p.multiplier).toBe('number')
        expect(typeof p.product).toBe('number')
      }
    }
  })

  it('[특별 검증] product === multiplicand * multiplier 가 모든 문제에서 성립한다', () => {
    for (const lvl of game.levels) {
      for (const p of lvl.problems as { multiplicand: number; multiplier: number; product: number }[]) {
        expect(p.product).toBe(p.multiplicand * p.multiplier)
      }
    }
  })

  it('[특별 검증] 잘못된 product가 없다 (틀린 곱셈 결과 0개)', () => {
    const allProblems = game.levels.flatMap(lvl =>
      lvl.problems as { multiplicand: number; multiplier: number; product: number }[]
    )
    const wrong = allProblems.filter(p => p.product !== p.multiplicand * p.multiplier)
    expect(wrong).toHaveLength(0)
  })
})

// ─── wordnote.json ───────────────────────────────────────────────────────────
describe('wordnote.json', () => {
  const data = loadJson('wordnote.json')
  const game = data as GameData

  assertGameDataStructure(data, 'wordnote')

  it('총 26개 level이 있다', () => {
    expect(game.levels.length).toBe(26)
  })

  it('각 problem에 word, cards, sound, image 필드가 있다', () => {
    for (const lvl of game.levels) {
      for (const p of lvl.problems as { word: string; cards: string[]; sound: string; image: string }[]) {
        expect(typeof p.word).toBe('string')
        expect(Array.isArray(p.cards)).toBe(true)
        expect(p.cards.length).toBeGreaterThan(0)
        expect(typeof p.sound).toBe('string')
        expect(typeof p.image).toBe('string')
      }
    }
  })
})
