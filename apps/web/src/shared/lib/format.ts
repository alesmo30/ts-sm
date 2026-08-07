export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} min ${remainingSeconds} s`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short' }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
