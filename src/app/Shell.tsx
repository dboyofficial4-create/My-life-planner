import { NavLink, Outlet, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_VERSION } from '@shared/version';
import { BookOpen, CalendarDays, Dumbbell, LineChart, Compass, LogOut, MoreHorizontal, Navigation, Settings, Sparkles, Sun, Utensils, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useMe } from './App';
import { Dialog } from '@/ui/overlay';
import { NotificationBell } from './NotificationBell';
import { Button } from '@/ui/primitives';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  modules?: string[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/compass', label: 'Compass', icon: Compass },
  { to: '/fitness', label: 'Fitness & Sports', icon: Dumbbell, modules: ['fitness', 'sports'] },
  { to: '/school', label: 'School', icon: BookOpen, modules: ['school'] },
  { to: '/food', label: 'Food', icon: Utensils, modules: ['nutrition'] },
  { to: '/care', label: 'Personal Care', icon: Sparkles, modules: ['skincare', 'haircare'] },
  { to: '/progress', label: 'Progress', icon: LineChart },
];

export function Shell() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);
  const modules = me.data?.profile?.modules ?? [];
  const items = NAV.filter((n) => !n.modules || n.modules.some((m) => modules.includes(m as never)));
  const name = me.data?.profile?.displayName ?? '';
  const isDemo = me.data?.user.isDemo;
  // Detect a server still running older code (e.g. after `git pull` without restarting).
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<{ ok: boolean; apiVersion?: number }>('/health'), refetchInterval: 60_000, staleTime: 30_000 });
  const outdated = !!health.data && health.data.apiVersion !== API_VERSION;

  const logout = async () => {
    await api.post('/auth/logout');
    qc.clear();
    navigate('/welcome');
  };

  // Mobile: Today, Plan and Compass are always in the tab bar, then one module tab; the rest under "More".
  const primary = items.slice(0, 4);
  const overflow = [...items.slice(4), { to: '/settings', label: 'Settings', icon: Settings }];

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark">
            <Navigation aria-hidden />
          </span>
          Waypoint
        </div>
        <nav className="nav">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <n.icon aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <nav className="nav">
            <NavLink to="/settings">
              <Settings aria-hidden />
              Settings
            </NavLink>
          </nav>
          <div className="user-chip">
            <span className="avatar" aria-hidden>
              {name.slice(0, 1).toUpperCase() || '?'}
            </span>
            <span className="truncate grow">{name}</span>
            <NotificationBell />
            <Button variant="ghost" size="sm" iconOnly icon={LogOut} aria-label="Sign out" onClick={logout} />
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="mobile-top">
          <div className="brand">
            <span className="brand-mark">
              <Navigation aria-hidden />
            </span>
            Waypoint
          </div>
          <div className="row-sm">
            <NotificationBell />
            <Button variant="ghost" size="sm" iconOnly icon={LogOut} aria-label="Sign out" onClick={logout} />
          </div>
        </header>
        {outdated && (
          <div className="update-bar" role="alert">
            <strong>Waypoint was updated — restart it to finish.</strong> In the Command Prompt window running Waypoint, press <kbd>Ctrl</kbd>+<kbd>C</kbd> (answer <kbd>Y</kbd>), run <code>npm run dev</code>, then reload this page. Until then, some features won’t work.
          </div>
        )}
        {isDemo && (
          <div className="demo-bar" role="note">
            <span>You’re exploring with sample demo data. It’s separate from real accounts and is deleted after 24 hours.</span>
            <button className="btn btn-sm btn-secondary" onClick={logout}>
              Exit demo
            </button>
          </div>
        )}
        <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" aria-label="Main navigation">
        {primary.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <n.icon aria-hidden />
            {n.label.split(' ')[0]}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} aria-haspopup="dialog">
          <MoreHorizontal aria-hidden />
          More
        </button>
      </nav>
      <Dialog open={more} onClose={() => setMore(false)} title="More">
        <nav className="nav">
          {overflow.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={() => setMore(false)}>
              <n.icon aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </Dialog>
    </div>
  );
}
