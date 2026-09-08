import type { Workbook } from 'exceljs';
import type { ExcelTeacher } from './excel-schedule';

export type RosterRow = Pick<ExcelTeacher, 'name' | 'subject' | 'homeroom' | 'role' | 'max'>;
export type RosterPreview = { rows: RosterRow[]; errors: string[]; sheet: string };
const subjects = ['국어', '영어', '수학', '사회', '역사', '과학', '도덕', '기술가정', '정보', '체육', '음악', '미술', '중국어', '종교'];
const roles = ['교과교사', '강사', '성적담당', '비교과', '교육공무직'];
const headers = ['이름', '담당과목', '담임', '구분', '감독상한'];
const normalize = (value: string) => value.trim().replace(/\s+/g, '');

export function parseRoster(workbook: Workbook): RosterPreview {
  const candidates: { sheet: typeof workbook.worksheets[number]; row: number; columns: number[] }[] = [];
  for (const sheet of workbook.worksheets) {
    for (let row = 1; row <= Math.min(sheet.rowCount, 20); row++) {
      const cells = Array.from({ length: Math.min(sheet.columnCount, 50) }, (_, index) => normalize(sheet.getCell(row, index + 1).text));
      const columns = headers.map((header) => cells.indexOf(header) + 1);
      if (columns.every(Boolean)) { candidates.push({ sheet, row, columns }); break; }
    }
  }
  if (candidates.length !== 1) throw new Error(candidates.length ? '교사 명단 시트는 한 개만 남겨 주세요.' : '이름, 담당과목, 담임, 구분, 감독상한 열이 필요합니다. 교사 양식을 내려받아 작성해 주세요.');
  const { sheet, row: headerRow, columns } = candidates[0];
  if (sheet.rowCount > 2000) throw new Error('교사 명단은 2,000행 이내로 작성해 주세요.');
  const result: RosterPreview = { rows: [], errors: [], sheet: sheet.name };
  const names = new Set<string>();
  for (let row = headerRow + 1; row <= sheet.rowCount; row++) {
    const cells = columns.map((column) => sheet.getCell(row, column));
    const values = cells.map((cell) => cell.text.trim());
    if (values.every((value) => !value)) continue;
    const errors: string[] = [];
    if (cells.some((cell) => cell.value && typeof cell.value === 'object' && ('formula' in cell.value || 'sharedFormula' in cell.value || 'error' in cell.value))) errors.push('수식·오류 셀은 값으로 바꿔 주세요');
    const name = values[0];
    const subject = ['없음', '-'].includes(normalize(values[1])) ? '' : normalize(values[1]);
    const homeroom = ['없음', '-'].includes(normalize(values[2])) ? '' : normalize(values[2]);
    const role = normalize(values[3]) as RosterRow['role'];
    const max = Number(values[4]);
    if (!name) errors.push('이름 누락');
    if (name && names.has(normalize(name))) errors.push('이름 중복 (동명이인은 이름에 구분 표시를 붙여 주세요)');
    if (name) names.add(normalize(name));
    if (subject && !subjects.includes(subject)) errors.push('담당과목은 지정 과목 또는 없음으로 입력');
    if (homeroom && !/^[1-3]-(?:[1-9]|10)$/.test(homeroom)) errors.push('담임은 1-1~3-10 또는 없음으로 입력 (셀 형식: 텍스트)');
    if (!roles.includes(role)) errors.push('구분은 교과교사·강사·성적담당·비교과·교육공무직 중 선택');
    if (!values[4] || !Number.isSafeInteger(max) || max < 0) errors.push('감독상한은 0 이상의 정수로 입력');
    if (errors.length) result.errors.push(`${row}행: ${errors.join(' / ')}`);
    else result.rows.push({ name, subject, homeroom, role, max });
  }
  if (!result.rows.length && !result.errors.length) result.errors.push('입력된 교사가 없습니다. 2행부터 명단을 작성해 주세요.');
  return result;
}

export async function readRoster(file: File) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('엑셀 .xlsx 파일을 선택해 주세요.');
  if (file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 교사 명단 파일을 선택해 주세요.');
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(await file.arrayBuffer()); }
  catch { throw new Error('파일을 읽지 못했습니다. 암호를 해제하고 .xlsx 형식으로 다시 저장해 주세요.'); }
  return parseRoster(workbook);
}

export function applyRoster(current: ExcelTeacher[], rows: RosterRow[], mode: 'merge' | 'replace', newId: () => string): ExcelTeacher[] {
  const incoming = rows.map((row) => {
    const matches = current.filter((teacher) => normalize(teacher.name) === normalize(row.name));
    if (matches.length > 1) throw new Error(`${row.name}: 기존 명단에 동명이인이 있습니다. 이름에 구분 표시를 붙인 뒤 다시 적용해 주세요.`);
    return { ...matches[0], ...row, autoMax: false, id: matches[0]?.id ?? newId(), unavailable: matches[0]?.unavailable ?? '' };
  });
  if (mode === 'replace') return incoming;
  const ids = new Set(incoming.map((teacher) => teacher.id));
  return [...current.filter((teacher) => !ids.has(teacher.id)), ...incoming];
}

export async function createRosterTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('교사명단');
  sheet.addRow(headers);
  sheet.columns.forEach((column, index) => { column.width = [20, 20, 18, 20, 18][index]; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = 'A1:E101';
  sheet.getRow(1).height = 28;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { name: '맑은 고딕', bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF145A4A' } };
  });
  const lists = workbook.addWorksheet('선택목록');
  const rooms = ['없음', ...[1, 2, 3].flatMap((grade) => Array.from({ length: 10 }, (_, i) => `${grade}-${i + 1}`))];
  ['없음', ...subjects].forEach((value, i) => { lists.getCell(i + 1, 1).value = value; });
  rooms.forEach((value, i) => { lists.getCell(i + 1, 2).value = value; });
  roles.forEach((value, i) => { lists.getCell(i + 1, 3).value = value; });
  workbook.definedNames.add('선택목록!$A$1:$A$15', 'TeacherSubjects');
  workbook.definedNames.add('선택목록!$B$1:$B$31', 'TeacherRooms');
  workbook.definedNames.add('선택목록!$C$1:$C$5', 'TeacherRoles');
  lists.state = 'hidden';
  for (let row = 2; row <= 501; row++) {
    sheet.getCell(row, 1).numFmt = '@';
    sheet.getCell(row, 3).numFmt = '@';
    ['TeacherSubjects', 'TeacherRooms', 'TeacherRoles'].forEach((range, index) => {
      sheet.getCell(row, index + 2).dataValidation = { type: 'list', allowBlank: index < 2, formulae: [range], showErrorMessage: true, errorStyle: 'stop', errorTitle: '목록에서 선택', error: '목록에 있는 값을 선택해 주세요.' };
    });
    sheet.getCell(row, 5).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: false, showErrorMessage: true, errorStyle: 'stop', error: '0 이상의 정수를 입력하세요.' };
  }
  const guide = workbook.addWorksheet('작성안내');
  guide.getColumn(1).width = 110;
  [
    '교사명단 시트의 2행부터 한 줄에 한 명씩 입력하세요. 예시 교사는 포함되어 있지 않습니다.',
    '이름, 구분, 감독상한은 필수입니다. 담당과목·담임이 없으면 빈칸 또는 없음으로 입력하세요.',
    '담임은 1-1부터 3-10까지 선택하세요. 날짜로 변환되지 않도록 텍스트 형식을 유지하세요.',
    '구분: 교과교사, 강사, 성적담당, 비교과, 교육공무직. 감독상한: 0 이상의 정수 (0은 배정하지 않음).',
    '이름으로 기존 교사를 찾습니다. 동명이인은 김가람(국어), 김가람(수학)처럼 구분하세요.',
    '업로드 후 미리보기를 확인하고 적용하세요. 오류가 있으면 전체 명단 적용을 보류합니다.',
    '추가·업데이트는 파일에 없는 기존 교사를 유지합니다. 전체 교체는 파일에 없는 교사를 삭제합니다.',
    '같은 이름의 교사는 기존 감독 불가 시간과 배정·고정을 유지하며 다섯 항목만 갱신합니다.',
  ].forEach((line) => { const row = guide.addRow([line]); row.height = 36; row.alignment = { wrapText: true, vertical: 'middle' }; });
  return workbook.xlsx.writeBuffer();
}

export async function downloadRosterTemplate() {
  const buffer = await createRosterTemplate();
  const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url; link.download = '교사명단_입력양식.xlsx'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
