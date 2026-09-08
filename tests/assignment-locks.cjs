const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const auto = page.slice(page.indexOf('  function autoAssign(alternate = false)'), page.indexOf('\n  useEffect(() => {\n    const modelContext'));
const undo = page.slice(page.indexOf('  function rememberAssignments()'), page.indexOf('\n  const counts ='));
function run(assignments, overrides = {}) {
  const context = { ...require('./load-ts.cjs')('lib/school-rules.ts'), ...require('./load-ts.cjs')('lib/setter-rules.ts'), ...require('./load-ts.cjs')('lib/hallway-supervision.ts'), ...require('./load-ts.cjs')('lib/exam-date.ts'), examName: '2026 시험',
    teachers: ['a','b','c','d'].map(id => ({id, name:id, subject:'', homeroom:'', unavailable:'', max:2, role:'교과교사'})),
    sessions: [{id:'s1',date:'day',period:'1',rooms:'2-1,2-2',grade2Subject:'국어'}],
    assignments, assignmentHistory: [], assignmentVariantRef:{current:0}, excludeHomeroom:true, requiredCount:4,
    sameAssignments:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    structuredClone, roomList:s=>s.rooms.split(','), subjectForRoom:s=>s.grade2Subject,
    assignmentField:duty=>duty==='assistant'?'assistant':'chief', lockField:duty=>duty==='assistant'?'assistantLocked':'chiefLocked',
    unavailableIds:t=>t.unavailable.split(','), slotKey:(s,r)=>`${s}::${r}`,
    defaultAssignments:sessions=>Object.fromEntries(sessions.flatMap(s=>s.rooms.split(',').map(r=>[`${s.id}::${r}`,{chief:'',assistant:''}]))),
    ...overrides,
  };
  context.setAssignments = value => { context.assignments = typeof value === 'function' ? value(context.assignments) : value; };
  context.setAssignmentHistory = fn => { context.assignmentHistory = fn(context.assignmentHistory); };
  context.setActiveTab = value => { context.activeTab = value; };
  context.setNotice = value => { context.notice = value; };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(undo + auto, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText, context);
  vm.runInContext('autoAssign()', context);
  return context;
}
const original = {'s1::2-1':{chief:'b',assistant:''},'s1::2-2':{chief:'a',assistant:'',chiefLocked:true}};
const result = run(original);
assert.equal(result.assignments['s1::2-2'].chief,'a');
assert.equal(result.assignments['s1::2-2'].chiefLocked,true);
assert.equal(Object.values(result.assignments).flatMap(x=>[x.chief,x.assistant]).filter(x=>x==='a').length,1);
assert.equal(result.assignmentHistory.length,1);
vm.runInContext('undoAssignment()',result);
assert.equal(JSON.stringify(result.assignments),JSON.stringify(original));
assert.equal(result.assignmentHistory.length,0);
const alternatives = run(original);
const baseSchedule = JSON.stringify(alternatives.assignments);
vm.runInContext('autoAssign()', alternatives);
assert.equal(JSON.stringify(alternatives.assignments), baseSchedule);
assert.equal(alternatives.assignmentHistory.length, 1);
assert.match(alternatives.notice, /동일합니다/);
vm.runInContext('autoAssign(true)', alternatives);
assert.notEqual(JSON.stringify(alternatives.assignments), baseSchedule);
vm.runInContext('undoAssignment()', alternatives);
assert.equal(JSON.stringify(alternatives.assignments), baseSchedule);
vm.runInContext('clearUnlockedAssignments()', alternatives);
assert.equal(alternatives.assignments['s1::2-2'].chief, 'a');
assert.equal(alternatives.assignments['s1::2-2'].chiefLocked, true);
assert.equal(alternatives.assignments['s1::2-1'].chief, '');
const conflict = {'s1::2-1':{chief:'a',assistant:'',chiefLocked:true},'s1::2-2':{chief:'a',assistant:'',chiefLocked:true}};
const blocked = run(conflict);
assert.equal(blocked.assignments,conflict);
assert.match(blocked.notice,/고정 배정 충돌/);
assert.equal(blocked.assignmentHistory.length,0);
const unavailable = run(original,{teachers:[{id:'a',name:'a',subject:'',homeroom:'',unavailable:'s1',max:2,role:'교과교사'}]});
assert.equal(unavailable.assignments,original);
assert.match(unavailable.notice,/고정 배정 충돌/);
console.log('PASS: locks retained, alternate plans vary, duplicate runs skip history, undo and unlocked reset work');
