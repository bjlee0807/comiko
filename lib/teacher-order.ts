import type { Workbook } from 'exceljs';
import type { ExcelTeacher } from './excel-schedule';

const normalize = (value: string) => value.trim().replace(/\s+/g, '');

export function applyTeacherOrder(workbook: Workbook, teachers: ExcelTeacher[]): ExcelTeacher[] {
  const headers: Array<{ sheet: Workbook['worksheets'][number]; row: number; column: number }> = [];
  workbook.worksheets.forEach(sheet => {
    for (let row = 1; row <= Math.min(sheet.rowCount, 20); row += 1) {
      for (let column = 1; column <= Math.min(sheet.columnCount, 30); column += 1) {
        if (normalize(sheet.getCell(row, column).text) === '이름') headers.push({ sheet, row, column });
      }
    }
  });
  if (headers.length !== 1) throw new Error(headers.length ? '「이름」 열은 한 곳에만 남겨 주세요.' : '첫 행에 「이름」 제목이 있는 엑셀 파일을 선택하세요.');
  const { sheet, row: headerRow, column } = headers[0];
  if (sheet.rowCount > 2000) throw new Error('나이순 명단은 2,000행 이내로 작성해 주세요.');
  const names: string[] = [];
  for (let row = headerRow + 1; row <= sheet.rowCount; row += 1) {
    const cell = sheet.getCell(row, column);
    if (cell.value && typeof cell.value === 'object' && ('formula' in cell.value || 'sharedFormula' in cell.value || 'error' in cell.value)) throw new Error(`${row}행 이름은 수식이 아닌 값으로 입력하세요.`);
    const name = cell.text.trim();
    if (name) names.push(name);
  }
  if (!names.length) throw new Error('「이름」 아래에 나이 많은 순서대로 교사 이름을 입력하세요.');
  const normalized = names.map(normalize);
  const duplicate = normalized.find((name, index) => normalized.indexOf(name) !== index);
  if (duplicate) throw new Error(`나이순 명단에 같은 이름이 두 번 있습니다: ${names[normalized.indexOf(duplicate)]}`);
  const currentByName = new Map<string, ExcelTeacher>();
  teachers.forEach(teacher => {
    const key = normalize(teacher.name);
    if (currentByName.has(key)) throw new Error(`현재 교사 명단에 동명이인이 있습니다: ${teacher.name}. 이름에 구분 표시를 붙여 주세요.`);
    currentByName.set(key, teacher);
  });
  const unknown = names.filter(name => !currentByName.has(normalize(name)));
  const orderedSet = new Set(normalized);
  const missing = teachers.filter(teacher => !orderedSet.has(normalize(teacher.name))).map(teacher => teacher.name);
  if (unknown.length || missing.length) {
    const parts = [];
    if (unknown.length) parts.push(`현재 명단에 없는 이름: ${unknown.slice(0, 8).join(', ')}`);
    if (missing.length) parts.push(`나이순 명단에서 빠진 교사: ${missing.slice(0, 8).join(', ')}`);
    throw new Error(parts.join(' / '));
  }
  return names.map(name => currentByName.get(normalize(name))!);
}

export async function readTeacherOrder(file: File, teachers: ExcelTeacher[]) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('엑셀 .xlsx 파일을 선택해 주세요.');
  if (file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 나이순 명단 파일을 선택해 주세요.');
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(await file.arrayBuffer() as never); }
  catch { throw new Error('파일을 읽지 못했습니다. 암호를 해제하고 .xlsx 형식으로 다시 저장해 주세요.'); }
  return applyTeacherOrder(workbook, teachers);
}
