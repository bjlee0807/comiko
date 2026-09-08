import type { ExcelSession, ExcelTeacher } from './excel-schedule';
import { NO_EXAM, gradeParticipates } from './session-grades';

export type ExamGradeSubject = { grade: 1 | 2 | 3; subject: string };

export function examGradeSubjects(session: ExcelSession): ExamGradeSubject[] {
  return ([1, 2, 3] as const)
    .filter((grade) => gradeParticipates(session, grade))
    .map((grade) => ({
      grade,
      subject: (session[`grade${grade}Subject`] ?? '').trim(),
    }))
    .filter(({ subject }) => subject && subject !== '자습' && subject !== NO_EXAM);
}

export function examSubjects(session: ExcelSession): string[] {
  return [...new Set(examGradeSubjects(session).map(({ subject }) => subject))];
}

function setterMatchesSession(teacher: ExcelTeacher, session: ExcelSession) {
  const matches = examGradeSubjects(session).filter(
    ({ subject }) => subject === teacher.setterSubject,
  );
  if (teacher.setterGrade) {
    return matches.some(({ grade }) => grade === teacher.setterGrade);
  }
  // 예전 저장 자료는 해당 과목을 보는 학년이 하나일 때만 안전하게 이어서 사용합니다.
  return matches.length === 1;
}

export function officeStandbyTeachers(
  session: ExcelSession,
  teachers: ExcelTeacher[],
): ExcelTeacher[] {
  return teachers.filter(
    (teacher) =>
      teacher.setterDuty === 'standby' && setterMatchesSession(teacher, session),
  );
}

export function setterAssistantForSession(
  teacher: ExcelTeacher,
  session: ExcelSession,
): boolean {
  return (
    teacher.setterDuty === 'assistant' && setterMatchesSession(teacher, session)
  );
}

export function setterAssistantAllowedRoom(
  teacher: ExcelTeacher,
  session: ExcelSession,
  room: string,
): boolean {
  if (!setterAssistantForSession(teacher, session)) return false;
  const testedGrades = examGradeSubjects(session).map(({ grade }) => grade);
  if (testedGrades.length === 1) return true;
  const roomGrade = Number(room.match(/^([1-3])-/)?.[1]);
  if (teacher.setterGrade && roomGrade) return roomGrade !== teacher.setterGrade;
  const roomSubject = roomGrade
    ? session[`grade${roomGrade}Subject` as keyof ExcelSession]
    : '';
  return roomSubject !== teacher.setterSubject;
}

export function singleGradeSetterException(
  teacher: ExcelTeacher,
  session: ExcelSession,
  duty: 'chief' | 'assistant',
): boolean {
  return (
    duty === 'assistant' &&
    setterAssistantForSession(teacher, session) &&
    examGradeSubjects(session).length === 1
  );
}
