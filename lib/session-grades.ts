type GradeSession = { grade1Subject: string; grade2Subject: string; grade3Subject: string; rooms: string };
export const NO_EXAM = '시험 없음';
export function gradeParticipates(session: GradeSession, grade: number) {
  return (grade === 1 ? session.grade1Subject : grade === 2 ? session.grade2Subject : session.grade3Subject) !== NO_EXAM;
}
export function roomParticipates(session: GradeSession, room: string) {
  const grade = room.match(/^([1-3])-/);
  return !grade || gradeParticipates(session, Number(grade[1]));
}
export function activeRooms(session: GradeSession) {
  return [...new Set(session.rooms.split(',').map((room) => room.trim()).filter(Boolean))].filter((room) => roomParticipates(session, room));
}
