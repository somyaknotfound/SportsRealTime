import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function ProfilePage({ setPage }) {
  const { user, logout, updateProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ username: '', email: '', avatarUrl: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      username: user.username ?? '',
      email: user.email ?? '',
      avatarUrl: user.avatarUrl ?? '',
    });
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state" style={{ marginTop: 60 }}>
          <span className="icon">👤</span>
          <h3>Not signed in</h3>
          <button className="btn btn-primary" onClick={() => setPage('auth')} style={{ marginTop: 8 }}>Sign In</button>
        </div>
      </div>
    );
  }

  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—';

  const roleDescriptions = {
    viewer:      'Can view matches and commentary. Subscribe to get real-time notifications.',
    commentator: 'Can post commentary and log structured match events on any match.',
    admin:       'Full access: create matches, post commentary, and manage all events.',
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {};
    if (form.username !== user.username) payload.username = form.username;
    if (form.email !== user.email) payload.email = form.email;
    const nextAvatar = form.avatarUrl.trim();
    const prevAvatar = user.avatarUrl ?? '';
    if (nextAvatar !== prevAvatar) payload.avatarUrl = nextAvatar;

    if (Object.keys(payload).length === 0) {
      toast.info('No changes to save.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(payload);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <h1 style={{ marginBottom: 24 }}>My Profile</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              width={64}
              height={64}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--c-accent), #0070f3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', fontWeight: 800, color: '#000',
            }}>
              {user.username[0].toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{user.username}</div>
            <div style={{ color: 'var(--c-text2)', fontSize: '0.9rem' }}>{user.email}</div>
            <div style={{ marginTop: 6 }}>
              <span className={`role-badge ${user.role}`}>{user.role}</span>
            </div>
          </div>
        </div>

        <div className="divider" />

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="pf-username">Username</label>
            <input
              id="pf-username"
              className="input"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              minLength={3}
              maxLength={50}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pf-email">Email</label>
            <input
              id="pf-email"
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pf-avatar">Avatar URL</label>
            <input
              id="pf-avatar"
              className="input"
              type="text"
              inputMode="url"
              placeholder="https://…"
              value={form.avatarUrl}
              onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--c-text3)', marginTop: 6 }}>
              Clear the field and save to remove your avatar.
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <><span className="spinner spinner-sm" />&nbsp;Saving…</> : 'Save changes'}
          </button>
        </form>

        <div className="divider" style={{ marginTop: 20 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <Row label="User ID" value={`#${user.id}`} />
          <Row label="Role" value={user.role} />
          <Row label="Permissions" value={roleDescriptions[user.role] ?? '—'} />
          <Row label="Member Since" value={createdAt} />
          <Row label="Status" value={user.isActive ? '✅ Active' : '❌ Deactivated'} />
        </div>
      </div>

      <button className="btn btn-danger" onClick={logout} style={{ width: '100%', justifyContent: 'center' }}>
        Sign Out
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ fontSize: '0.85rem', color: 'var(--c-text3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.875rem', textAlign: 'right', color: 'var(--c-text2)', flex: 1 }}>{value}</span>
    </div>
  );
}
