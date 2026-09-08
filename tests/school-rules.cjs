const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load-ts.cjs');
const rules = load('lib/school-rules.ts');
const dates = load('lib/exam-date.ts');
const grades = load('lib/session-grades.ts');
const hallway = load('lib/hallway-supervision.ts');
const files = load('lib/exam-file.ts');
const roster = load('lib/teacher-roster.ts');
const teacher = { id:'a', name:'일반', subject:'', homeroom:'', role:'교과교사', max:20, unavailable:'' };
const session = { id:'s1', date:'2026/9/4', period:'1교시', rooms:'1-1', grade1Subject:'국어', grade2Subject:'시험 없음', grade3Subject:'시험 없음' };
const second = { ...session, id:'s2', period:'2교시', rooms:'1-1,1-2' };
const reasons = (t, s, room, duty, teachers, assignments) => rules.schoolRuleReasons(t, s, room, duty, teachers, [session, second], assignments, 2026);
assert.equal(rules.dutyAllowed({...teacher, allowedDuty:'assistant'},'chief'),false);
assert.equal(rules.dailyLimit({...teacher,dailyMax:1}),1);
assert.equal(rules.lowLoadTeacher({...teacher,lowLoad:true}),true);
assert.equal(rules.lowLoadTeacher(teacher),false);
assert.equal(rules.lowLoadTeacher({...teacher,lowLoad:false}),false);
assert.equal(rules.dailyLimit({...teacher,role:'성적담당'}),1);
assert.equal(rules.dutyAllowed({...teacher,role:'비교과'},'chief'),false);
assert.equal(rules.dutyAllowed({...teacher,role:'강사'},'assistant'),false);
assert.equal(rules.dutyAllowed({...teacher,allowedDuty:'none'},'chief'),false);
assert.equal(rules.forbiddenPair({...teacher,name:'교사 A'}, {...teacher,id:'b',name:'교사 B'}),false);
assert.ok(rules.forbiddenPair({...teacher,name:'바뀐 이름',avoidTeachers:'b'}, {...teacher,id:'b',name:'다른 이름'}));
assert.ok(rules.forbiddenPair({...teacher,avoidTeachers:'b'}, {...teacher,id:'b'}));
const senior={...teacher,id:'senior',name:'연장자',lowLoad:true,needsYoungPartner:true};
const older={...teacher,id:'older',name:'더연장자'};
const young={...teacher,id:'young',name:'젊은교사'};
assert.equal(rules.youngerPartner(senior,young,[older,senior,young]),true);
assert.equal(rules.youngerPartner(senior,older,[older,senior,young]),false);
assert.ok(rules.schoolRuleReasons(senior,session,'1-1','chief',[older,senior,young],[session],{'s1::1-1':{chief:'senior',assistant:'older'}},2026).some(s=>s.includes('젊은')));
assert.ok(!rules.schoolRuleReasons(senior,session,'1-1','chief',[older,senior,young],[session],{'s1::1-1':{chief:'senior',assistant:'young'}},2026).some(s=>s.includes('젊은')));
assert.ok(reasons({...teacher,taughtClasses:'1-1'},session,'1-1','assistant',[teacher],{}).some(s=>s.includes('수업')));
const ending={...session,date:'2026/9/7(월)',period:'3교시',grade3Subject:'시험 없음'};
const homeroomNext={...teacher,homeroom:'1-2',regularLessons:'1|4|3-1'};
assert.ok(rules.schoolRuleReasons(homeroomNext,ending,'2-1','chief',[homeroomNext],[ending],{},2026).some(s=>s.includes('종례')));
assert.ok(!rules.schoolRuleReasons(homeroomNext,ending,'2-1','assistant',[homeroomNext],[ending],{},2026).some(s=>s.includes('종례')));
const setterRules=load('lib/setter-rules.ts');
const setter={...teacher,subject:'국어',setterGrade:1,setterSubject:'국어',setterDuty:'assistant'};
const twoGrades={...session,grade1Subject:'국어',grade2Subject:'수학',grade3Subject:'시험 없음'};
assert.equal(setterRules.setterAssistantAllowedRoom(setter,twoGrades,'2-1'),true);
assert.equal(setterRules.setterAssistantAllowedRoom(setter,twoGrades,'1-1'),false);
assert.equal(setterRules.setterAssistantAllowedRoom(setter,{...twoGrades,grade2Subject:'시험 없음'},'1-1'),true);
assert.ok(rules.schoolRuleReasons(setter,twoGrades,'2-1','chief',[setter],[twoGrades],{},2026).some(s=>s.includes('부감독')));
assert.ok(!rules.schoolRuleReasons(setter,twoGrades,'2-1','assistant',[setter],[twoGrades],{},2026).some(s=>s.includes('두 번째 출제자')));
const assigned = {'s1::1-1':{chief:'a',assistant:''}};
assert.ok(reasons(teacher,second,'1-1','assistant',[teacher],assigned).some(s=>s.includes('이미 감독')));
assert.equal(reasons(teacher,session,'1-1','chief',[teacher],assigned).length,0);
assert.ok(reasons({...teacher,dailyMax:1},second,'1-2','assistant',[teacher],assigned).some(s=>s.includes('하루')));
assert.equal(rules.schoolRuleReasons({...teacher,dailyMax:1},{...second,date:'2026/9/5'},'1-2','assistant',[teacher],[session,second],assigned,2026).length,0);
const configured = {...teacher,lowLoad:true,needsYoungPartner:true,taughtClasses:'1-2,2-10',dailyMax:1,allowedDuty:'assistant',avoidTeachers:'b',setterGrade:1,setterSubject:'국어',setterDuty:'assistant'};
const data = {name:'2026 시험',teachers:[configured],sessions:[session],assignments:{},excludeHomeroom:true};
assert.deepEqual(files.readExamFile(files.makeExamFile(data)).data.teachers[0],configured);
assert.equal(files.copyForNextExam(data,'다음 시험').teachers[0].taughtClasses,configured.taughtClasses);
const merged = roster.applyRoster([configured],[{name:'일반',subject:'영어',homeroom:'',role:'교과교사',max:10}],'merge',()=> 'new');
assert.equal(merged[0].lowLoad,true);
assert.equal(files.copyForNextExam(data,'다음 시험').teachers[0].lowLoad,true);
assert.equal(files.copyForNextExam(data,'다음 시험').teachers[0].setterDuty,'assistant');
assert.equal(files.copyForNextExam(data,'다음 시험').teachers[0].needsYoungPartner,true);
assert.throws(()=>files.makeExamFile({...data,teachers:[{...configured,lowLoad:'true'}]}));
assert.equal(merged[0].dailyMax,1); assert.equal(merged[0].avoidTeachers,'b');
assert.throws(()=>files.makeExamFile({...data,teachers:[{...configured,dailyMax:-1}]}));
const page = fs.readFileSync('app/page.tsx','utf8');
const helpers = page.slice(page.indexOf('function roomOrder'),page.indexOf('export default function Home'));
const auto = page.slice(page.indexOf('  function autoAssign(alternate = false)'),page.indexOf('\n  useEffect(() => {\n    const modelContext'));
function run(teachers,sessions,assignments={}) {
  const ctx = vm.createContext({...rules,...setterRules,...hallway,...dates,...grades,teachers,sessions,assignments,assignmentVariantRef:{current:0},sameAssignments:(a,b)=>JSON.stringify(a)===JSON.stringify(b),examName:'2026 시험',specialRooms:[],excludeHomeroom:true,requiredCount:sessions.length*2,rememberAssignments(){},setActiveTab(){}});
  ctx.setAssignments = value=>{ctx.assignments=value};ctx.setNotice = value=>{ctx.notice=value};
  vm.runInContext(ts.transpile(helpers+auto,{target:ts.ScriptTarget.ES2022}),ctx); vm.runInContext('autoAssign()',ctx); return ctx;
}
const people = Array.from({length:8},(_,i)=>({...teacher,id:'t'+i,name:'교사'+i}));
const schedules = [session,{...session,id:'s2',period:'2교시'},{...session,id:'s3',date:'2026/9/5'}];
const result = run(people,schedules);
assert.equal(result.validateSchedule(people,schedules,result.assignments,true,2026).length,0);
const used = Object.values(result.assignments).flatMap(v=>[v.chief,v.assistant]); assert.equal(new Set(used).size,6);
const sameTime = [session,{...session,id:'s2',date:'2026/9/4(금)',rooms:'1-2'}];
const collision = run(people,sameTime); assert.equal(new Set(Object.values(collision.assignments).flatMap(v=>[v.chief,v.assistant])).size,4);
const blockedPeople = [{...teacher,dailyMax:1}];
const locked = {'s1::1-1':{chief:'a',assistant:'',chiefLocked:true},'s2::1-2':{chief:'a',assistant:'',chiefLocked:true}};
const blocked = run(blockedPeople,[session,{...second,rooms:'1-2'}],locked);
assert.equal(blocked.assignments,locked); assert.match(blocked.notice,/고정 배정 충돌/);
assert.ok(result.validateSchedule([{...teacher,taughtClasses:'1-1'}],[session],assigned,true,2026).some(x=>x.kind==='학교 조건'));
const setterPeople = [
  {...teacher,id:'wait',name:'대기',setterGrade:1,setterSubject:'국어',setterDuty:'standby'},
  {...teacher,id:'setter',name:'출제',subject:'국어',setterGrade:1,setterSubject:'국어',setterDuty:'assistant',taughtClasses:'1-1'},
  ...Array.from({length:3},(_,i)=>({...teacher,id:'g'+i,name:'일반'+i})),
];
const setterResult = run(setterPeople,[session]);
assert.equal(Object.values(setterResult.assignments).some(item=>item.chief==='wait'||item.assistant==='wait'),false);
assert.equal(setterResult.assignments['s1::1-1'].assistant,'setter');
assert.equal(setterResult.validateSchedule(setterPeople,[session],setterResult.assignments,true,2026).length,0);
const badSetterConfig = setterResult.validateSchedule(setterPeople.filter(person=>person.id!=='setter'),[session],{},true,2026);
assert.ok(badSetterConfig.some(issue=>issue.kind==='설정 확인'&&issue.message.includes('부감독 출제자')));
const sameMath = {...twoGrades,rooms:'1-1,2-1',grade1Subject:'수학',grade2Subject:'수학'};
const gradeSetters = [
  {...teacher,id:'g1w',setterGrade:1,setterSubject:'수학',setterDuty:'standby'},
  {...teacher,id:'g1a',setterGrade:1,setterSubject:'수학',setterDuty:'assistant'},
  {...teacher,id:'g2w',setterGrade:2,setterSubject:'수학',setterDuty:'standby'},
  {...teacher,id:'g2a',setterGrade:2,setterSubject:'수학',setterDuty:'assistant'},
];
assert.equal(setterResult.validateSchedule(gradeSetters,[sameMath],{},true,2026).filter(issue=>issue.kind==='설정 확인').length,0);
const legacySetterIssues = setterResult.validateSchedule([{...teacher,setterSubject:'수학',setterDuty:'standby'}],[sameMath],{},true,2026);
assert.ok(legacySetterIssues.some(issue=>issue.message.includes('출제 학년을 선택')));
const agePeople=[older,{...senior,max:20},young,{...teacher,id:'other',name:'또래'}];
const ageLocked={'s1::1-1':{chief:'senior',assistant:'',chiefLocked:true}};
const ageResult=run(agePeople,[session],ageLocked);
const ageAssistant=ageResult.assignments['s1::1-1'].assistant;
assert.ok(agePeople.findIndex(person=>person.id===ageAssistant)>agePeople.findIndex(person=>person.id==='senior'));
assert.equal(ageResult.validateSchedule(agePeople,[session],ageResult.assignments,true,2026).length,0);
assert.ok(page.includes('moveTeacher(teacher.id, -1)')&&page.includes('나이순 / 이름'));
console.log('PASS: school roles, daily caps, pair exclusions, taught/repeated classes, persistence, roster preservation, real allocator/validator and locked conflicts');
