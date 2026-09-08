import type { ExcelTeacher, ExcelSession } from './excel-schedule';
import { hallwayGroups, hallwaySlotKey } from './hallway-supervision';

export type ExamData = {
  name: string;
  teachers: ExcelTeacher[];
  sessions: ExcelSession[];
  assignments: Record<string, { chief: string; assistant: string; chiefLocked?: boolean; assistantLocked?: boolean }>;
  excludeHomeroom: boolean;
};
export type ExamFile = { format: 'exam-supervision-planner'; version: 1; savedAt: string; data: ExamData };
const fail = () => { throw new Error('시험 자료의 내용이나 형식이 올바르지 않습니다. 이 앱에서 저장한 시험 자료 파일을 선택하세요.'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 300): string {
  if (typeof value !== 'string' || value.length > max) return fail();
  return value;
}
function flag(value: unknown): boolean { if (typeof value !== 'boolean') return fail(); return value; }
function id(value: unknown): string {
  const result = text(value);
  if (!result || result.includes('::') || ['__proto__', 'constructor', 'prototype'].includes(result)) return fail();
  return result;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return fail();
  return value;
}

export function readExamFile(contents: string): ExamFile {
  if (contents.length > 5 * 1024 * 1024) throw new Error('시험 자료는 5MB 이하 파일을 선택하세요.');
  let root: Record<string, unknown>;
  try { root = object(JSON.parse(contents)); } catch { return fail(); }
  if (root.format !== 'exam-supervision-planner') return fail();
  if (root.version !== 1) throw new Error('지원하지 않는 시험 자료 버전입니다. 저장한 앱의 버전을 확인하세요.');
  const savedAt = text(root.savedAt);
  if (!Number.isFinite(Date.parse(savedAt))) return fail();
  const source = object(root.data);
  const name = text(source.name, 100).trim();
  if (!name) return fail();
  const sessions = list(source.sessions, 500).map((raw) => {
    const item = object(raw);
    return { id: id(item.id), date: text(item.date), period: text(item.period), grade1Subject: text(item.grade1Subject), grade2Subject: text(item.grade2Subject), grade3Subject: text(item.grade3Subject), rooms: text(item.rooms, 10000), ...(item.singleSupervision === undefined ? {} : { singleSupervision: flag(item.singleSupervision) }) };
  });
  const sessionIds = new Set(sessions.map((session) => session.id));
  if (sessionIds.size !== sessions.length) return fail();
  const teachers = list(source.teachers, 2000).map((raw): ExcelTeacher => {
    const item = object(raw);
    const role = text(item.role) as ExcelTeacher['role'];
    if (!['교과교사', '강사', '성적담당', '비교과', '교육공무직'].includes(role) || typeof item.max !== 'number' || !Number.isSafeInteger(item.max) || item.max < 0) return fail();
    const unavailable = text(item.unavailable, 20000);
    if (unavailable.split(',').map((part) => part.trim()).filter(Boolean).some((key) => !sessionIds.has(key))) return fail();
    const extra: Partial<ExcelTeacher> = {};
    if (item.autoMax !== undefined) extra.autoMax = flag(item.autoMax);
    if (item.lowLoad !== undefined) extra.lowLoad = flag(item.lowLoad);
    if (item.needsYoungPartner !== undefined) extra.needsYoungPartner = flag(item.needsYoungPartner);
    if (item.taughtClasses !== undefined) {
      extra.taughtClasses = text(item.taughtClasses, 10000);
      if (extra.taughtClasses.split(',').map(v => v.trim()).filter(Boolean).some(v => !/^[1-3]-(?:[1-9]|10)$/.test(v))) return fail();
    }
    if (item.regularLessons !== undefined) {
      extra.regularLessons = text(item.regularLessons, 30000);
      if (extra.regularLessons.split(',').map(v => v.trim()).filter(Boolean).some(v => !/^[1-5]\|\d{1,2}\|[1-3]-(?:[1-9]|10)$/.test(v))) return fail();
    }
    if (item.manualUnavailable !== undefined) {
      extra.manualUnavailable = text(item.manualUnavailable, 20000);
      if (extra.manualUnavailable.split(',').map(v => v.trim()).filter(Boolean).some(key => !sessionIds.has(key))) return fail();
    }
    if (item.setterSubject !== undefined) extra.setterSubject = text(item.setterSubject, 100);
    if (item.setterGrade !== undefined) {
      if (![1, 2, 3].includes(Number(item.setterGrade)) || !Number.isInteger(item.setterGrade)) return fail();
      extra.setterGrade = item.setterGrade as ExcelTeacher['setterGrade'];
    }
    if (item.setterDuty !== undefined) {
      if (!['standby', 'assistant'].includes(String(item.setterDuty))) return fail();
      extra.setterDuty = item.setterDuty as ExcelTeacher['setterDuty'];
    }
    if (item.avoidTeachers !== undefined) extra.avoidTeachers = text(item.avoidTeachers, 20000);
    if (item.allowedDuty !== undefined) {
      if (!['both', 'assistant', 'none'].includes(String(item.allowedDuty))) return fail();
      extra.allowedDuty = item.allowedDuty as ExcelTeacher['allowedDuty'];
    }
    if (item.dailyMax !== undefined) {
      if (typeof item.dailyMax !== 'number' || !Number.isSafeInteger(item.dailyMax) || item.dailyMax < 0) return fail();
      extra.dailyMax = item.dailyMax;
    }
    return { ...extra, id: id(item.id), name: text(item.name), subject: text(item.subject), homeroom: text(item.homeroom), role, max: item.max, unavailable };
  });
  const teacherIds = new Set(teachers.map((teacher) => teacher.id));
  if (teacherIds.size !== teachers.length) return fail();
  const slots = new Set(sessions.flatMap((session) => [
    ...session.rooms.split(',').map((room) => room.trim()).filter(Boolean).map((room) => `${session.id}::${room}`),
    ...hallwayGroups(session).map(group => hallwaySlotKey(session.id, group.id)),
  ]));
  const entries = Object.entries(object(source.assignments));
  if (entries.length > 50000) return fail();
  const assignments = Object.fromEntries(entries.map(([key, raw]) => {
    if (!slots.has(key)) return fail();
    const item = object(raw);
    const chief = text(item.chief), assistant = text(item.assistant);
    if ([chief, assistant].some((key) => key && !teacherIds.has(key))) return fail();
    const chiefLocked = item.chiefLocked === undefined ? false : flag(item.chiefLocked);
    const assistantLocked = item.assistantLocked === undefined ? false : flag(item.assistantLocked);
    if ((chiefLocked && !chief) || (assistantLocked && !assistant)) return fail();
    return [key, { chief, assistant, chiefLocked, assistantLocked }];
  }));
  return { format: 'exam-supervision-planner', version: 1, savedAt, data: { name, teachers, sessions, assignments, excludeHomeroom: flag(source.excludeHomeroom) } };
}

export function makeExamFile(data: ExamData): string {
  // Removed exam sessions may remain in the legacy draft's unavailable list.
  const sessionIds = new Set(data.sessions.map((session) => session.id));
  const clean = { ...data, teachers: data.teachers.map((teacher) => ({ ...teacher, unavailable: teacher.unavailable.split(',').map((value) => value.trim()).filter((value) => sessionIds.has(value)).join(', '), ...(teacher.manualUnavailable !== undefined ? { manualUnavailable: teacher.manualUnavailable.split(',').map(value => value.trim()).filter(value => sessionIds.has(value)).join(', ') } : {}) })) };
  const result = JSON.stringify({ format: 'exam-supervision-planner', version: 1, savedAt: new Date().toISOString(), data: clean }, null, 2);
  readExamFile(result);
  return result;
}

export function copyForNextExam(data: ExamData, name: string): ExamData {
  if (!name.trim()) throw new Error('새 시험 이름을 입력하세요.');
  return { name: name.trim(), teachers: data.teachers.map((teacher) => ({ ...teacher, unavailable: '', ...(teacher.manualUnavailable !== undefined ? { manualUnavailable: '' } : {}) })), sessions: [], assignments: {}, excludeHomeroom: data.excludeHomeroom };
}

export function downloadExamFile(data: ExamData) {
  const contents = makeExamFile(data);
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || '시험자료'}_시험자료.json`;
  document.body.appendChild(link);
  link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
