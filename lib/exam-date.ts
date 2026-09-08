export function examYear(name: string, fallback = new Date().getFullYear()) {
  return Number(name.match(/(?:19|20|21)\d{2}/)?.[0] ?? fallback);
}
export function parseExamDate(value: string, year: number): Date | undefined {
  const clean = value.replace(/\([^)]*\)/g, '').trim();
  const full = clean.match(/^(\d{4})[-/.년]\s*(\d{1,2})[-/.월]\s*(\d{1,2})(?:일|\.)?$/);
  const short = clean.match(/^(\d{1,2})[/.-월]\s*(\d{1,2})(?:일|\.)?$/);
  if (!full && !short) return;
  const y = full ? Number(full[1]) : year;
  const m = Number(full ? full[2] : short![1]);
  const d = Number(full ? full[3] : short![2]);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : undefined;
}
export function formatExamDate(date: Date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}(${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
}
export function examDateKey(value: string, year = new Date().getFullYear()) {
  const parsed = parseExamDate(value, year);
  return parsed ? formatExamDate(parsed) : value.trim();
}
