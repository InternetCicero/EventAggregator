import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import EventList from './pages/EventList';
import SubmitEvent from './pages/SubmitEvent';
import AdminDashboard from './pages/AdminDashboard';
import JobList from './pages/JobList';
import JobDetail from './pages/JobDetail';
import SubmitJob from './pages/SubmitJob';
import Datenschutz from './pages/Datenschutz';
import Impressum from './pages/Impressum';
import Materialien from './pages/Materialien';
import MaterialDetail from './pages/MaterialDetail';
import { browserTracker, isTrackedPath, trackingAllowed } from './lib/stats';
import './App.css';

// Besucherstatistik: Aufruf und Verweildauer, ohne Cookies (siehe Datenschutzerklärung)
function useTracking() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!trackingAllowed(navigator) || !isTrackedPath(pathname)) return undefined;
    const tracker = browserTracker();
    const onVisibility = () => (document.visibilityState === 'hidden' ? tracker.hidden() : tracker.visible());
    tracker.view(pathname);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', tracker.hidden);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', tracker.hidden);
      tracker.stop();
    };
  }, [pathname]);
}

export default function App() {
  useTracking();
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
            <NavLink to="/materialien">Materialien</NavLink>
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
          <Route path="/materialien" element={<Materialien />} />
          <Route path="/materialien/:id" element={<MaterialDetail />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>

      <footer className="app-footer">
        Events und Stellen aus manuellen Einsendungen und automatisch konfigurierten Quellen, ohne KI.{' '}
        <Link to="/datenschutz">Datenschutz</Link>
        <Link to="/impressum">Impressum</Link>
      </footer>
    </div>
  );
}
