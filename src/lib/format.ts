const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a short date. */
export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = now.getTime() - t;
  if (diff < 45_000) return 'just now';
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  if (diff < 7 * DAY) {
    const days = Math.round(diff / DAY);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "in 3 h", "in 25 min", or "overdue". */
export function formatTimeUntil(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(diff)) return '';
  if (diff <= 0) return 'now';
  if (diff < HOUR) return `in ${Math.max(1, Math.round(diff / MINUTE))} min`;
  if (diff < DAY) return `in ${Math.round(diff / HOUR)} h`;
  return `in ${Math.round(diff / DAY)} days`;
}

export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY);
}

export function spokenBloodGroup(group: string): string {
  return group.replace('+', ' positive').replace('-', ' negative');
}
