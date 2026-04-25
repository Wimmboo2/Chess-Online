import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Game from './pages/Game.jsx';
import LocalGame from './pages/LocalGame.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:roomId" element={<Game />} />
        <Route path="/local" element={<LocalGame />} />
      </Routes>
    </Router>
  );
}

export default App;
