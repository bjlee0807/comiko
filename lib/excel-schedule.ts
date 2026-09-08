import { activeRooms, NO_EXAM } from './session-grades';
import { officeStandbyTeachers } from './setter-rules';
import { hallwayGroups, hallwaySlotKey } from './hallway-supervision';
import type { Cell, Workbook, Worksheet } from 'exceljs';

import type { TeacherRules } from './school-rules';

export type ExcelTeacher = TeacherRules & {
  id: string;
  name: string;
  subject: string;
  homeroom: string;
  role: '교과교사' | '강사' | '성적담당' | '비교과' | '교육공무직';
  max: number;
  autoMax?: boolean;
  unavailable: string;
};

export type ExcelSession = {
  id: string;
  date: string;
  period: string;
  grade1Subject: string;
  grade2Subject: string;
  grade3Subject: string;
  rooms: string;
  singleSupervision?: boolean;
};

export type ExcelAssignments = Record<string, { chief: string; assistant: string }>;

function text(cell: Cell) {
  try {
    return cell.text.replace(/\r?\n/g, '').trim();
  } catch {
    const value = cell.value;
    if (typeof value === 'string' || typeof value === 'number') return String(value).replace(/\r?\n/g, '').trim();
    return '';
  }
}

function compact(cell: Cell) {
  return text(cell).replace(/\s+/g, '');
}

function isYellow(cell: Cell) {
  if (cell.fill.type !== 'pattern') return false;
  return cell.fill.fgColor?.argb?.toUpperCase() === 'FFFFFF00';
}

function isDiagonal(cell: Cell) {
  return Boolean(cell.border?.diagonal?.up || cell.border?.diagonal?.down);
}

function normalizeRoom(value: string) {
  return value.replace(/^부/, '').replace(/\s+/g, '').trim();
}

function subjectForRoom(session: ExcelSession, room: string) {
  if (room.startsWith('1-')) return session.grade1Subject;
  if (room.startsWith('2-')) return session.grade2Subject;
  if (room.startsWith('3-')) return session.grade3Subject;
  return '특별실';
}

const COLORS = {
  header: 'FF145A4A',
  chief: 'FFFFC000',
  assistant: 'FFDCE6F1',
  subject: 'FFFFFF00',
  study: 'FFC6E0B4',
  grid: 'FF7A847F',
  white: 'FFFFFFFF',
};

function roomsOf(session: ExcelSession) {
  const order = (room: string) => {
    const match = room.match(/^([1-3])-(\d+)$/);
    return match ? Number(match[1]) * 100 + Number(match[2]) : 1000;
  };
  return activeRooms(session).sort((a, b) => order(a) - order(b) || a.localeCompare(b, 'ko'));
}

function unavailableSet(teacher: ExcelTeacher) {
  return new Set(teacher.unavailable.split(',').map((value) => value.trim()).filter(Boolean));
}

function teachesSession(teacher: ExcelTeacher, session: ExcelSession) {
  const subjects = teacher.subject.split(/[,/]/).map((value) => value.trim()).filter(Boolean);
  return subjects.some((subject) => subject !== '자습' && subject !== NO_EXAM && (subject === session.grade1Subject || subject === session.grade2Subject || subject === session.grade3Subject));
}

function dutyForTeacher(teacher: ExcelTeacher, session: ExcelSession, assignments: ExcelAssignments, teachers: ExcelTeacher[]) {
  if (officeStandbyTeachers(session, teachers).some(item => item.id === teacher.id)) return { duty: 'standby' as const, room: '교무실', study: false };
  const teacherId = teacher.id;
  for (const room of roomsOf(session)) {
    const assignment = assignments[`${session.id}::${room}`] ?? { chief: '', assistant: '' };
    if (assignment.chief === teacherId) return { duty: 'chief' as const, room, study: subjectForRoom(session, room) === '자습' };
    if (assignment.assistant === teacherId) return { duty: 'assistant' as const, room, study: false };
  }
  for (const group of hallwayGroups(session)) {
    if (assignments[hallwaySlotKey(session.id, group.id)]?.chief === teacherId) return { duty: 'hallway' as const, room: group.label, study: false };
  }
  return null;
}

function countsForTeacher(teacher: ExcelTeacher, sessions: ExcelSession[], assignments: ExcelAssignments, teachers: ExcelTeacher[]) {
  const teacherId = teacher.id;
  let chief = 0;
  let assistant = 0;
  let standby = 0;
  let hallway = 0;
  sessions.forEach((session) => { if (officeStandbyTeachers(session, teachers).some(item => item.id === teacherId)) standby += 1; roomsOf(session).forEach((room) => {
    const assignment = assignments[`${session.id}::${room}`] ?? { chief: '', assistant: '' };
    if (assignment.chief === teacherId) chief += 1;
    if (subjectForRoom(session, room) !== '자습' && assignment.assistant === teacherId) assistant += 1;
  }); hallwayGroups(session).forEach(group => { if (assignments[hallwaySlotKey(session.id, group.id)]?.chief === teacherId) hallway += 1; }); });
  return { chief, assistant, hallway, standby, total: chief + assistant + hallway + standby };
}

function gridCell(cell: Cell, bold = false) {
  const existingDiagonal = cell.border?.diagonal;
  cell.font = { name: '맑은 고딕', size: 9, bold };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.grid } },
    left: { style: 'thin', color: { argb: COLORS.grid } },
    bottom: { style: 'thin', color: { argb: COLORS.grid } },
    right: { style: 'thin', color: { argb: COLORS.grid } },
    ...(existingDiagonal ? { diagonal: existingDiagonal } : {}),
  };
}

function fill(cell: Cell, color: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function diagonal(cell: Cell) {
  cell.border = {
    ...cell.border,
    diagonal: { style: 'thin', color: { argb: 'FF6B7280' }, up: false, down: true },
  };
}

function safeSheetName(value: string, used: Set<string>) {
  const base = (value || '날짜 미정').replace(/[\\/*?:[\]]/g, '.').replace(/[()]/g, '').slice(0, 27) || '날짜 미정';
  let name = base;
  let suffix = 2;
  while (used.has(name)) name = `${base.slice(0, 27)}_${suffix++}`;
  used.add(name);
  return name;
}

function styleRange(sheet: Worksheet, fromRow: number, toRow: number, fromColumn: number, toColumn: number) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let column = fromColumn; column <= toColumn; column += 1) gridCell(sheet.getCell(row, column));
  }
}

function addLegend(sheet: Worksheet, row: number) {
  const items = [
    ['정감독', COLORS.chief], ['부감독', COLORS.assistant], ['복도감독', 'FFE8D9F2'], ['자습감독', COLORS.study], ['시험 교과목 교사', COLORS.subject],
  ];
  items.forEach(([label, color], index) => {
    const marker = sheet.getCell(row, 1 + index * 2);
    marker.value = '';
    gridCell(marker);
    fill(marker, color);
    const caption = sheet.getCell(row, 2 + index * 2);
    caption.value = label;
    gridCell(caption);
  });
  const slash = sheet.getCell(row + 1, 1);
  gridCell(slash);
  diagonal(slash);
  sheet.getCell(row + 1, 2).value = '감독 제외 시간';
  gridCell(sheet.getCell(row + 1, 2));
}

function buildTotalSheet(workbook: Workbook, teachers: ExcelTeacher[], sessions: ExcelSession[], assignments: ExcelAssignments) {
  const teacherColumnStart = 6;
  const sheet = workbook.addWorksheet('토탈', { views: [{ state: 'frozen', xSplit: 5, ySplit: 3 }] });
  const groups = Array.from({ length: Math.ceil(teachers.length / 22) }, (_, index) => teachers.slice(index * 22, index * 22 + 22));
  const blockHeight = sessions.length + 7;
  groups.forEach((group, groupIndex) => {
    const top = 1 + groupIndex * blockHeight;
    const nameRow = top + 2;
    const totalRow = nameRow + sessions.length + 1;
    sheet.getCell(top, 2).value = '순번';
    sheet.getCell(top + 1, 2).value = '담임';
    sheet.getCell(nameRow, 1).value = '날짜';
    sheet.getCell(nameRow, 2).value = '이름';
    sheet.getCell(nameRow, 3).value = '1학년';
    sheet.getCell(nameRow, 4).value = '2학년';
    sheet.getCell(nameRow, 5).value = '3학년';
    group.forEach((teacher, index) => {
      const column = index + teacherColumnStart;
      sheet.getCell(top, column).value = groupIndex * 22 + index + 1;
      sheet.getCell(top + 1, column).value = teacher.homeroom;
      sheet.getCell(nameRow, column).value = teacher.name;
    });
    sessions.forEach((session, sessionIndex) => {
      const row = nameRow + sessionIndex + 1;
      sheet.getCell(row, 1).value = session.date;
      sheet.getCell(row, 2).value = session.period;
      sheet.getCell(row, 3).value = session.grade1Subject;
      sheet.getCell(row, 4).value = session.grade2Subject;
      sheet.getCell(row, 5).value = session.grade3Subject;
      group.forEach((teacher, index) => {
        const cell = sheet.getCell(row, index + teacherColumnStart);
        const duty = dutyForTeacher(teacher, session, assignments, teachers);
        if (duty) {
          cell.value = duty.duty === 'standby' ? '교무실 대기' : duty.duty === 'assistant' ? `부${duty.room}` : duty.duty === 'hallway' ? `복도 ${duty.room}` : duty.room;
          fill(cell, duty.duty === 'standby' ? COLORS.subject : duty.duty === 'assistant' ? COLORS.assistant : duty.duty === 'hallway' ? 'FFE8D9F2' : duty.study ? COLORS.study : COLORS.chief);
        } else if (unavailableSet(teacher).has(session.id)) {
          diagonal(cell);
        } else if (teachesSession(teacher, session)) {
          fill(cell, COLORS.subject);
        }
      });
    });
    sheet.getCell(totalRow, 1).value = '총 계';
    sheet.getCell(totalRow + 1, 1).value = '부감독';
    sheet.getCell(totalRow + 2, 1).value = '복도감독';
    group.forEach((teacher, index) => {
      const counts = countsForTeacher(teacher, sessions, assignments, teachers);
      sheet.getCell(totalRow, index + teacherColumnStart).value = counts.total;
      sheet.getCell(totalRow + 1, index + teacherColumnStart).value = counts.assistant;
      sheet.getCell(totalRow + 2, index + teacherColumnStart).value = counts.hallway;
    });
    styleRange(sheet, top, totalRow + 2, 1, group.length + 5);
    for (let column = 1; column <= group.length + 5; column += 1) {
      fill(sheet.getCell(nameRow, column), COLORS.header);
      sheet.getCell(nameRow, column).font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: COLORS.white } };
    }
    sheet.getRow(nameRow).height = 28;
  });
  sheet.getColumn(1).width = 13;
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 11;
  sheet.getColumn(4).width = 11;
  sheet.getColumn(5).width = 11;
  for (let column = teacherColumnStart; column <= Math.min(27, teachers.length + 5); column += 1) sheet.getColumn(column).width = 11;
  addLegend(sheet, groups.length * blockHeight + 1);
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .2, right: .2, top: .35, bottom: .35, header: .15, footer: .15 } };
}

function buildDailySheets(workbook: Workbook, teachers: ExcelTeacher[], sessions: ExcelSession[], assignments: ExcelAssignments) {
  const teacherColumnStart = 6;
  const dates = [...new Set(sessions.map((session) => session.date))];
  const used = new Set<string>(['토탈', '감독 목록', '교사별 집계']);
  dates.forEach((date) => {
    const dateSessions = sessions.filter((session) => session.date === date);
    const sheet = workbook.addWorksheet(safeSheetName(date, used));
    const groups = Array.from({ length: Math.ceil(teachers.length / 22) }, (_, index) => teachers.slice(index * 22, index * 22 + 22));
    const blockHeight = dateSessions.length * 4 + 6;
    groups.forEach((group, groupIndex) => {
      const top = 1 + groupIndex * blockHeight;
      const nameRow = top + 2;
      const lastColumn = group.length + 5;
      sheet.mergeCells(top, 1, top, lastColumn);
      const title = sheet.getCell(top, 1);
      title.value = `${date} 시험 감독 명단${groups.length > 1 ? ` (${groupIndex + 1})` : ''}`;
      title.font = { name: '맑은 고딕', size: 15, bold: true, color: { argb: 'FF173F35' } };
      title.alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(top + 1, 1).value = '순번';
      sheet.getCell(top + 1, 2).value = '담임';
      sheet.getCell(nameRow, 1).value = '날짜';
      sheet.getCell(nameRow, 2).value = '1학년';
      sheet.getCell(nameRow, 3).value = '2학년';
      sheet.getCell(nameRow, 4).value = '3학년';
      sheet.getCell(nameRow, 5).value = '구분';
      group.forEach((teacher, index) => {
        sheet.getCell(top + 1, index + teacherColumnStart).value = teacher.homeroom || groupIndex * 22 + index + 1;
        sheet.getCell(nameRow, index + teacherColumnStart).value = teacher.name;
      });
      dateSessions.forEach((session, sessionIndex) => {
        const firstRow = nameRow + 1 + sessionIndex * 4;
        sheet.getCell(firstRow, 1).value = session.date;
        sheet.getCell(firstRow, 2).value = `${session.period} (${session.grade1Subject})`;
        sheet.getCell(firstRow, 3).value = `${session.period} (${session.grade2Subject})`;
        sheet.getCell(firstRow, 4).value = `${session.period} (${session.grade3Subject})`;
        sheet.getCell(firstRow, 5).value = '정감독';
        sheet.getCell(firstRow + 1, 5).value = '부감독';
        sheet.getCell(firstRow + 2, 5).value = '자습감독';
        sheet.getCell(firstRow + 3, 5).value = '복도감독';
        group.forEach((teacher, index) => {
          const column = index + teacherColumnStart;
          const duty = dutyForTeacher(teacher, session, assignments, teachers);
          const cells = [sheet.getCell(firstRow, column), sheet.getCell(firstRow + 1, column), sheet.getCell(firstRow + 2, column), sheet.getCell(firstRow + 3, column)];
          if (duty) {
            const target = duty.duty === 'assistant' ? cells[1] : duty.duty === 'hallway' ? cells[3] : duty.study ? cells[2] : cells[0];
            target.value = duty.duty === 'standby' ? '교무실 대기' : duty.room;
            fill(target, duty.duty === 'standby' ? COLORS.subject : duty.duty === 'assistant' ? COLORS.assistant : duty.duty === 'hallway' ? 'FFE8D9F2' : duty.study ? COLORS.study : COLORS.chief);
          } else if (unavailableSet(teacher).has(session.id)) {
            cells.forEach(diagonal);
          } else if (teachesSession(teacher, session)) {
            cells.forEach((cell) => fill(cell, COLORS.subject));
          }
        });
      });
      const totalRow = nameRow + dateSessions.length * 4 + 1;
      sheet.getCell(totalRow, 1).value = '총 계';
      group.forEach((teacher, index) => { sheet.getCell(totalRow, index + teacherColumnStart).value = countsForTeacher(teacher, dateSessions, assignments, teachers).total; });
      styleRange(sheet, top + 1, totalRow, 1, lastColumn);
      for (let column = 1; column <= lastColumn; column += 1) {
        fill(sheet.getCell(nameRow, column), COLORS.header);
        sheet.getCell(nameRow, column).font = { name: '맑은 고딕', size: 9, bold: true, color: { argb: COLORS.white } };
      }
    });
    sheet.getColumn(1).width = 13;
    sheet.getColumn(2).width = 16;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 11;
    for (let column = teacherColumnStart; column <= Math.min(27, teachers.length + 5); column += 1) sheet.getColumn(column).width = 11;
    addLegend(sheet, groups.length * blockHeight + 1);
    sheet.views = [{ state: 'frozen', xSplit: 5, ySplit: 3 }];
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .2, right: .2, top: .35, bottom: .35, header: .15, footer: .15 } };
  });
}

function findTotalRow(sheet: Worksheet, nameRow: number) {
  for (let row = nameRow + 1; row <= Math.min(sheet.rowCount, nameRow + 12); row += 1) {
    if (compact(sheet.getCell(row, 1)) === '총계' || compact(sheet.getCell(row, 2)) === '총계') return row;
  }
  return 0;
}

export async function importScheduleWorkbook(file: File) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer() as never);
  const sheet = workbook.getWorksheet('토탈') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('읽을 수 있는 시트가 없습니다.');

  const nameRows: number[] = [];
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    if (text(sheet.getCell(row, 1)) === '날짜' && text(sheet.getCell(row, 2)) === '이름') nameRows.push(row);
  }
  if (!nameRows.length) throw new Error('기존 감독표의 「토탈」 형식을 찾지 못했습니다.');

  const firstNameRow = nameRows[0];
  const hasGrade1 = text(sheet.getCell(firstNameRow, 3)) === '1학년';
  const grade1Column = hasGrade1 ? 3 : 0;
  const grade2Column = hasGrade1 ? 4 : 3;
  const grade3Column = hasGrade1 ? 5 : 4;
  const teacherColumnStart = hasGrade1 ? 6 : 5;
  const sessionSourceRows: number[] = [];
  let lastDate = '';
  for (let row = firstNameRow + 1; row <= sheet.rowCount; row += 1) {
    if (compact(sheet.getCell(row, 1)) === '총계' || compact(sheet.getCell(row, 2)) === '총계') break;
    const period = text(sheet.getCell(row, 2));
    if (period) sessionSourceRows.push(row);
  }

  const teacherRecords: Array<{ teacher: ExcelTeacher; nameRow: number; column: number }> = [];
  nameRows.forEach((nameRow, groupIndex) => {
    const totalRow = findTotalRow(sheet, nameRow);
    for (let column = teacherColumnStart; column <= sheet.columnCount; column += 1) {
      const name = text(sheet.getCell(nameRow, column));
      if (!name) continue;
      const subjects = new Set<string>();
      const unavailable: string[] = [];
      sessionSourceRows.forEach((sourceRow, sessionIndex) => {
        const cell = sheet.getCell(nameRow + (sourceRow - firstNameRow), column);
        if (isYellow(cell)) {
          const grade1 = grade1Column ? text(sheet.getCell(sourceRow, grade1Column)) : '';
          const grade2 = text(sheet.getCell(sourceRow, grade2Column));
          const grade3 = text(sheet.getCell(sourceRow, grade3Column));
          if (grade1 && grade1 !== '자습' && grade1 !== NO_EXAM) subjects.add(grade1);
          if (grade2 && grade2 !== '자습' && grade2 !== NO_EXAM) subjects.add(grade2);
          if (grade3 && grade3 !== '자습' && grade3 !== NO_EXAM) subjects.add(grade3);
        }
        if (isDiagonal(cell)) unavailable.push(`s${sessionIndex + 1}`);
      });
      const importedTotal = totalRow ? Number(sheet.getCell(totalRow, column).value ?? 0) : 0;
      teacherRecords.push({
        nameRow,
        column,
        teacher: {
          id: `import-${groupIndex + 1}-${column}`,
          name,
          subject: [...subjects].join(', '),
          homeroom: text(sheet.getCell(nameRow - 1, column)),
          role: '교과교사',
          max: Number.isFinite(importedTotal) ? importedTotal : sessionSourceRows.length,
          unavailable: unavailable.join(', '),
        },
      });
    }
  });

  const sessions: ExcelSession[] = sessionSourceRows.map((sourceRow, sessionIndex) => {
    const dateValue = text(sheet.getCell(sourceRow, 1));
    if (dateValue) lastDate = dateValue;
    const rooms: string[] = [];
    nameRows.forEach((nameRow) => {
      for (let column = teacherColumnStart; column <= sheet.columnCount; column += 1) {
        if (!text(sheet.getCell(nameRow, column))) continue;
        const raw = text(sheet.getCell(nameRow + (sourceRow - firstNameRow), column));
        if (!raw || raw === '교무실 대기' || raw.startsWith('복도 ')) continue;
        const room = normalizeRoom(raw);
        if (room && !rooms.includes(room)) rooms.push(room);
      }
    });
    const singleSupervision = teacherRecords.some(({ nameRow, column }) => text(sheet.getCell(nameRow + (sourceRow - firstNameRow), column)).startsWith('복도 '));
    return {
      id: `s${sessionIndex + 1}`,
      date: lastDate,
      period: text(sheet.getCell(sourceRow, 2)),
      grade1Subject: grade1Column ? text(sheet.getCell(sourceRow, grade1Column)) || NO_EXAM : NO_EXAM,
      grade2Subject: text(sheet.getCell(sourceRow, grade2Column)) || NO_EXAM,
      grade3Subject: text(sheet.getCell(sourceRow, grade3Column)) || NO_EXAM,
      rooms: rooms.join(', '),
      ...(singleSupervision ? { singleSupervision: true } : {}),
    };
  });

  const assignments: ExcelAssignments = {};
  sessions.forEach((session) => {
    roomsOf(session).forEach((room) => { assignments[`${session.id}::${room}`] = { chief: '', assistant: '' }; });
    hallwayGroups(session).forEach(group => { assignments[hallwaySlotKey(session.id, group.id)] = { chief: '', assistant: '' }; });
  });
  teacherRecords.forEach(({ teacher, nameRow, column }) => {
    sessionSourceRows.forEach((sourceRow, sessionIndex) => {
      const raw = text(sheet.getCell(nameRow + (sourceRow - firstNameRow), column));
      if (!raw) return;
      if (raw === '교무실 대기') return;
      if (raw.startsWith('복도 ')) {
        const session = sessions[sessionIndex];
        const normalized = raw.slice(3).replace(/\s+/g, '');
        const group = hallwayGroups(session).find(item => item.label.replace(/\s+/g, '') === normalized);
        if (group) assignments[hallwaySlotKey(session.id, group.id)].chief = teacher.id;
        return;
      }
      const room = normalizeRoom(raw);
      const key = `s${sessionIndex + 1}::${room}`;
      if (!assignments[key]) return;
      if (raw.startsWith('부')) assignments[key].assistant = teacher.id;
      else assignments[key].chief = teacher.id;
    });
  });

  return { teachers: teacherRecords.map((record) => record.teacher), sessions, assignments };
}

export async function createScheduleWorkbookBuffer(
  teachers: ExcelTeacher[],
  sessions: ExcelSession[],
  assignments: ExcelAssignments,
) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '시험감독 편성실';
  workbook.created = new Date();

  buildTotalSheet(workbook, teachers, sessions, assignments);
  buildDailySheets(workbook, teachers, sessions, assignments);

  const schedule = workbook.addWorksheet('감독 목록', { views: [{ state: 'frozen', ySplit: 3 }] });
  schedule.mergeCells('A1:I1');
  schedule.getCell('A1').value = '시험 감독 명단';
  schedule.getCell('A1').font = { name: '맑은 고딕', size: 18, bold: true, color: { argb: 'FF173F35' } };
  schedule.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  schedule.getRow(1).height = 34;
  schedule.getRow(3).values = ['날짜', '교시', '1학년 과목', '2학년 과목', '3학년 과목', '고사실', '정감독 / 자습감독', '부감독', '복도감독'];
  schedule.getRow(3).font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } };
  schedule.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF145A4A' } };
  schedule.getRow(3).alignment = { horizontal: 'center', vertical: 'middle' };
  schedule.columns = [
    { key: 'date', width: 14 }, { key: 'period', width: 12 }, { key: 'g1', width: 14 },
    { key: 'g2', width: 14 }, { key: 'g3', width: 14 }, { key: 'room', width: 15 }, { key: 'chief', width: 16 }, { key: 'assistant', width: 16 }, { key: 'hallway', width: 18 },
  ];

  let rowIndex = 4;
  sessions.forEach((session) => {
    const rooms = roomsOf(session);
    rooms.forEach((room) => {
      const assignment = assignments[`${session.id}::${room}`] ?? { chief: '', assistant: '' };
      const isStudy = subjectForRoom(session, room) === '자습';
      const row = schedule.getRow(rowIndex);
      row.values = [
        session.date, session.period, session.grade1Subject, session.grade2Subject, session.grade3Subject, room,
        teachers.find((teacher) => teacher.id === assignment.chief)?.name ?? '',
        isStudy ? '' : teachers.find((teacher) => teacher.id === assignment.assistant)?.name ?? '',
      ];
      row.font = { name: '맑은 고딕', size: 10 };
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isStudy ? 'FFDDEED1' : 'FFFFE3A1' } };
      row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9F7' } };
      row.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFD7DED9' } } }; });
      rowIndex += 1;
    });
    hallwayGroups(session).forEach(group => {
      const row = schedule.getRow(rowIndex);
      row.values = [session.date, session.period, session.grade1Subject, session.grade2Subject, session.grade3Subject, group.label, '', '', teachers.find(teacher => teacher.id === assignments[hallwaySlotKey(session.id, group.id)]?.chief)?.name ?? ''];
      row.font = { name: '맑은 고딕', size: 10 };
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8D9F2' } };
      row.eachCell(cell => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFD7DED9' } } }; });
      rowIndex += 1;
    });
  });
  schedule.autoFilter = { from: 'A3', to: `I${Math.max(3, rowIndex - 1)}` };
  schedule.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .25, right: .25, top: .4, bottom: .4, header: .2, footer: .2 } };

  const summary = workbook.addWorksheet('교사별 집계', { views: [{ state: 'frozen', ySplit: 2 }] });
  summary.mergeCells('A1:K1');
  summary.getCell('A1').value = '교사별 감독 횟수';
  summary.getCell('A1').font = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF173F35' } };
  summary.getCell('A1').alignment = { horizontal: 'center' };
  summary.getRow(2).values = ['이름', '담당 과목', '담임', '구분', '감독 상한', '정감독', '부감독', '복도감독', '교무실 대기', '총계', '감독 불가'];
  summary.getRow(2).font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF145A4A' } };
  summary.columns = [18, 16, 12, 14, 12, 12, 12, 12, 14, 12, 20].map((width) => ({ width }));
  teachers.forEach((teacher, index) => {
    const counts = countsForTeacher(teacher, sessions, assignments, teachers);
    const row = summary.getRow(index + 3);
    row.values = [teacher.name, teacher.subject, teacher.homeroom, teacher.role, teacher.max, counts.chief, counts.assistant, counts.hallway, counts.standby, counts.total, teacher.unavailable];
    row.font = { name: '맑은 고딕', size: 10 };
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFD7DED9' } } }; });
  });
  summary.autoFilter = { from: 'A2', to: `K${Math.max(2, teachers.length + 2)}` };

  return workbook.xlsx.writeBuffer();
}

export async function exportScheduleWorkbook(
  teachers: ExcelTeacher[],
  sessions: ExcelSession[],
  assignments: ExcelAssignments,
) {
  const buffer = await createScheduleWorkbookBuffer(teachers, sessions, assignments);
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '시험감독표.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
