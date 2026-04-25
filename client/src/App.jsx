import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';
import LocalGame from './pages/LocalGame.jsx';
import ComputerGame from './pages/ComputerGame.jsx';
import ReviewGame from './pages/ReviewGame.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:roomId" element={<Game />} />
        <Route path="/local" element={<LocalGame />} />
        <Route path="/computer" element={<ComputerGame />} />
        <Route path="/review" element={<ReviewGame />} />
      </Routes>
    </Router>
  );
}

export default App;
