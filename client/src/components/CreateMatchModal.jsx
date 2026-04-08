import { useState } from 'react';
import { api } from '../api';
import { useToast } from '../contexts/ToastContext';

const SPORTS = ['Football', 'Basketball', 'Baseball', 'Tennis', 'Cricket', 'Hockey', 'Rugby', 'Volleyball'];

function toLocalDatetime(d = new Date()) {
  // Returns value suitable for datetime-local input
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateMatchModal({ onClose, onCreated }) {
  const toast = useToast();
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2h

  const [form, setForm] = useState({
    sport: 'Football',
    homeTeam: '',
    awayTeam: '',
    startTime: toLocalDatetime(now),
    endTime: toLocalDatetime(later),
    homeScore: 0,
    awayScore: 0,
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setNum = (k) => (e) => setForm(f => ({ ...f, [k]: Number(e.target.value) }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.matches.create({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime:   new Date(form.endTime).toISOString(),
      });
      onCreated(res.data);
    } catch (err) {
      toast.error(err.message || 'Failed to create match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Create Match</h2>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Sport</label>
            <select className="input" value={form.sport} onChange={set('sport')}>
              {SPORTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Home Team</label>
              <input className="input" placeholder="e.g. Arsenal" value={form.homeTeam} onChange={set('homeTeam')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Away Team</label>
              <input className="input" placeholder="e.g. Chelsea" value={form.awayTeam} onChange={set('awayTeam')} required />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Home Score</label>
              <input className="input" type="number" min={0} value={form.homeScore} onChange={setNum('homeScore')} />
            </div>
            <div className="form-group">
              <label className="form-label">Away Score</label>
              <input className="input" type="number" min={0} value={form.awayScore} onChange={setNum('awayScore')} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input className="input" type="datetime-local" value={form.startTime} onChange={set('startTime')} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input className="input" type="datetime-local" value={form.endTime} onChange={set('endTime')} required />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner spinner-sm" />&nbsp;Creating…</> : 'Create Match'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
