export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%"
  return `${Math.round(value * 100)}%`
}

export function formatProbability(value: number): string {
  if (!Number.isFinite(value)) return "0.00"
  return value.toFixed(2)
}

export function barWidth(value: number): string {
  if (!Number.isFinite(value)) return "0%"
  return `${Math.min(100, Math.max(0, value * 100))}%`
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}
