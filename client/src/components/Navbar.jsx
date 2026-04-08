import { useAuth } from '../contexts/AuthContext';
import { useWs } from '../contexts/WsContext';

export default function Navbar({ page, setPage }) {
  const { user, logout } = useAuth();
  const { connected } = useWs();

  return (
    <nav className="nav">
      <a className="nav-brand" href="#" onClick={() => setPage('matches')}>
        <span className="dot" />
        SportRealTime
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className={`nav-tab ${page === 'matches' ? 'active' : ''}`} onClick={() => setPage('matches')}>Matches</button>
        {user && (
          <>
            <button className={`nav-tab ${page === 'subscriptions' ? 'active' : ''}`} onClick={() => setPage('subscriptions')}>
              Subscriptions
            </button>
            <button className={`nav-tab ${page === 'notifications' ? 'active' : ''}`} onClick={() => setPage('notifications')}>
              Notifications
            </button>
          </>
        )}
      </div>

      <div className="nav-actions">
        <div className="ws-indicator">
          <span className={`ws-dot ${connected ? 'on' : ''}`} />
          {connected ? 'Live' : 'Offline'}
        </div>

        {user ? (
          <>
            <button className={`nav-tab ${page === 'profile' ? 'active' : ''}`} onClick={() => setPage('profile')} style={{ marginLeft: 6 }}>
              <span className="role-badge" style={{ marginRight: 6, display: 'inline-block' }}>{user.role}</span>
              {user.username}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={logout}>Logout</button>
          </>
        ) : (
          <button className="btn btn-sm btn-primary" onClick={() => setPage('auth')}>Sign In</button>
        )}
      </div>
    </nav>
  );
}
