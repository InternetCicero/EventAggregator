import { NavLink } from 'react-router-dom';

// Reiterleiste innerhalb eines Bereichs (z. B. Events: Alle · Für dich · Hinzufügen)
export default function SectionTabs({ tabs, label }) {
  return (
    <nav className="section-tabs" aria-label={label}>
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'section-tab is-active' : 'section-tab')}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
