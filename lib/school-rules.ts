import type { ExcelTeacher, ExcelSession, ExcelAssignments } from './excel-schedule';
import { activeRooms } from './session-grades';
import { examDateKey } from './exam-date';
import { lastExamChiefBlocked } from './regular-lesson-blocks';
import { officeStandbyTeachers, setterAssistantForSession, singleGradeSetterException } from './setter-rules';
import { hallwayGroups, hallwaySlotKey } from './hallway-supervision';

export type TeacherRules = {
  taughtClasses?: string;
  allowedDuty?: 'both' | 'assistant' | 'none';
  dailyMax?: number;
  avoidTeachers?: string;
  lowLoad?: boolean;
  regularLessons?: string;
  manualUnavailable?: string;
  setterSubject?: string;
  setterGrade?: 1 | 2 | 3;
  setterDuty?: 'standby' | 'assistant';
  needsYoungPartner?: boolean;
};
export function lowLoadTeacher(teacher: ExcelTeacher) { return teacher.lowLoad === true; }
export function dailyLimit(teacher: ExcelTeacher) {
  const schoolMax = teacher.role === '성적담당' ? 1 : Infinity;
  return Math.min(schoolMax, teacher.dailyMax ?? Infinity);
}
export function dutyAllowed(teacher: ExcelTeacher, duty: 'chief' | 'assistant' | 'hallway') {
  if (duty === 'hallway') return true;
  if (teacher.role === '강사' || teacher.role === '교육공무직' || teacher.allowedDuty === 'none') return false;
  if (teacher.role === '비교과' || teacher.allowedDuty === 'assistant') return duty === 'assistant';
  return true;
}
export function forbiddenPair(a: ExcelTeacher, b: ExcelTeacher) {
  return (a.avoidTeachers ?? '').split(',').includes(b.id) || (b.avoidTeachers ?? '').split(',').includes(a.id);
}
export function youngerPartner(senior: ExcelTeacher, candidate: ExcelTeacher, teachers: ExcelTeacher[]) {
  const seniorIndex = teachers.findIndex(teacher => teacher.id === senior.id);
  const candidateIndex = teachers.findIndex(teacher => teacher.id === candidate.id);
  return seniorIndex >= 0 && candidateIndex > seniorIndex && !lowLoadTeacher(candidate);
}
export function schoolRuleReasons(teacher: ExcelTeacher, session: ExcelSession, room: string, duty: 'chief' | 'assistant' | 'hallway', teachers: ExcelTeacher[], sessions: ExcelSession[], assignments: ExcelAssignments, year: number): string[] {
  const reasons: string[] = [];
  if (!dutyAllowed(teacher, duty)) reasons.push('허용된 감독 역할이 아닙니다. 강사와 교실 감독 제외 교사는 복도감독만 가능합니다.');
  if (duty !== 'assistant' && setterAssistantForSession(teacher, session)) reasons.push('이 과목의 두 번째 출제자는 부감독으로만 배정합니다.');
  if (duty === 'chief' && lastExamChiefBlocked(teacher, session, sessions, year)) reasons.push('시험 종료 후 담임 종례와 다음 교시 타 학년 수업이 이어져 정감독에서 제외합니다. 부감독은 가능합니다.');
  if (duty !== 'hallway' && (teacher.taughtClasses ?? '').split(',').map(v => v.trim()).includes(room) && !singleGradeSetterException(teacher, session, duty)) reasons.push('본인이 수업하는 학급입니다.');
  const peer = duty === 'hallway' ? undefined : teachers.find(t => t.id === assignments[session.id + '::' + room]?.[duty === 'chief' ? 'assistant' : 'chief']);
  if (peer && forbiddenPair(teacher, peer)) reasons.push(peer.name + ' 선생님과 같은 교실에 배정할 수 없습니다.');
  const subject = room.startsWith('1-') ? session.grade1Subject : room.startsWith('2-') ? session.grade2Subject : room.startsWith('3-') ? session.grade3Subject : '';
  if (duty === 'chief' && teacher.needsYoungPartner && (session.singleSupervision || subject === '자습')) reasons.push('젊은 교사와 함께 배정하도록 설정되어 단독 정감독에 배정할 수 없습니다.');
  if (peer && teacher.needsYoungPartner && !youngerPartner(teacher, peer, teachers)) reasons.push('나이순에서 뒤에 있는 젊은 교사와 함께 배정해야 합니다.');
  if (peer?.needsYoungPartner && !youngerPartner(peer, teacher, teachers)) reasons.push(peer.name + ' 선생님은 나이순에서 뒤에 있는 젊은 교사와 함께 배정해야 합니다.');
  let daily = 0;
  let repeated = false;
  for (const other of sessions) {
    if (officeStandbyTeachers(other, teachers).some(item => item.id === teacher.id) && examDateKey(other.date, year) === examDateKey(session.date, year)) daily++;
    for (const otherRoom of activeRooms(other)) {
      const item = assignments[other.id + '::' + otherRoom];
      const otherSubject = otherRoom.startsWith('1-') ? other.grade1Subject : otherRoom.startsWith('2-') ? other.grade2Subject : otherRoom.startsWith('3-') ? other.grade3Subject : '';
      for (const otherDuty of (otherSubject === '자습' || other.singleSupervision ? ['chief'] : ['chief', 'assistant']) as ('chief' | 'assistant')[]) {
        if (other.id === session.id && otherRoom === room && otherDuty === duty) continue;
        if (item?.[otherDuty] !== teacher.id) continue;
        if (examDateKey(other.date, year) === examDateKey(session.date, year)) daily++;
        if (duty !== 'hallway' && otherRoom === room) repeated = true;
      }
    }
    for (const group of hallwayGroups(other)) {
      if (other.id === session.id && duty === 'hallway' && group.label === room) continue;
      if (assignments[hallwaySlotKey(other.id, group.id)]?.chief === teacher.id && examDateKey(other.date, year) === examDateKey(session.date, year)) daily++;
    }
  }
  if (repeated) reasons.push('시험기간 중 이미 감독한 학급입니다.');
  if (daily >= dailyLimit(teacher)) reasons.push('하루 감독 상한(' + dailyLimit(teacher) + '회)을 초과합니다.');
  return reasons;
}
