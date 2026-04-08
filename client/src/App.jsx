import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import MatchesPage from './pages/MatchesPage';
import MatchDetail from './pages/MatchDetail';
import SubscriptionsPage from './pages/SubscriptionsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  const [page, setPage]           = useState('matches');
  const [selectedMatch, setMatch] = useState(null);
  const { loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  const handleSelectMatch = (match) => {
    setMatch(match);
    setPage('match-detail');
  };

  const handleBack = () => {
    setMatch(null);
    setPage('matches');
  };

  // Auth page replaces the whole layout
  if (page === 'auth') {
    return <AuthPage onDone={() => setPage('matches')} />;
  }

  return (
    <div className="app-layout">
      <Navbar page={page} setPage={(p) => { setMatch(null); setPage(p); }} />

      {page === 'matches' && (
        <MatchesPage onSelectMatch={handleSelectMatch} />
      )}
      {page === 'match-detail' && selectedMatch && (
        <MatchDetail match={selectedMatch} onBack={handleBack} />
      )}
      {page === 'subscriptions' && (
        <SubscriptionsPage onSelectMatch={handleSelectMatch} />
      )}
      {page === 'notifications' && (
        <NotificationsPage />
      )}
      {page === 'profile' && (
        <ProfilePage setPage={setPage} />
      )}
    </div>
  );
}
