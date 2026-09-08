'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { ExcelTeacher } from '@/lib/excel-schedule';
import { setAllTeacherMax } from '@/lib/default-supervision-max';

export function BulkTeacherMax({ teachers, defaultMax, onChange }: { teachers: ExcelTeacher[]; defaultMax: number; onChange: (teachers: ExcelTeacher[]) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [value, setValue] = useState('');
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState('');
  const valid = mode === 'auto' || (/^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)));
  const max = mode === 'auto' ? defaultMax : Number(value);
  function apply() {
    if (!valid || !approved || !teachers.length) return;
    onChange(setAllTeacherMax(teachers, max, mode === 'auto'));
    setNotice(teachers.length + '명의 감독 상한을 ' + max + '회로 적용했습니다.' + (mode === 'auto' ? ' 시험 일정에 따라 자동 변경됩니다.' : ' 이후 교사별로 조정할 수 있습니다.'));
    setOpen(false);
  }
  return <div>
    <Button variant="outline" disabled={!teachers.length} onClick={() => { setValue(String(defaultMax)); setMode('manual'); setApproved(false); setOpen(true); }}>전체 감독 상한 일괄 입력</Button>
    {notice && <p role="status" className="mt-2 text-sm text-primary">{notice}</p>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>전체 교사 감독 상한 설정</DialogTitle><DialogDescription>등록된 교사 {teachers.length}명 모두에게 적용합니다. 기존 개인별 감독 상한도 바뀌므로 적용 전에 확인하세요.</DialogDescription></DialogHeader>
        <label className="text-sm font-semibold">적용 방식<select className="field-select mt-2" value={mode} onChange={e => { setMode(e.target.value as 'manual' | 'auto'); setApproved(false); }}><option value="manual">입력한 횟수로 통일</option><option value="auto">전체 교사 기본값 사용</option></select></label>
        {mode === 'manual' ? <label className="text-sm font-semibold">감독 상한 (회)<Input className="mt-2" type="number" min={0} step={1} value={value} onChange={e => { setValue(e.target.value); setApproved(false); }} /><span className="mt-1 block font-normal text-muted-foreground">0은 감독을 배정하지 않음입니다. 0 이상의 정수를 입력하세요.</span></label> : <p className="rounded-lg bg-secondary p-3 text-sm">현재 기본값은 {defaultMax}회입니다. 자습을 제외한 시험 교시 수에 따라 자동 변경됩니다.</p>}
        {!valid && <p role="alert" className="text-sm text-red-700">0 이상의 정수를 입력하세요.</p>}
        <p className="text-sm leading-6 text-muted-foreground">감독 불가 시간, 하루 최대 횟수, 역할 제한 등 다른 개인별 조건은 유지합니다. 기존 감독표는 다시 편성하지 않으며, 상한 초과는 검증에 표시됩니다.</p>
        <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={approved} onChange={e => setApproved(e.target.checked)} />전체 교사의 기존 감독 상한을 변경하는 것을 확인했습니다.</label>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>취소</Button><Button disabled={!approved || !valid || !teachers.length} onClick={apply}>{teachers.length}명에게 적용</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
