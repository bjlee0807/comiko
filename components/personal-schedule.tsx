'use client';
import { useState } from 'react';
import { Printer, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ExamData } from '@/lib/exam-file';
import { personalSchedule, personalPrintDocument } from '@/lib/personal-schedule';

export function PersonalSchedule({ data, issueCount }: { data: ExamData; issueCount: number }) {
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [error, setError] = useState('');
  const teachers = [...data.teachers].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const teacher = teachers.find((teacher) => teacher.id === teacherId) ?? teachers[0];
  const rows = personalSchedule(data, teacher?.id ?? '');
  function printPersonal() {
    if (!teacher) return;
    setError('');
    const popup = window.open('', '_blank', 'width=900,height=750');
    if (!popup) { setError('인쇄 창을 열지 못했습니다. 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.'); return; }
    try {
      popup.opener = null;
      popup.document.open();
      popup.document.write(personalPrintDocument(data.name, teacher.name, rows, issueCount));
      popup.document.close();
      const button = popup.document.createElement('button');
      button.textContent = '인쇄 / PDF 저장';
      button.onclick = () => popup.print();
      popup.document.body.insertBefore(button, popup.document.body.firstChild);
      const help = popup.document.createElement('p');
      help.textContent = '위 버튼을 누른 뒤 프린터 또는 PDF로 저장을 선택하세요. 이 창은 연 시점의 일정표입니다.';
      help.className = 'print-help';
      const style = popup.document.createElement('style');
      style.textContent = '@media print{.print-help{display:none}}';
      popup.document.head.appendChild(style);
      popup.document.body.insertBefore(help, button.nextSibling);
      popup.focus();
    } catch { popup.close(); setError('인쇄 창을 준비하지 못했습니다. 일반 브라우저에서 다시 시도해 주세요.'); }
  }
  return <><Button variant="outline" disabled={!teachers.length} onClick={() => { setError(''); setOpen(true); }}><UserRound /> 교사 개인별 일정</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>교사 개인별 감독 일정</DialogTitle><DialogDescription>선택한 교사의 일정만 날짜·교시 순으로 표시합니다. 인쇄 창에서는 PDF로 저장할 수도 있습니다.</DialogDescription></DialogHeader><div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm font-semibold">교사 선택<select className="field-select mt-1" value={teacher?.id ?? ''} onChange={(event) => setTeacherId(event.target.value)}>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.subject || teacher.role}{teacher.homeroom ? ` · ${teacher.homeroom}` : ''}</option>)}</select></label><Button disabled={!teacher} onClick={printPersonal}><Printer /> 인쇄 / PDF 저장</Button></div><h3 className="font-bold">{data.name} · {teacher?.name ?? '등록 교사 없음'}</h3><p className="text-sm">총 {rows.length}회 · 정감독 {rows.filter((row) => row.duty === '정감독').length}회 · 부감독 {rows.filter((row) => row.duty === '부감독').length}회 · 자습감독 {rows.filter((row) => row.duty === '자습감독').length}회</p>{issueCount > 0 && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">전체 감독표에 확인할 항목이 {issueCount}건 있습니다. 배부 전 편성 검증을 확인하세요.</p>}<div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[540px] text-sm"><thead className="bg-muted"><tr>{['날짜', '교시', '고사실', '과목', '감독 역할'].map((label) => <th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t"><td className="p-3">{row.date}</td><td className="p-3">{row.period}</td><td className="p-3 font-semibold">{row.room}</td><td className="p-3">{row.subject}</td><td className="p-3">{row.duty}{row.locked && <span className="ml-1 text-muted-foreground">(고정)</span>}{row.duplicate && <span className="block font-semibold text-red-700">중복 확인</span>}</td></tr>)}{!rows.length && <tr><td colSpan={5} className="p-5 text-center text-muted-foreground">배정된 감독 일정이 없습니다.</td></tr>}</tbody></table></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</DialogContent></Dialog></>;
}
