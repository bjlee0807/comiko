const assert = require('node:assert/strict');
const fs = require('node:fs');
const ExcelJS = require('exceljs');
const { applyTeacherOrder } = require('./load-ts.cjs')('lib/teacher-order.ts');
const teachers = [
  { id: 'a', name: '교사 가', subject: '', homeroom: '', role: '교과교사', max: 3, unavailable: '' },
  { id: 'b', name: '교사 나', subject: '', homeroom: '', role: '교과교사', max: 3, unavailable: '' },
  { id: 'c', name: '교사 다', subject: '', homeroom: '', role: '교과교사', max: 3, unavailable: '' },
];
function workbook(names) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('나이순');
  sheet.addRow(['이름']);
  names.forEach(name => sheet.addRow([name]));
  return book;
}
assert.deepEqual(applyTeacherOrder(workbook(['교사 다', '교사 가', '교사 나']), teachers).map(teacher => teacher.id), ['c', 'a', 'b']);
assert.throws(() => applyTeacherOrder(workbook(['교사 가', '교사 가', '교사 다']), teachers), /같은 이름/);
assert.throws(() => applyTeacherOrder(workbook(['교사 가', '교사 나']), teachers), /빠진 교사/);
assert.throws(() => applyTeacherOrder(workbook(['교사 가', '교사 나', '없는 교사']), teachers), /없는 이름/);
assert.throws(() => applyTeacherOrder(workbook(['교사 가']), [...teachers, { ...teachers[0], id: 'same', name: '교사 가' }]), /동명이인/);
const source = fs.readFileSync('app/page.tsx', 'utf8');
assert.ok(source.includes('나이순 명단 업로드'));
assert.ok(source.includes('moveTeacher(teacher.id, -1)'));
console.log('PASS: one-column age-order matching, complete-list checks, duplicates, unknown names and manual fine adjustment');
