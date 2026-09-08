import { activeRooms } from './session-grades';
import type { ExamData } from './exam-file';
import { examDateKey, examYear, parseExamDate } from './exam-date';
import { officeStandbyTeachers } from './setter-rules';
import { hallwayGroups, hallwaySlotKey, roomNeedsAssistant } from './hallway-supervision';

export type PersonalDuty = { date: string; period: string; room: string; subject: string; duty: '정감독' | '부감독' | '자습감독' | '복도감독' | '교무실 대기'; locked: boolean; duplicate: boolean };
export function personalSchedule(data: ExamData, teacherId: string): PersonalDuty[] {
  if (!teacherId || !data.teachers.some((teacher) => teacher.id === teacherId)) return [];
  const year = examYear(data.name);
  const rows: PersonalDuty[] = [];
  data.sessions.forEach((session) => {
    const standby = officeStandbyTeachers(session, data.teachers).find((teacher) => teacher.id === teacherId);
    if (standby) rows.push({ date: examDateKey(session.date, year), period: session.period, room: '교무실', subject: standby.setterSubject ?? '', duty: '교무실 대기', locked: false, duplicate: false });
    activeRooms(session).forEach((room) => {
      const assignment = data.assignments[`${session.id}::${room}`];
      const subject = room.startsWith('1-') ? session.grade1Subject : room.startsWith('2-') ? session.grade2Subject : room.startsWith('3-') ? session.grade3Subject : '특별실';
      if (assignment?.chief === teacherId) rows.push({ date: examDateKey(session.date, year), period: session.period, room, subject, duty: subject === '자습' ? '자습감독' : '정감독', locked: Boolean(assignment.chiefLocked), duplicate: false });
      if (roomNeedsAssistant(session, subject) && assignment?.assistant === teacherId) rows.push({ date: examDateKey(session.date, year), period: session.period, room, subject, duty: '부감독', locked: Boolean(assignment.assistantLocked), duplicate: false });
    });
    hallwayGroups(session).forEach(group => {
      const assignment = data.assignments[hallwaySlotKey(session.id, group.id)];
      if (assignment?.chief === teacherId) rows.push({ date: examDateKey(session.date, year), period: session.period, room: group.label, subject: '복도', duty: '복도감독', locked: Boolean(assignment.chiefLocked), duplicate: false });
    });
  });
  const times = new Map<string, number>();
  rows.forEach((row) => { const key = `${row.date}::${row.period.trim()}`; times.set(key, (times.get(key) ?? 0) + 1); });
  rows.forEach((row) => { row.duplicate = (times.get(`${row.date}::${row.period.trim()}`) ?? 0) > 1; });
  return rows.sort((a, b) => {
    const aDate = parseExamDate(a.date, year)?.getTime() ?? Infinity;
    const bDate = parseExamDate(b.date, year)?.getTime() ?? Infinity;
    return (aDate === bDate ? 0 : aDate < bDate ? -1 : 1) || a.date.localeCompare(b.date, 'ko') || a.period.localeCompare(b.period, 'ko', { numeric: true }) || a.room.localeCompare(b.room, 'ko', { numeric: true });
  });
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function personalPrintDocument(exam: string, teacher: string, rows: PersonalDuty[], issueCount: number): string {
  const counts = ['정감독', '부감독', '자습감독', '복도감독', '교무실 대기'].map((duty) => `${duty} ${rows.filter((row) => row.duty === duty).length}회`).join(' · ');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(exam)} - ${escapeHtml(teacher)} 감독 일정</title><style>@page{size:A4 portrait;margin:16mm}body{font-family:'Malgun Gothic',sans-serif;color:#172820;line-height:1.6;margin:24px}h1{font-size:22px;margin:0 0 8px}h2{font-size:19px}table{border-collapse:collapse;width:100%;font-size:14px;table-layout:fixed}th,td{border:1px solid #8c9891;padding:10px;overflow-wrap:anywhere}th{background:#edf3ef}thead{display:table-header-group}tr{break-inside:avoid}.warning{border:1px solid #b85b25;padding:10px;color:#8a3619}button{padding:10px 18px;font-size:16px;margin-bottom:20px}.meta{font-size:13px;color:#536159}@media print{body{margin:0}button{display:none}}</style></head><body><h1>${escapeHtml(exam)}</h1><h2>${escapeHtml(teacher)} 선생님 · 개인 감독 일정</h2><p>총 ${rows.length}회 · ${counts}</p>${issueCount ? `<p class="warning">전체 감독표에 확인할 항목이 ${issueCount}건 있습니다. 배부 전 편성 검증을 확인하세요.</p>` : ''}${rows.some((row) => row.duplicate) ? '<p class="warning">같은 시간 중복 배정이 있습니다. 아래 표시된 배정을 수정하세요.</p>' : ''}<table><thead><tr><th>날짜</th><th>교시</th><th>고사실</th><th>과목</th><th>감독 역할</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.period)}</td><td>${escapeHtml(row.room)}</td><td>${escapeHtml(row.subject)}</td><td>${row.duty}${row.duplicate ? ' (중복 확인)' : ''}</td></tr>`).join('') || '<tr><td colspan="5">배정된 감독 일정이 없습니다.</td></tr>'}</tbody></table><p class="meta">현재 편성 내용을 기준으로 작성했습니다. 변경 사항은 교무부의 최종 안내를 확인하세요.</p></body></html>`;
}
