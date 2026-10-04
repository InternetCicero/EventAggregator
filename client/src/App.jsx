import { Link, NavLink, Route, Routes } from 'react-router-dom';
import EventList from './pages/EventList';
import SubmitEvent from './pages/SubmitEvent';
import AdminDashboard from './pages/AdminDashboard';
import JobList from './pages/JobList';
import JobDetail from './pages/JobDetail';
import SubmitJob from './pages/SubmitJob';
import Datenschutz from './pages/Datenschutz';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" className="brand">
            <img className="brand-logo" src="/logo.png" alt="" width="44" height="44" />
            <span className="brand-word">Student Hub</span>
          </NavLink>
          <nav className="app-nav">
            <NavLink to="/" end>
              Events
            </NavLink>
            <NavLink to="/einreichen">Event hinzufügen</NavLink>
            <NavLink to="/jobs" end>
              Jobs & Praktika
            </NavLink>
            <NavLink to="/jobs/einreichen">Stelle einreichen</NavLink>
            <NavLink to="/admin">Admin</NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<EventList />} />
          <Route path="/einreichen" element={<SubmitEvent />} />
          <Route path="/jobs" element={<JobList />} />
          <Route path="/jobs/einreichen" element={<SubmitJob />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>

      <footer className="app-footer">
        Events und Stellen aus manuellen Einsendungen und automatisch konfigurierten Quellen, ohne KI.{' '}
        <Link to="/datenschutz">Datenschutz</Link>
      </footer>
    </div>
  );
}
