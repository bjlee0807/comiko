import type { ExcelSession, ExcelTeacher } from './excel-schedule';
import { parseExamDate } from './exam-date';
import { gradeParticipates } from './session-grades';

export type RegularLesson = { weekday: number; period: number; room: string };

export function encodeRegularLessons(lessons: RegularLesson[]): string {
  return lessons.map(lesson => `${lesson.weekday}|${lesson.period}|${lesson.room}`).join(',');
}

export function parseRegularLessons(value = ''): RegularLesson[] {
  return value.split(',').map(entry => {
    const match = entry.trim().match(/^([1-5])\|(\d{1,2})\|([1-3])-(10|[1-9])$/);
    return match ? { weekday: Number(match[1]), period: Number(match[2]), room: `${match[3]}-${Number(match[4])}` } : undefined;
  }).filter((lesson): lesson is RegularLesson => Boolean(lesson));
}

const periodNumber = (value: string) => Number(value.trim().replace(/교시$/, ''));

export function lastExamChiefBlocked(teacher: ExcelTeacher, session: ExcelSession, sessions: ExcelSession[], year: number): boolean {
  if (!teacher.homeroom || !gradeParticipates(session, Number(teacher.homeroom[0]))) return false;
  const date = parseExamDate(session.date, year);
  const period = periodNumber(session.period);
  if (!date || !Number.isSafeInteger(period)) return false;
  const sameDayPeriods = sessions.filter(other => {
    const otherDate = parseExamDate(other.date, year);
    return otherDate && otherDate.getFullYear() === date.getFullYear() && otherDate.getMonth() === date.getMonth() && otherDate.getDate() === date.getDate();
  }).map(other => periodNumber(other.period)).filter(Number.isSafeInteger);
  if (!sameDayPeriods.length || period !== Math.max(...sameDayPeriods)) return false;
  return parseRegularLessons(teacher.regularLessons).some(lesson =>
    lesson.weekday === date.getDay() && lesson.period === period + 1 && !gradeParticipates(session, Number(lesson.room[0]))
  );
}

export function regularLessonBlockedSessionIds(teacher: ExcelTeacher, sessions: ExcelSession[], year: number): string[] {
  const lessons = parseRegularLessons(teacher.regularLessons);
  if (!lessons.length) return [];
  return sessions.filter(session => {
    const date = parseExamDate(session.date, year);
    const period = periodNumber(session.period);
    if (!date || date.getDay() < 1 || date.getDay() > 5 || !Number.isSafeInteger(period)) return false;
    return lessons.some(lesson => lesson.weekday === date.getDay() && lesson.period === period && !gradeParticipates(session, Number(lesson.room[0])));
  }).map(session => session.id);
}

export function applyRegularLessonBlocks(teachers: ExcelTeacher[], sessions: ExcelSession[], year: number): ExcelTeacher[] {
  return teachers.map(teacher => {
    const manual = (teacher.manualUnavailable ?? teacher.unavailable).split(',').map(value => value.trim()).filter(Boolean);
    const automatic = regularLessonBlockedSessionIds(teacher, sessions, year);
    return { ...teacher, unavailable: [...new Set([...manual, ...automatic])].join(', ') };
  });
}
