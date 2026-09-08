'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { ExcelSession, ExcelTeacher } from '@/lib/excel-schedule';
import { regularLessonBlockedSessionIds } from '@/lib/regular-lesson-blocks';
import { readTeacherTimetable, matchTimetableTeachers, applyTeacherTimetable, NEW_TEACHER, type TimetablePreview } from '@/lib/teacher-timetable';

export function TeacherTimetableUpload({ teachers, onChange, defaultMax, sessions, examYear }: { defaultMax: number; sessions: ExcelSession[]; examYear: number; teachers: ExcelTeacher[]; onChange: (teachers: ExcelTeacher[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<TimetablePreview | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setError(''); setNotice(''); setApproved(false);
    try {
      const result = await readTeacherTimetable(file);
      setPreview(result); setTargets(matchTimetableTeachers(teachers, result.rows));
    } catch (e) { setError(e instanceof Error ? e.message : '시간표를 읽지 못했습니다.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  function apply() {
    if (!preview || !approved) return;
    try {
      const next = applyTeacherTimetable(teachers, preview, targets, () => `t-${crypto.randomUUID()}`, defaultMax);
      onChange(next);
      const automaticCount = next.reduce((sum, teacher) => sum + regularLessonBlockedSessionIds(teacher, sessions, examYear).length, 0);
      setNotice(`${targets.filter(Boolean).length}명의 이름·담당 과목·담임·수업 학급을 반영하고, 정규수업에 따른 감독 불가 ${automaticCount}칸을 자동 표시했습니다. ${targets.filter(t => t === NEW_TEACHER).length}명 신규 추가 / ${targets.filter(t => !t).length}명 미반영. 감독표의 조건 검사를 확인하세요.`);
      setPreview(null); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '반영하지 못했습니다.'); }
  }
  const selectedCount = targets.filter(Boolean).length;
  return <section className="no-print rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">전체 교사 시간표에서 가져오기</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">전체 교사의 이름·수업 과목·수업 학급과 오른쪽 담임 열을 읽어 교사 설정에 반영합니다. 과목/학급이 두 줄로 된 월~금 시간표 · .xlsx · 최대 5MB.</p></div><Button disabled={busy} onClick={() => input.current?.click()}><Upload />{busy ? '시간표 분석 중…' : '전체 교사 시간표 업로드'}</Button></div>
    <input ref={input} type="file" accept=".xlsx" className="hidden" aria-label="전체 교사 시간표 엑셀" onChange={e => void upload(e.target.files?.[0])} />
    <p className="mt-2 text-sm leading-6 text-muted-foreground">파일은 이 기기에서만 읽습니다. 이름으로 기존 교사를 연결하고 적용 전에 변경 내용을 보여줍니다. 기존 교사의 감독 상한·직접 체크한 불가 시간·배려 조건은 유지합니다. 시험을 보지 않는 학년의 정규수업은 시험 날짜의 요일·교시와 대조해 감독 불가로 자동 표시합니다. 창체는 제외합니다.</p>
    {error && !preview && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-[#083f77]">{notice}</p>}
    <Dialog open={Boolean(preview)} onOpenChange={open => { if (!open) { setPreview(null); setError(''); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>교사 정보와 정규수업 반영 내용 확인</DialogTitle><DialogDescription>선택한 교사의 이름·담당 과목·담임·수업 학급을 시간표 내용으로 갱신합니다. 시간표에서 과목을 찾지 못한 기존 교사는 담당 과목을 유지합니다. 시간표의 담임 빈칸은 ‘없음’으로 반영합니다. 다른 개인별 설정과 기존 배정은 유지합니다. 시험을 보지 않는 학년의 수업 교시는 감독 불가로 자동 표시하며, 조건 위반은 감독표에 표시합니다.</DialogDescription></DialogHeader>
        {preview && <>
          <p className="text-sm">{preview.sheet} · 읽은 교사 {preview.rows.length}명 · 반영 {selectedCount}명 · 미반영 {targets.filter(t => !t).length}명</p>
          <p className="text-sm leading-6 text-muted-foreground">이름이 일치하는 교사는 자동 연결하고, 없는 교사는 모두 신규 추가 대상으로 선택합니다(공백 제외). 동명이인·다른 표기는 직접 연결하세요. 여러 과목은 함께 입력하며 창체·연강 화살표는 과목에서 제외합니다. 과목을 찾지 못한 경우 아래에서 확인하세요. 신규 교사는 기본 감독 상한 {defaultMax}회를 자동 적용합니다. 추가 후 교사 구분과 개인별 조건을 확인하세요. 파일에 없는 기존 교사는 삭제하지 않습니다.</p>
          {preview.errors.length > 0 && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><p className="font-semibold">오류 {preview.errors.length}건 — 현재 자료는 변경하지 않았습니다. 원본을 수정하고 다시 업로드하세요.</p><ul className="mt-2 list-disc pl-5">{preview.errors.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
          <div className="max-h-96 overflow-auto rounded-lg border"><table className="w-full min-w-[940px] text-sm"><thead className="sticky top-0 bg-muted"><tr>{['시간표 교사', '연결할 교사', '담당 과목 변경', '담임 변경', '수업 학급 변경', '주간 수업'].map(v => <th key={v} className="p-3 text-left">{v}</th>)}</tr></thead><tbody>{preview.rows.map((row, i) => {
            const existing = teachers.find(t => t.id === targets[i]);
            return <tr key={row.row} className="border-t"><td className="p-3">{row.name}<span className="block text-xs text-muted-foreground">{row.row}행</span></td><td className="p-3"><select className="field-select min-w-40" aria-label={`${row.name} 연결 교사`} value={targets[i] ?? ''} onChange={e => { setTargets(current => current.map((t, index) => index === i ? e.target.value : t)); setApproved(false); setError(''); }}><option value="">반영하지 않음</option><option value={NEW_TEACHER}>새 교사로 추가 (기본 {defaultMax}회)</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name} · {t.subject || '과목 없음'} · {t.homeroom || '비담임'}</option>)}</select></td><td className="p-3"><p className="text-muted-foreground">기존: {existing?.subject || '없음'}</p><p className="mt-1">{row.subject || (existing?.subject ? '과목 미확인 — 기존 값 유지' : '과목 미확인 — 추가 후 입력')}</p></td><td className="p-3 whitespace-nowrap">{existing?.homeroom || '없음'} → <b>{row.homeroom || '없음'}</b></td><td className="p-3 max-w-sm"><p className="text-muted-foreground">기존: {existing?.taughtClasses || '없음'}</p><p className="mt-1">변경: {row.taughtClasses || '없음'}</p></td><td className="p-3 whitespace-nowrap">{row.regularLessons ? row.regularLessons.split(",").length + "교시" : "없음"}</td></tr>;
          })}</tbody></table></div>
          <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#083f77]" checked={approved} onChange={e => setApproved(e.target.checked)} />선택한 교사의 이름·담당 과목·담임·수업 학급 교체와 미반영 행을 확인했습니다. 보관할 기존 자료는 ‘시험 자료 저장’으로 먼저 저장했습니다.</label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <DialogFooter><Button variant="outline" onClick={() => { setPreview(null); setError(''); }}>취소</Button><Button disabled={!approved || !selectedCount || preview.errors.length > 0} onClick={apply}>{selectedCount}명 반영</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </section>;
}
