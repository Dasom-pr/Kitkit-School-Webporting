import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// audio.onerror 핸들러가 없으면 소리 파일 로드 실패 시 게임이 멈추는 버그 검증
// 각 Engine 파일에 audio.onerror 가 포함되어 있는지 확인

const root = join(__dirname, '../../src/game')

function readEngine(path: string): string {
  return readFileSync(join(__dirname, '../../src/game', path), 'utf-8')
}

describe('audio.onerror 핸들러 존재 여부', () => {
  it('WordNoteEngine: audio.onerror 핸들러가 있어야 한다', () => {
    const src = readEngine('wordnote/WordNoteEngine.ts')
    expect(src).toContain('audio.onerror')
  })

  it('WordMatrixEngine: audio.onerror 핸들러가 있어야 한다', () => {
    const src = readEngine('wordmatrix/WordMatrixEngine.ts')
    expect(src).toContain('audio.onerror')
  })

  it('SoundTrainEngine: audio.onerror 핸들러가 있어야 한다', () => {
    const src = readEngine('soundtrain/SoundTrainEngine.ts')
    expect(src).toContain('audio.onerror')
  })

  it('WordKickerEngine: audio.onerror 핸들러가 있어야 한다', () => {
    const src = readEngine('wordkicker/WordKickerEngine.ts')
    expect(src).toContain('audio.onerror')
  })

  it('WordWindowEngine: audio.onerror 핸들러가 있어야 한다', () => {
    const src = readEngine('wordwindow/WordWindowEngine.ts')
    expect(src).toContain('audio.onerror')
  })

  it('LRComprehensionEngine: audio.onerror 핸들러가 있어야 한다', () => {
    const src = readEngine('lrcomprehension/LRComprehensionEngine.ts')
    expect(src).toContain('audio.onerror')
  })

  it('LabelingEngine: audio.onerror 핸들러가 있어야 한다', () => {
    const src = readEngine('labeling/LabelingEngine.ts')
    expect(src).toContain('audio.onerror')
  })
})
