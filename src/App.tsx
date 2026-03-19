import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import LauncherPage from './pages/LauncherPage'
import GameSelectPage from './pages/GameSelectPage'
import LibraryPage from './pages/LibraryPage'
import TappingGame from './pages/TappingGame'
import BookViewerPage from './pages/BookViewerPage'
import VideoPlayerPage from './pages/VideoPlayerPage'

// Shell (launcher) pages
const CoopScenePage = lazy(() => import('./pages/CoopScenePage'))
const DaySelectPage = lazy(() => import('./pages/DaySelectPage'))
const MainScenePage = lazy(() => import('./pages/MainScenePage'))

// Lazy load game pages to keep initial bundle small
const LetterMatchingPage = lazy(() => import('./pages/games/LetterMatchingPage'))
const NumberMatchingPage = lazy(() => import('./pages/games/NumberMatchingPage'))
const FindTheMatchPage = lazy(() => import('./pages/games/FindTheMatchPage'))
const CountingPage = lazy(() => import('./pages/games/CountingPage'))
const MovingInsectsPage = lazy(() => import('./pages/games/MovingInsectsPage'))
const HundredPuzzlePage = lazy(() => import('./pages/games/HundredPuzzlePage'))
const AnimalPuzzlePage = lazy(() => import('./pages/games/AnimalPuzzlePage'))
const WoodenPuzzlesPage = lazy(() => import('./pages/games/WoodenPuzzlesPage'))
const EquationMakerPage = lazy(() => import('./pages/games/EquationMakerPage'))
const FishTankPage = lazy(() => import('./pages/games/FishTankPage'))
const SentenceMakerPage = lazy(() => import('./pages/games/SentenceMakerPage'))
const WordMachinePage = lazy(() => import('./pages/games/WordMachinePage'))
const LetterTracePage = lazy(() => import('./pages/games/LetterTracePage'))
const NumberTracePage = lazy(() => import('./pages/games/NumberTracePage'))
const WordTracePage = lazy(() => import('./pages/games/WordTracePage'))
const SpellingPage = lazy(() => import('./pages/games/SpellingPage'))
const StarFallPage = lazy(() => import('./pages/games/StarFallPage'))
const DoubleDigitPage = lazy(() => import('./pages/games/DoubleDigitPage'))
const EggQuizPage = lazy(() => import('./pages/games/EggQuizPage'))
const ComprehensionTestPage = lazy(() => import('./pages/games/ComprehensionTestPage'))
const TutorialTracePage = lazy(() => import('./pages/games/TutorialTracePage'))
const OldSpellingPage = lazy(() => import('./pages/games/OldSpellingPage'))
const DigitalQuizPage = lazy(() => import('./pages/games/DigitalQuizPage'))
const MissingNumberPage = lazy(() => import('./pages/games/MissingNumberPage'))
const AlphabetPuzzlePage2 = lazy(() => import('./pages/games/AlphabetPuzzlePage'))
const NumberPuzzlePage2 = lazy(() => import('./pages/games/NumberPuzzlePage'))
const CompMatchingPage = lazy(() => import('./pages/games/CompMatchingPage'))
const LineMatchingPage = lazy(() => import('./pages/games/LineMatchingPage'))
const WhatIsThisPage = lazy(() => import('./pages/games/WhatIsThisPage'))
const SentenceBridgePage = lazy(() => import('./pages/games/SentenceBridgePage'))
const PatternTrainPage = lazy(() => import('./pages/games/PatternTrainPage'))
const ShapeMatchingPage = lazy(() => import('./pages/games/ShapeMatchingPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

function Loading() {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#1a1a2e',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: 24,
    }}>
      Loading...
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<LauncherPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/coop" element={<CoopScenePage />} />
        <Route path="/coop/:levelID" element={<DaySelectPage />} />
        <Route path="/coop/:levelID/day/:day" element={<MainScenePage />} />
        <Route path="/games" element={<GameSelectPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/game/tapping" element={<TappingGame />} />
        <Route path="/game/lettermatching" element={<LetterMatchingPage />} />
        <Route path="/game/numbermatching" element={<NumberMatchingPage />} />
        <Route path="/game/findthematch" element={<FindTheMatchPage />} />
        <Route path="/game/counting" element={<CountingPage />} />
        <Route path="/game/movinginsects" element={<MovingInsectsPage />} />
        <Route path="/game/hundredpuzzle" element={<HundredPuzzlePage />} />
        <Route path="/game/animalpuzzle" element={<AnimalPuzzlePage />} />
        <Route path="/game/woodenpuzzles" element={<WoodenPuzzlesPage />} />
        <Route path="/game/equationmaker" element={<EquationMakerPage />} />
        <Route path="/game/fishtank" element={<FishTankPage />} />
        <Route path="/game/sentencemaker" element={<SentenceMakerPage />} />
        <Route path="/game/wordmachine" element={<WordMachinePage />} />
        <Route path="/game/lettertrace" element={<LetterTracePage />} />
        <Route path="/game/numbertrace" element={<NumberTracePage />} />
        <Route path="/game/wordtrace" element={<WordTracePage />} />
        <Route path="/game/spelling" element={<SpellingPage />} />
        <Route path="/game/starfall" element={<StarFallPage />} />
        <Route path="/game/doubledigit" element={<DoubleDigitPage />} />
        <Route path="/game/eggquiz" element={<EggQuizPage />} />
        <Route path="/game/comprehensiontest" element={<ComprehensionTestPage />} />
        <Route path="/game/tutorialtrace" element={<TutorialTracePage />} />
        <Route path="/game/oldspelling" element={<OldSpellingPage />} />
        <Route path="/game/digitalquiz" element={<DigitalQuizPage />} />
        <Route path="/game/missingnumber" element={<MissingNumberPage />} />
        <Route path="/game/alphabetpuzzle" element={<AlphabetPuzzlePage2 />} />
        <Route path="/game/numberpuzzle" element={<NumberPuzzlePage2 />} />
        <Route path="/game/compmatching" element={<CompMatchingPage />} />
        <Route path="/game/linematching" element={<LineMatchingPage />} />
        <Route path="/game/whatisthis" element={<WhatIsThisPage />} />
        <Route path="/game/sentencebridge" element={<SentenceBridgePage />} />
        <Route path="/game/patterntrain" element={<PatternTrainPage />} />
        <Route path="/game/shapematching" element={<ShapeMatchingPage />} />
        <Route path="/book/:id" element={<BookViewerPage />} />
        <Route path="/video/:id" element={<VideoPlayerPage />} />
      </Routes>
    </Suspense>
  )
}
