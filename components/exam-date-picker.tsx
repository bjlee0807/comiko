'use client';

import { useState } from 'react';
import { ko } from 'date-fns/locale/ko';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { parseExamDate, formatExamDate } from '@/lib/exam-date';

export function ExamDatePicker({ value, year, onChange }: { value: string; year: number; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = parseExamDate(value, year);
  const baseYear = selected?.getFullYear() ?? year;
  return <div className="space-y-1.5"><span className="text-xs font-semibold text-muted-foreground">날짜</span><Button type="button" variant="outline" className="w-full justify-start font-normal" aria-label={`시험 날짜 선택: ${value || '미정'}`} onClick={() => setOpen(true)}><CalendarDays className="shrink-0" /><span className="truncate">{value || '날짜 선택'}</span></Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>시험 날짜 선택</DialogTitle><DialogDescription>연도와 월을 고른 뒤 날짜를 누르세요. 요일은 자동으로 입력됩니다.{value && !/^\d{4}/.test(value) ? ` 기존 날짜에는 연도가 없어 ${year}년을 기준으로 표시합니다. 필요하면 연도를 바꿔 주세요.` : ''}{value && !selected ? ` 기존 입력: ${value}` : ''}</DialogDescription></DialogHeader><Calendar className="mx-auto [--cell-size:2.5rem]" mode="single" required locale={ko} selected={selected} defaultMonth={selected ?? new Date(year, 0, 1)} captionLayout="dropdown" startMonth={new Date(Math.min(2000, baseYear - 5), 0, 1)} endMonth={new Date(Math.max(2100, baseYear + 5), 11, 31)} onSelect={(date) => { if (date) { onChange(formatExamDate(date)); setOpen(false); } }} /></DialogContent></Dialog></div>;
}
