import { describe, it, expect } from 'vitest'
import { resolveGameRoute, gameRouteMap } from '../data/gameRouteMap'

describe('gameRouteMap', () => {
  describe('resolveGameRoute — regular games', () => {
    it('포팅된 게임은 ?level=N 쿼리를 붙여서 반환한다', () => {
      expect(resolveGameRoute('Counting', 3, '')).toBe('/game/counting?level=3')
    })

    it('level 1로 호출하면 ?level=1을 반환한다', () => {
      expect(resolveGameRoute('Spelling', 1, '')).toBe('/game/spelling?level=1')
    })

    it('level 값이 그대로 반영된다 (level 10)', () => {
      expect(resolveGameRoute('WordNote', 10, '')).toBe('/game/wordnote?level=10')
    })

    it('ReadingBird level 5 → /game/readingbird?level=5', () => {
      expect(resolveGameRoute('ReadingBird', 5, '')).toBe('/game/readingbird?level=5')
    })

    it('MultiplicationBoard level 2 → /game/multiplicationboard?level=2', () => {
      expect(resolveGameRoute('MultiplicationBoard', 2, '')).toBe('/game/multiplicationboard?level=2')
    })
  })

  describe('resolveGameRoute — Video / Book', () => {
    it('Video는 /video/{gameParam} 형태로 반환한다', () => {
      expect(resolveGameRoute('Video', 0, 'intro_video_01')).toBe('/video/intro_video_01')
    })

    it('Video gameParam이 다른 값이어도 경로에 그대로 반영된다', () => {
      expect(resolveGameRoute('Video', 0, 'lesson_abc')).toBe('/video/lesson_abc')
    })

    it('Book은 /book/{gameParam} 형태로 반환한다', () => {
      expect(resolveGameRoute('Book', 0, 'book_story_01')).toBe('/book/book_story_01')
    })

    it('BookWithQuiz도 /book/{gameParam} 형태로 반환한다', () => {
      expect(resolveGameRoute('BookWithQuiz', 0, 'book_quiz_02')).toBe('/book/book_quiz_02')
    })
  })

  describe('resolveGameRoute — 미포팅 게임은 null 반환', () => {
    it('BigSmall은 null을 반환한다', () => {
      expect(resolveGameRoute('BigSmall', 1, '')).toBeNull()
    })

    it('Crown은 null을 반환한다', () => {
      expect(resolveGameRoute('Crown', 1, '')).toBeNull()
    })

    it('Keypad는 null을 반환한다', () => {
      expect(resolveGameRoute('Keypad', 1, '')).toBeNull()
    })

    it('Count10은 null을 반환한다', () => {
      expect(resolveGameRoute('Count10', 1, '')).toBeNull()
    })

    it('AirShapes는 null을 반환한다', () => {
      expect(resolveGameRoute('AirShapes', 1, '')).toBeNull()
    })

    it('EqualsGreatLess는 null을 반환한다', () => {
      expect(resolveGameRoute('EqualsGreatLess', 1, '')).toBeNull()
    })

    it('100chickens는 null을 반환한다', () => {
      expect(resolveGameRoute('100chickens', 1, '')).toBeNull()
    })

    it('30puzzle은 null을 반환한다', () => {
      expect(resolveGameRoute('30puzzle', 1, '')).toBeNull()
    })
  })

  describe('resolveGameRoute — 존재하지 않는 게임 이름은 null 반환', () => {
    it('완전히 모르는 게임 이름은 null을 반환한다', () => {
      expect(resolveGameRoute('NonExistentGame', 1, '')).toBeNull()
    })

    it('빈 문자열 게임 이름은 null을 반환한다', () => {
      expect(resolveGameRoute('', 1, '')).toBeNull()
    })

    it('대소문자가 다른 게임 이름은 null을 반환한다 (대소문자 구분)', () => {
      expect(resolveGameRoute('counting', 1, '')).toBeNull()
    })
  })

  describe('gameRouteMap 구조 검증', () => {
    it('모든 미포팅 게임 키의 값은 null이다', () => {
      const nullGames = ['BigSmall', 'Crown', 'Keypad', 'Count10', 'AirShapes', 'EqualsGreatLess', '100chickens', '30puzzle']
      for (const name of nullGames) {
        expect(gameRouteMap[name]).toBeNull()
      }
    })

    it('포팅된 게임 키의 값은 /로 시작하는 문자열이다', () => {
      const portedGames = ['Counting', 'Spelling', 'ReadingBird', 'BirdPhonics', 'WordNote', 'WordWindow', 'MultiplicationBoard']
      for (const name of portedGames) {
        expect(typeof gameRouteMap[name]).toBe('string')
        expect((gameRouteMap[name] as string).startsWith('/')).toBe(true)
      }
    })
  })
})
