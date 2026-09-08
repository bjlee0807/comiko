const assert = require('node:assert/strict');
const { readExamFile, makeExamFile, copyForNextExam } = require('./load-ts.cjs')('lib/exam-file.ts');
const data = {
  name: '2026 중간고사', excludeHomeroom: true,
  teachers: [{ id: 't1', name: '김가람', subject: '국어', homeroom: '2-1', role: '교과교사', max: 4, unavailable: 's1' }],
  sessions: [{ id: 's1', date: '4/27', period: '1교시', grade1Subject: '자습', grade2Subject: '수학', grade3Subject: '영어', rooms: '2-1' }],
  assignments: { 's1::2-1': { chief: 't1', assistant: '', chiefLocked: true, assistantLocked: false } },
};
const encoded = makeExamFile(data);
assert.deepEqual(readExamFile(encoded).data, data);
assert.deepEqual(data.assignments['s1::2-1'].chiefLocked, true);
const next = copyForNextExam(data, '기말고사');
assert.equal(next.name, '기말고사');
assert.equal(next.teachers[0].unavailable, '');
assert.deepEqual(next.sessions, []);
assert.deepEqual(next.assignments, {});
next.teachers[0].name = '수정';
assert.equal(data.teachers[0].name, '김가람');
assert.equal(data.teachers[0].unavailable, 's1');
assert.throws(() => copyForNextExam(data, '  '));
assert.throws(() => readExamFile('bad json'));
assert.throws(() => readExamFile(JSON.stringify({ ...JSON.parse(encoded), version: 99 })), /버전/);
for (const alter of [
  d => d.teachers.push(d.teachers[0]),
  d => d.sessions.push(d.sessions[0]),
  d => d.assignments['s1::2-1'].chief = 'unknown',
  d => d.assignments['s1::2-1'].chiefLocked = 'true',
  d => d.teachers[0].max = -1,
  d => d.excludeHomeroom = 'yes',
  d => d.teachers[0].id = '__proto__',
]) {
  const malformed = JSON.parse(encoded); alter(malformed.data);
  assert.throws(() => readExamFile(JSON.stringify(malformed)));
}
const stale = structuredClone(data); stale.teachers[0].unavailable = 's1, deleted-session';
assert.equal(readExamFile(makeExamFile(stale)).data.teachers[0].unavailable, 's1');
assert.equal(stale.teachers[0].unavailable, 's1, deleted-session');
assert.throws(() => readExamFile('x'.repeat(5 * 1024 * 1024 + 1)), /5MB/);
console.log('PASS: complete exam roundtrip, lock preservation, next-exam isolation, invalid file rejection, stale references and file limit');
