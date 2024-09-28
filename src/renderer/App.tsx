import { Route, MemoryRouter as Router, Routes } from 'react-router-dom';
import './App.css';
import Converter from './Converter';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Converter />} />
      </Routes>
    </Router>
  );
}
