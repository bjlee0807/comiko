'use client';

import { useState } from 'react';
import type { ExcelTeacher } from '@/lib/excel-schedule';
import { dailyLimit, dutyAllowed, lowLoadTeacher, forbiddenPair } from '@/lib/school-rules';
import { Input } from '@/components/ui/input';
const examSubjects = ['국어', '영어', '수학', '사회', '역사', '과학', '도덕', '기술가정', '정보', '체육', '음악', '미술', '중국어', '종교'];

export function TeacherRuleSettings({ teachers, onChange }: { teachers: ExcelTeacher[]; onChange: (teachers: ExcelTeacher[]) => void }) {
  const [selected, setSelected] = useState('');
  const teacher = teachers.find(t => t.id === selected) ?? teachers[0];
  function update(patch: Partial<ExcelTeacher>) {
    if (teacher) onChange(teachers.map(t => t.id === teacher.id ? { ...t, ...patch } : t));
  }
  function toggle(field: 'taughtClasses' | 'avoidTeachers', value: string) {
    if (!teacher) return;
    if (field === 'avoidTeachers') {
      const peer = teachers.find(t => t.id === value);
      if (!peer) return;
      const remove = forbiddenPair(teacher, peer);
      onChange(teachers.map(t => {
        if (t.id !== teacher.id && t.id !== peer.id) return t;
        const otherId = t.id === teacher.id ? peer.id : teacher.id;
        const ids = new Set((t.avoidTeachers ?? '').split(',').filter(Boolean));
        if (remove) ids.delete(otherId); else ids.add(otherId);
        return { ...t, avoidTeachers: [...ids].join(',') };
      }));
      return;
    }
    const values = new Set((teacher[field] ?? '').split(',').map(v => v.trim()).filter(Boolean));
    if (values.has(value)) values.delete(value); else values.add(value);
    update({ [field]: [...values].join(',') });
  }
  return <section id="teacher-rules" tabIndex={-1} className="scroll-mt-24 rounded-2xl border bg-card p-5 space-y-4">
    <div><h3 className="font-bold">학교 배정 조건 · 1단계</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">담임 학급·같은 학급 재배정 금지, 수업 학급 제외, 교사 조합 제한을 정·부감독에 적용합니다. 수동 배정의 위반 사항도 감독표에서 확인할 수 있습니다.</p></div>
    <details className="rounded-lg border p-3 text-sm leading-6"><summary className="cursor-pointer font-semibold">현재 적용되는 학교 공통 조건</summary><ul className="mt-2 list-disc pl-5 space-y-1">
      <li>함께 배정하지 않을 교사 조합과 개인별 감독 역할·하루 상한은 아래에서 직접 지정합니다. 이름으로 조건을 자동 적용하지 않습니다.</li>
      <li>성적담당은 하루 최대 1회입니다. 상담 등 별도 제한이 필요한 교사는 개인별 역할과 하루 상한을 설정하세요.</li>
      <li>비교과는 부감독만 배정합니다. 강사와 ‘교실 감독 제외’ 교사는 필요한 경우 복도감독 후보가 됩니다.</li>
      <li>교과교사를 먼저 배정하고, 성적담당은 1교시를 선호합니다. ‘감독 횟수 배려 대상’을 선택한 교사는 배정 우선순위를 낮춥니다. ‘젊은 교사와 함께 배정’은 나이순에서 뒤에 있는 일반 교사와 짝을 이룹니다.</li>
      <li>출제자는 학년·과목별로 교무실 대기 1명과 부감독 우선 1명을 지정할 수 있습니다. 같은 과목도 학년이 다르면 각각 별도로 설정하며, 교무실 대기도 감독 횟수 1회로 계산합니다.</li>
    </ul><p className="mt-2 text-muted-foreground">전체 교사 시간표를 올리면 시험을 보지 않는 학년의 정규수업을 감독 불가로 반영합니다. 시험 마지막 교시 뒤 타 학년 수업이 이어지는 담임은 정감독에서 제외하고 부감독만 허용합니다.</p></details>
    {!teacher ? <p className="text-sm">교사 명단을 먼저 입력하세요.</p> : <>
      <label className="block text-sm font-semibold">조건을 설정할 교사<select className="field-select mt-1" value={teacher.id} onChange={e => setSelected(e.target.value)}>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">개인별 감독 역할<select className="field-select mt-1" value={teacher.allowedDuty ?? 'both'} onChange={e => update({ allowedDuty: e.target.value as ExcelTeacher['allowedDuty'] })}><option value="both">정·부감독 (학교 공통 조건 우선)</option><option value="assistant">부감독만</option><option value="none">교실 감독 제외</option></select></label>
      <label className="text-sm font-semibold">하루 최대 횟수<Input className="mt-1" type="number" min={0} step={1} placeholder="추가 제한 없음" value={teacher.dailyMax ?? ''} onChange={e => { const value = e.target.value; if (value === '' || (Number.isSafeInteger(Number(value)) && Number(value) >= 0)) update({ dailyMax: value === '' ? undefined : Number(value) }); }} /></label></div>
      <p className="text-sm text-[#083f77]">실제 적용: {dutyAllowed(teacher, 'chief') ? '정·부감독' : dutyAllowed(teacher, 'assistant') ? '부감독만' : '교실 감독 제외'} · 하루 {Number.isFinite(dailyLimit(teacher)) ? dailyLimit(teacher) + '회 이하' : '추가 상한 없음'}{lowLoadTeacher(teacher) ? ' · 감독 횟수 배려 대상' : ''}</p>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[#083f77]" checked={teacher.lowLoad === true} onChange={e => update({ lowLoad: e.target.checked })} />감독 횟수 배려 대상</label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[#083f77]" checked={teacher.needsYoungPartner === true} onChange={e => update({ needsYoungPartner: e.target.checked })} />교실 감독은 젊은 교사와 함께 배정</label>
      <fieldset className="rounded-lg border bg-secondary/30 p-3"><legend className="px-1 text-sm font-semibold">학년별 출제자 설정</legend><p className="mb-3 text-sm text-muted-foreground">출제 학년·과목·역할을 함께 지정하세요. 같은 과목이라도 학년별 교무실 대기 1명과 부감독 우선 1명을 각각 설정합니다.</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">출제 학년<select className="field-select mt-1" value={teacher.setterGrade ?? ''} onChange={e => update({ setterGrade: e.target.value ? Number(e.target.value) as 1 | 2 | 3 : undefined })}><option value="">학년 선택</option><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option></select></label><label className="text-sm font-semibold">출제 과목<select className="field-select mt-1" value={teacher.setterSubject ?? ''} onChange={e => update(e.target.value ? { setterSubject: e.target.value, setterDuty: teacher.setterDuty ?? 'assistant' } : { setterSubject: undefined, setterGrade: undefined, setterDuty: undefined })}><option value="">출제자 아님</option>{examSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}</select></label><label className="text-sm font-semibold">시험 중 역할<select className="field-select mt-1" disabled={!teacher.setterSubject || !teacher.setterGrade} value={teacher.setterDuty ?? 'assistant'} onChange={e => update({ setterDuty: e.target.value as ExcelTeacher['setterDuty'] })}><option value="standby">교무실 대기</option><option value="assistant">부감독 우선</option></select></label></div>{teacher.setterSubject && !teacher.setterGrade && <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">기존 출제자 자료입니다. 출제 학년을 선택하면 학년별 규칙으로 반영됩니다.</p>}{teacher.setterSubject && teacher.setterGrade && <p className="mt-3 text-sm font-semibold text-[#075787]">현재 설정: {teacher.setterGrade}학년 {teacher.setterSubject} · {teacher.setterDuty === 'standby' ? '교무실 대기' : '부감독 우선'}</p>}</fieldset>
      <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">수업하는 학급 (정·부감독 배정 제외)</legend><p className="mb-3 text-sm text-muted-foreground">전체 교사 시간표에서 가져오거나, 이번 학기에 수업하는 반을 직접 체크하세요. 업로드한 내용을 수정할 수도 있습니다.</p><div className="space-y-3">{[1, 2, 3].map(grade => <div key={grade} className="flex flex-wrap gap-3"><span className="w-14 text-sm font-semibold">{grade}학년</span>{Array.from({ length: 10 }, (_, i) => `${grade}-${i + 1}`).map(room => <label key={room} className="flex gap-1.5 items-center text-sm"><input type="checkbox" className="size-4 accent-[#083f77]" checked={(teacher.taughtClasses ?? '').split(',').map(v => v.trim()).includes(room)} onChange={() => toggle('taughtClasses', room)} />{room}</label>)}</div>)}</div></fieldset>
      <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-semibold">함께 배정하지 않을 교사</summary><p className="mt-2 text-muted-foreground">체크하면 두 교사 모두에게 적용됩니다. 어느 쪽에서든 체크를 해제하면 조합 제한이 해제됩니다.</p><div className="mt-3 flex flex-wrap gap-4">{teachers.filter(t => t.id !== teacher.id).map(t => <label key={t.id} className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[#083f77]" checked={forbiddenPair(teacher, t)} onChange={() => toggle('avoidTeachers', t.id)} />{t.name}</label>)}</div></details>
      <p className="text-sm text-muted-foreground">입력한 이름과 개인별 조건은 이 브라우저에 저장하며, 앱 게시 코드에는 포함하지 않습니다. 시험 자료(JSON)로 저장하면 이름과 조건도 파일에 포함되므로 안전하게 보관하세요. 출력용 감독표 엑셀에는 포함되지 않습니다. 학기가 바뀌면 수업 학급을 다시 확인하세요. 교육공무직은 개인별 역할을 ‘교실 감독 제외’로 설정하세요.</p>
    </>}
  </section>;
}
