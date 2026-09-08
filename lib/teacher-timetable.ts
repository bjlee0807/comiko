import type { Workbook, Cell } from 'exceljs';
import type { ExcelTeacher } from './excel-schedule';
import { encodeRegularLessons, type RegularLesson } from './regular-lesson-blocks';

export type TimetableTeacher = { name: string; subject: string; homeroom: string; taughtClasses: string; regularLessons: string; row: number };
export type TimetablePreview = { sheet: string; rows: TimetableTeacher[]; errors: string[] };
export const NEW_TEACHER = '__new_teacher__';
export const normalizeTeacherName = (value: string) => value.trim().replace(/\s+/g, '');
const normalize = (value: string) => value.trim().replace(/\s+/g, '');
const roomCode = (value: string) => {
  const match = normalize(value).replace(/[‐‑–—－]/g, '-').match(/^([1-3])-(0?[1-9]|10)$/);
  return match ? `${match[1]}-${Number(match[2])}` : '';
};
function cellText(cell: Cell): string {
  const v = cell.value;
  if (v instanceof Date) throw new Error(`${cell.address}: 날짜로 변환된 학급 표시는 텍스트로 바꿔 주세요.`);
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v || 'error' in v)) throw new Error(`${cell.address}: 수식·오류 셀을 값으로 바꿔 주세요.`);
  return cell.text.trim();
}

// Read the supplied two-row-per-teacher layout. No school or teacher identity is embedded.
export function parseTeacherTimetable(workbook: Workbook): TimetablePreview {
  const candidates: { sheet: Workbook['worksheets'][number]; header: number; nameCol: number; homeCol: number; lessonCols: number[] }[] = [];
  for (const sheet of workbook.worksheets) {
    for (let row = 1; row <= Math.min(20, sheet.rowCount - 1); row++) {
      const headers = Array.from({ length: Math.min(100, sheet.columnCount) }, (_, i) => normalize(sheet.getCell(row, i + 1).text));
      const nameCol = headers.findIndex(v => ['교사', '교사명', '성명', '이름'].includes(v)) + 1;
      const homeCol = headers.findIndex(v => ['담임', '담임학급', '담임반'].includes(v)) + 1;
      const weekdays = new Set(headers.filter(v => /^[월화수목금](요일)?$/.test(v)).map(v => v[0]));
      if (!nameCol || !homeCol || weekdays.size !== 5) continue;
      const lessonCols = headers.flatMap((_, i) => i + 1 > nameCol && i + 1 < homeCol && /^(?:[1-9]|1[0-2])(?:교시)?$/.test(normalize(sheet.getCell(row + 1, i + 1).text)) ? [i + 1] : []);
      if (lessonCols.length >= 5) candidates.push({ sheet, header: row, nameCol, homeCol, lessonCols });
    }
  }
  if (candidates.length !== 1) throw new Error(candidates.length ? '전체 교사 시간표가 여러 개 있습니다. 적용할 시간표 시트 한 개만 남겨 주세요.' : '양식을 확인하지 못했습니다. 교사·담임 열과 월~금 교시가 있고, 교사마다 과목/학급 두 줄로 된 전체 교사 시간표가 필요합니다.');
  const { sheet, header, nameCol, homeCol, lessonCols } = candidates[0];
  if (sheet.rowCount > 2000 || sheet.columnCount > 100) throw new Error('시간표는 2,000행, 100열 이내의 파일을 선택하세요.');
  const result: TimetablePreview = { sheet: sheet.name, rows: [], errors: [] };
  const lessonMeta = new Map<number, { weekday: number; period: number }>();
  let weekday = 0;
  for (let col = nameCol + 1; col < homeCol; col++) {
    const dayText = normalize(sheet.getCell(header, col).text);
    const foundDay = ['월', '화', '수', '목', '금'].findIndex(day => dayText.startsWith(day));
    if (foundDay >= 0) weekday = foundDay + 1;
    const period = Number(normalize(sheet.getCell(header + 1, col).text).replace(/교시$/, ''));
    if (lessonCols.includes(col) && weekday && Number.isSafeInteger(period)) lessonMeta.set(col, { weekday, period });
  }
  const names = new Set<string>();
  const homes = new Set<string>();
  for (let row = header + 2; row <= sheet.rowCount; row += 2) {
    try {
      const name = cellText(sheet.getCell(row, nameCol));
      if (!name) {
        if (lessonCols.some(col => cellText(sheet.getCell(row + 1, col))) || cellText(sheet.getCell(row, homeCol))) result.errors.push(`${row}행: 교사 이름이 없습니다.`);
        continue;
      }
      const nextName = cellText(sheet.getCell(row + 1, nameCol));
      if (nextName && normalize(nextName) !== normalize(name)) throw new Error(`${row}행: 교사마다 두 줄인지 확인하세요.`);
      if (names.has(normalizeTeacherName(name))) throw new Error(`${row}행: 교사 이름이 중복되었습니다. 동명이인은 구분 표시가 필요합니다.`);
      names.add(normalizeTeacherName(name));
      const rawHome = normalize(cellText(sheet.getCell(row, homeCol)));
      const homeroom = ['', '-', '없음', '비담임'].includes(rawHome) ? '' : roomCode(rawHome);
      if (rawHome && !['-', '없음', '비담임'].includes(rawHome) && !homeroom) throw new Error(`${row}행: 담임 학급은 1-1~3-10 또는 빈칸/없음이어야 합니다.`);
      if (homeroom && homes.has(homeroom)) throw new Error(`${row}행: ${homeroom} 담임이 중복됩니다. 시간표를 확인하세요.`);
      if (homeroom) homes.add(homeroom);
      const rooms = new Set<string>();
      const subjects = new Set<string>();
      const regularLessons: RegularLesson[] = [];
      const previousRoom = new Map<number, string>();
      for (const col of lessonCols) {
        const subject = normalize(cellText(sheet.getCell(row, col)));
        const raw = cellText(sheet.getCell(row + 1, col));
        const meta = lessonMeta.get(col);
        if (subject === '창체') { if (meta) previousRoom.delete(meta.weekday); continue; }
        if (!raw) {
          // A continuation marker adds no new class to the weekly class set.
          if (subject && !/^[─━\-→▷▶>]+$/.test(subject)) throw new Error(`${sheet.getCell(row + 1, col).address}: 과목 아래 수업 학급이 없습니다.`);
          if (meta && /^[─━\-→▷▶>]+$/.test(subject)) {
            const room = previousRoom.get(meta.weekday);
            if (room) regularLessons.push({ ...meta, room });
          }
          continue;
        }
        const room = roomCode(raw);
        if (!room) throw new Error(`${sheet.getCell(row + 1, col).address}: 수업 학급 '${raw}'을 읽지 못했습니다. 1-1~3-10 형식을 확인하세요.`);
        rooms.add(room);
        if (meta) { regularLessons.push({ ...meta, room }); previousRoom.set(meta.weekday, room); }
        if (subject && !/^[─━\-→▷▶>]+$/.test(subject)) subjects.add(subject);
      }
      const taughtClasses = [...rooms].sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]) || Number(a.split('-')[1]) - Number(b.split('-')[1])).join(',');
      result.rows.push({ name, subject: [...subjects].sort((a, b) => a.localeCompare(b, 'ko')).join(', '), homeroom, taughtClasses, regularLessons: encodeRegularLessons(regularLessons), row });
    } catch (error) { result.errors.push(error instanceof Error ? error.message : `${row}행을 읽지 못했습니다.`); }
  }
  if (!result.rows.length && !result.errors.length) result.errors.push('시간표에서 교사 정보를 찾지 못했습니다.');
  return result;
}

export async function readTeacherTimetable(file: File) {
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 .xlsx 전체 교사 시간표를 선택하세요.');
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(await file.arrayBuffer()); }
  catch { throw new Error('시간표를 읽지 못했습니다. 암호를 해제하고 .xlsx 형식으로 저장해 주세요.'); }
  return parseTeacherTimetable(workbook);
}
export function matchTimetableTeachers(current: ExcelTeacher[], rows: TimetableTeacher[]): string[] {
  return rows.map(row => {
    const found = current.filter(t => normalizeTeacherName(t.name) === normalizeTeacherName(row.name));
    return found.length === 1 ? found[0].id : found.length === 0 ? NEW_TEACHER : '';
  });
}
export function applyTeacherTimetable(current: ExcelTeacher[], preview: TimetablePreview, targets: string[], newId: () => string, defaultMax = 0): ExcelTeacher[] {
  if (preview.errors.length || targets.length !== preview.rows.length) throw new Error('시간표 오류를 먼저 수정하세요.');
  const used = new Set<string>();
  const next = current.map(t => ({ ...t }));
  let count = 0;
  preview.rows.forEach((row, i) => {
    const target = targets[i];
    if (!target) return;
    if (target === NEW_TEACHER) {
      if (next.some(t => normalizeTeacherName(t.name) === normalizeTeacherName(row.name))) throw new Error(`${row.name}: 같은 이름이 이미 있습니다. 기존 교사를 선택하세요.`);
      const id = newId();
      if (!id || next.some(t => t.id === id)) throw new Error('교사 식별자를 만들지 못했습니다. 다시 시도하세요.');
      next.push({ id, name: row.name, homeroom: row.homeroom, taughtClasses: row.taughtClasses, regularLessons: row.regularLessons, subject: row.subject, role: '교과교사', max: defaultMax, autoMax: true, unavailable: '', manualUnavailable: '' });
    } else {
      if (used.has(target)) throw new Error('여러 시간표 행을 같은 교사에게 연결할 수 없습니다.');
      const index = next.findIndex(t => t.id === target);
      if (index < 0) throw new Error('교사 명단이 바뀌었습니다. 시간표를 다시 업로드하세요.');
      used.add(target);
      next[index] = { ...next[index], name: row.name, subject: row.subject || next[index].subject, homeroom: row.homeroom, taughtClasses: row.taughtClasses, regularLessons: row.regularLessons, manualUnavailable: next[index].manualUnavailable ?? next[index].unavailable };
    }
    count++;
  });
  if (!count) throw new Error('반영할 교사를 한 명 이상 선택하세요.');
  const names = new Set<string>();
  for (const teacher of next) {
    const name = normalizeTeacherName(teacher.name);
    if (names.has(name)) throw new Error('반영 후 교사 이름이 중복됩니다. 연결 대상을 확인하세요.');
    names.add(name);
  }
  const homes = new Map<string, string>();
  for (const t of next) if (t.homeroom) {
    if (homes.has(t.homeroom)) throw new Error(`${t.homeroom} 담임이 두 명입니다. 기존 교사 설정과 연결 대상을 확인하세요.`);
    homes.set(t.homeroom, t.id);
  }
  return next;
}
