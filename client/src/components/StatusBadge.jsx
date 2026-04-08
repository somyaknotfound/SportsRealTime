import { statusLabel } from '../utils';

export function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {statusLabel(status)}
    </span>
  );
}
