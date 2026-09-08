const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpile(fs.readFileSync('lib/session-grades.ts', 'utf8').replace(/export /g, ''), { target: ts.ScriptTarget.ES2022 }), context);
vm.runInContext(ts.transpile(fs.readFileSync('lib/exam-date.ts', 'utf8').replace(/export /g, ''), { target: ts.ScriptTarget.ES2022 }), context);
vm.runInContext(ts.transpile(fs.readFileSync('lib/hallway-supervision.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), { target: ts.ScriptTarget.ES2022 }), context);
vm.runInContext(ts.transpile(fs.readFileSync('lib/setter-rules.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), { target: ts.ScriptTarget.ES2022 }), context);
const source = fs.readFileSync('lib/personal-schedule.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context);
const session = (id, date, period, subject = '영어') => ({ id, date, period, grade1Subject: '자습', grade2Subject: subject, grade3Subject: subject, rooms: '2-10,2-2' });
const data = { name: '2026 중간고사', teachers: [{ id: 'a', name: '김가람' }, { id: 'b', name: '다른교사' }], sessions: [session('s3', '2026/9/1', '1교시'), session('s1', '4/27(월)', '10교시'), session('s2', '2026/4/27(월)', '2교시', '자습')], assignments: {
  's3::2-10': { chief: 'a', assistant: 'b' },
  's1::2-10': { chief: 'b', assistant: 'a', assistantLocked: true },
  's2::2-10': { chief: 'a', assistant: 'a' },
  's2::2-2': { chief: 'a', assistant: '' },
}, excludeHomeroom: true };
const before = JSON.stringify(data);
const rows = context.personalSchedule(data, 'a');
assert.equal(rows.length, 4);
assert.equal(rows[0].period, '2교시');
assert.equal(rows[0].room, '2-2');
assert.equal(rows[0].duty, '자습감독');
assert.equal(rows[0].duplicate, true);
assert.equal(rows[1].duplicate, true);
assert.equal(rows[2].duty, '부감독');
assert.equal(rows[2].locked, true);
assert.equal(rows[3].date, '2026/9/1(화)');
assert.equal(JSON.stringify(data), before);
assert.equal(context.personalSchedule(data, 'missing').length, 0);
const html = context.personalPrintDocument('<script>bad</script>', '김가람 & 친구', rows, 3);
assert.ok(!html.includes('<script>'));
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(html.includes('김가람 &amp; 친구'));
assert.ok(!html.includes('다른교사'));
assert.ok(html.includes('중복 확인'));
assert.ok(html.includes('확인할 항목이 3건'));
assert.ok(context.personalPrintDocument('시험', '교사', [], 0).includes('배정된 감독 일정이 없습니다.'));
const standbyData = { ...data, teachers: [{ id: 'a', name: '김가람', setterGrade: 2, setterSubject: '영어', setterDuty: 'standby' }], sessions: [session('standby', '2026/9/2', '1교시')], assignments: {} };
const standbyRows = context.personalSchedule(standbyData, 'a');
assert.equal(standbyRows.length, 1);
assert.equal(standbyRows[0].duty, '교무실 대기');
assert.equal(standbyRows[0].room, '교무실');
console.log('PASS: personal filtering, date/period/room sorting, study duty exclusion, duplicates, locks, read-only data, safe print markup and empty schedules');
