import { NavLink, Route, Routes } from 'react-router-dom';
import EventList from './pages/EventList';
import SubmitEvent from './pages/SubmitEvent';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark">EA</span>
            <span className="brand-word">EventAggregator</span>
          </NavLink>
          <nav className="app-nav">
            <NavLink to="/" end>
              Übersicht
            </NavLink>
            <NavLink to="/einreichen">Event hinzufügen</NavLink>
            <NavLink to="/admin">Admin</NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<EventList />} />
          <Route path="/einreichen" element={<SubmitEvent />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>

      <footer className="app-footer">
        Aggregiert Events aus manuellen Einsendungen und automatisch konfigurierten Quellen — ohne KI, ohne API-Key.
      </footer>
    </div>
  );
}
