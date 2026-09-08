const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('app/page.tsx', 'utf8');

assert.ok(page.includes('const regularLessonStatus = useMemo'));
assert.ok(page.includes('정규수업 자동 불가'));
assert.ok(page.includes('수업 = 시간표 자동 반영'));
assert.ok(page.includes('자동 편성 후보에서도 제외됩니다.'));

console.log('PASS: regular lesson status summary and clear automatic/manual legend');
