import type { ExcelSession, ExcelTeacher } from './excel-schedule';
import { examDateKey } from './exam-date';
import { NO_EXAM } from './session-grades';

export function countExamPeriods(sessions: ExcelSession[], year: number): number {
  const periods = new Set<string>();
  for (const session of sessions) {
    if (![session.grade1Subject, session.grade2Subject, session.grade3Subject].some(subject => subject?.trim() && !['자습', NO_EXAM].includes(subject.trim()))) continue;
    const date = session.date.trim();
    const raw = session.period.trim().replace(/\s+/g, '');
    if (!date || !raw) continue;
    const number = raw.match(/^(\d+)(?:교시)?$/);
    const period = number ? String(Number(number[1])) : raw;
    periods.add(examDateKey(date, year) + '::' + period);
  }
  return periods.size;
}

// Legacy and explicitly entered limits remain untouched, including zero.
export function applyDefaultMax(teachers: ExcelTeacher[], max: number): ExcelTeacher[] {
  return teachers.map(teacher => teacher.autoMax === true ? { ...teacher, max } : teacher);
}

export function setAllTeacherMax(teachers: ExcelTeacher[], max: number, autoMax: boolean): ExcelTeacher[] {
  if (!Number.isSafeInteger(max) || max < 0) throw new Error('0 이상의 정수를 입력하세요.');
  return teachers.map(teacher => ({ ...teacher, max, autoMax }));
}
