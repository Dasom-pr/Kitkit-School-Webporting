/**
 * Maps TSV game names from curriculumdata.tsv to web route paths.
 * Ported games have their route path, unported games are null.
 */

export const gameRouteMap: Record<string, string | null> = {
  // === Literacy Games (ported) ===
  AnimalPuzzle:       '/game/animalpuzzle',
  LetterMatching:     '/game/lettermatching',
  LetterTrace:        '/game/lettertrace',
  WordMachine:        '/game/wordmachine',
  StarFall:           '/game/starfall',
  Spelling:           '/game/spelling',
  SentenceMaker:      '/game/sentencemaker',
  Comprehension:      '/game/comprehensiontest',
  WordTracing:        '/game/wordtrace',
  TutorialTrace:      '/game/tutorialtrace',

  // === Math Games (ported) ===
  NumberMatching:     '/game/numbermatching',
  FindTheMatch:       '/game/findthematch',
  Counting:           '/game/counting',
  MovingInsects:      '/game/movinginsects',
  HundredPuzzle:      '/game/hundredpuzzle',
  WoodenPuzzle:       '/game/woodenpuzzles',
  EquationMaker:      '/game/equationmaker',
  FishTank:           '/game/fishtank',
  NumberTracing:      '/game/numbertrace',
  DoubleDigit:        '/game/doubledigit',
  Tapping:            '/game/tapping',
  PatternTrain:       '/game/patterntrain',

  // === Cross-category (ported) ===
  EggQuizLiteracy:    '/game/eggquiz',
  EggQuizMath:        '/game/eggquiz',
  EggQuiz:            '/game/eggquiz',
  DigitalQuiz:        '/game/digitalquiz',
  LetterTracingCard:  '/game/lettertrace',

  // === Special content types ===
  Video:              '/video',       // + /:param
  Book:               '/book',        // + /:param
  BookWithQuiz:       '/book',        // + /:param

  // === Puzzle games (ported) ===
  AlphabetPuzzle:     '/game/alphabetpuzzle',
  NumberPuzzle:       '/game/numberpuzzle',
  SoundTrain:         null,
  WordMatrix:         null,
  WordNote:           null,
  BirdPhonics:        null,
  WordKicker:         null,
  Labeling:           null,
  WhatIsThis:         '/game/whatisthis',
  ReadingBird:        null,
  SentenceBridge:     '/game/sentencebridge',
  LRComprehension:    null,
  CompMatching:       '/game/compmatching',
  MathKicker:         null,
  MangoShop:          null,
  MissingNumber:      '/game/missingnumber',
  // NumberPuzzle: already registered above
  FeedingTime:        null,
  LineMatching:       '/game/linematching',
  ShapeMatching:      '/game/shapematching',
  BigSmall:           null,
  Crown:              null,
  Keypad:             null,
  Count10:            null,
  AirShapes:          null,
  EqualsGreatLess:    null,
  '100chickens':      null,
  '30puzzle':         null,
  OldSpelling:        '/game/oldspelling',
}

/**
 * Resolve the game route for a curriculum game entry.
 * Returns the full path with level param, or null if unported.
 */
export function resolveGameRoute(
  gameName: string,
  gameLevel: number,
  gameParam: string,
): string | null {
  const route = gameRouteMap[gameName]
  if (route === undefined || route === null) return null

  // Video and Book use gameParam as the content ID
  if (gameName === 'Video') {
    return `${route}/${gameParam}`
  }
  if (gameName === 'Book' || gameName === 'BookWithQuiz') {
    return `${route}/${gameParam}`
  }

  // Regular games: append level as query param
  return `${route}?level=${gameLevel}`
}
