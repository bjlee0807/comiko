const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const Module = require('node:module');
const cache = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module); m.filename = filename; m.paths = module.paths;
  const normalRequire = m.require.bind(m);
  m.require = (key) => key.startsWith('./') ? load(path.resolve(path.dirname(filename), key + '.ts')) : normalRequire(key);
  m._compile(ts.transpile(fs.readFileSync(filename, 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }), filename);
  cache.set(filename, m.exports); return m.exports;
}
const grades = load('lib/session-grades.ts');
const excel = load('lib/excel-schedule.ts');
const personal = load('lib/personal-schedule.ts');
const files = load('lib/exam-file.ts');
const dates = load('lib/exam-date.ts');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const helpers = page.slice(page.indexOf('function roomOrder'), page.indexOf('export default function Home'));
const auto = page.slice(page.indexOf('  function autoAssign(alternate = false)'), page.indexOf('\n  useEffect(() => {\n    const modelContext'));
const teachers = Array.from({ length: 8 }, (_, i) => ({ id: 't' + i, name: '교사' + i, subject: '', homeroom: '', role: '교과교사', max: 10, unavailable: '' }));
const base = { id: 's1', date: '2026/4/27(월)', period: '1교시', grade1Subject: '국어', grade2Subject: '수학', grade3Subject: '영어', rooms: '1-1,2-1,3-1' };
(async () => {
  for (let mask = 1; mask <= 7; mask++) {
    const s = { ...base };
    const included = [1, 2, 3].filter(g => mask & (1 << (g - 1)));
    [1, 2, 3].forEach(g => { if (!included.includes(g)) s['grade' + g + 'Subject'] = grades.NO_EXAM; });
    assert.equal(grades.activeRooms(s).length, included.length);
    const context = vm.createContext({ ...load('lib/school-rules.ts'), ...load('lib/setter-rules.ts'), ...load('lib/hallway-supervision.ts'), examName: '2026 시험', ...grades, ...dates, specialRooms: [], teachers, sessions: [s], assignments: {}, assignmentVariantRef:{current:0}, sameAssignments:(a,b)=>JSON.stringify(a)===JSON.stringify(b), excludeHomeroom: true, requiredCount: included.length * 2, rememberAssignments() {}, setActiveTab() {}, setNotice() {} });
    context.setAssignments = value => { context.assignments = value; };
    vm.runInContext(ts.transpile(helpers + auto, { target: ts.ScriptTarget.ES2022 }), context);
    vm.runInContext('autoAssign()', context);
    assert.equal(Object.keys(context.assignments).length, included.length);
    assert.equal(context.validateSchedule(teachers, [s], context.assignments, true, 2026).length, 0);
    const stale = { ...context.assignments, 's1::1-1': { chief: 't0', assistant: 't1' } };
    const data = { name: '2026 시험', teachers, sessions: [s], assignments: context.assignments, excludeHomeroom: true };
    assert.equal(files.readExamFile(files.makeExamFile(data)).data.sessions[0].grade1Subject, s.grade1Subject);
    if (!included.includes(1)) assert.ok(personal.personalSchedule({ ...data, assignments: stale }, 't0').every(row => row.room !== '1-1'));
    const buffer = await excel.createScheduleWorkbookBuffer(teachers, [s], stale);
    const ExcelJS = require('exceljs'); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    const rooms = []; wb.getWorksheet('감독 목록').eachRow((row, number) => { if (number > 3) rooms.push(row.getCell(6).text); });
    assert.deepEqual(rooms.sort(), included.map(g => g + '-1').sort());
    const imported = await excel.importScheduleWorkbook({ arrayBuffer: async () => buffer });
    assert.equal(imported.sessions[0].grade1Subject, s.grade1Subject);
    assert.equal(imported.sessions[0].grade2Subject, s.grade2Subject);
    assert.equal(imported.sessions[0].grade3Subject, s.grade3Subject);
  }
  const study = { ...base, grade1Subject: grades.NO_EXAM, grade2Subject: '자습', grade3Subject: grades.NO_EXAM, rooms: '1-1,2-1,3-1,과학실' };
  assert.deepEqual(grades.activeRooms(study), ['2-1', '과학실']);
  assert.equal(grades.activeRooms({ ...study, grade2Subject: grades.NO_EXAM, rooms: '1-1,2-1,3-1' }).length, 0);
  console.log('PASS: all seven grade combinations, auto assignment and validation exclusions, personal schedules, exam file and Excel roundtrip, study and special rooms');
})().catch(error => { console.error(error); process.exitCode = 1; });
