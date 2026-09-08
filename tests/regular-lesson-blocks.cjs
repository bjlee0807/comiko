const assert = require('node:assert/strict');
const load = require('./load-ts.cjs');
const rules = load('lib/regular-lesson-blocks.ts');
const teacher = { id: 't1', name: '교사', subject: '국어', homeroom: '', role: '교과교사', max: 5, unavailable: 'manual', manualUnavailable: 'manual', regularLessons: '1|1|3-1,2|2|1-2,5|3|2-4' };
const sessions = [
  { id: 'mon1', date: '2026/9/7(월)', period: '1교시', grade1Subject: '국어', grade2Subject: '수학', grade3Subject: '시험 없음', rooms: '1-1,2-1' },
  { id: 'tue2', date: '9/8(화)', period: '2', grade1Subject: '시험 없음', grade2Subject: '수학', grade3Subject: '과학', rooms: '2-1,3-1' },
  { id: 'fri3', date: '2026-09-11', period: '3교시', grade1Subject: '국어', grade2Subject: '영어', grade3Subject: '과학', rooms: '1-1,2-1,3-1' },
];
assert.deepEqual(rules.regularLessonBlockedSessionIds(teacher, sessions, 2026), ['mon1', 'tue2']);
const applied = rules.applyRegularLessonBlocks([teacher], sessions, 2026)[0];
assert.deepEqual(new Set(applied.unavailable.split(', ')), new Set(['manual', 'mon1', 'tue2']));
assert.equal(applied.manualUnavailable, 'manual');
assert.equal(teacher.unavailable, 'manual');
assert.equal(rules.encodeRegularLessons(rules.parseRegularLessons(teacher.regularLessons)), teacher.regularLessons);
assert.deepEqual(rules.parseRegularLessons('bad,6|1|1-1,1|x|1-1'), []);
const homeroom = { ...teacher, homeroom: '1-1', regularLessons: '1|4|3-2' };
const last = { id: 'last', date: '2026/9/7(월)', period: '3교시', grade1Subject: '국어', grade2Subject: '수학', grade3Subject: '시험 없음', rooms: '1-1,2-1' };
const earlier = { ...last, id: 'earlier', period: '2교시' };
assert.equal(rules.lastExamChiefBlocked(homeroom, last, [earlier, last], 2026), true);
assert.equal(rules.lastExamChiefBlocked(homeroom, earlier, [earlier, last], 2026), false);
assert.equal(rules.lastExamChiefBlocked({ ...homeroom, homeroom: '' }, last, [last], 2026), false);
assert.equal(rules.lastExamChiefBlocked({ ...homeroom, regularLessons: '1|4|1-2' }, last, [last], 2026), false);
assert.equal(rules.lastExamChiefBlocked(homeroom, { ...last, grade1Subject: '시험 없음' }, [last], 2026), false);
console.log('PASS: non-exam grade regular lessons, weekday/period matching, all-grade exclusion and manual blocks');
