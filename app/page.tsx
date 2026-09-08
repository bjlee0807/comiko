'use client';
import { BulkTeacherMax } from '@/components/bulk-teacher-max';
import {
  examGradeSubjects,
  officeStandbyTeachers,
  setterAssistantForSession,
  setterAssistantAllowedRoom,
} from '@/lib/setter-rules';
import {
  hallwayGroups,
  hallwaySlotKey,
  roomNeedsAssistant,
} from '@/lib/hallway-supervision';
import {
  applyRegularLessonBlocks,
  regularLessonBlockedSessionIds,
} from '@/lib/regular-lesson-blocks';
import {
  countExamPeriods,
  applyDefaultMax,
} from '@/lib/default-supervision-max';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  UnlockKeyhole,
  Undo2,
  Plus,
  Printer,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  readRoster,
  applyRoster,
  downloadRosterTemplate,
  type RosterPreview,
} from '@/lib/teacher-roster';
import { readTeacherOrder } from '@/lib/teacher-order';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  readExamFile,
  downloadExamFile,
  copyForNextExam,
  type ExamData,
  type ExamFile,
} from '@/lib/exam-file';
import { ExamDatePicker } from '@/components/exam-date-picker';
import { examYear, examDateKey, formatExamDate } from '@/lib/exam-date';
import { PersonalSchedule } from '@/components/personal-schedule';
import { activeRooms, gradeParticipates, NO_EXAM } from '@/lib/session-grades';
import {
  schoolRuleReasons,
  lowLoadTeacher,
  youngerPartner,
} from '@/lib/school-rules';
import { TeacherTimetableUpload } from '@/components/teacher-timetable-upload';
import { TeacherRuleSettings } from '@/components/teacher-rule-settings';
import type { ExcelTeacher } from '@/lib/excel-schedule';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  exportScheduleWorkbook,
  importScheduleWorkbook,
} from '@/lib/excel-schedule';

type Role = '교과교사' | '강사' | '성적담당' | '비교과' | '교육공무직';
type Duty = 'chief' | 'assistant' | 'hallway';
type Teacher = ExcelTeacher;
type ExamSession = {
  id: string;
  date: string;
  period: string;
  grade1Subject: string;
  grade2Subject: string;
  grade3Subject: string;
  rooms: string;
  singleSupervision?: boolean;
};
type RoomAssignment = {
  chief: string;
  assistant: string;
  chiefLocked?: boolean;
  assistantLocked?: boolean;
};
type AssignmentMap = Record<string, RoomAssignment>;
type WorkspaceTab = 'sessions' | 'teachers' | 'schedule';

const roles: Role[] = ['교과교사', '강사', '성적담당', '비교과', '교육공무직'];
const subjects = [
  '국어',
  '영어',
  '수학',
  '사회',
  '역사',
  '과학',
  '도덕',
  '기술가정',
  '정보',
  '체육',
  '음악',
  '미술',
  '중국어',
  '종교',
];
const gradeRooms = [1, 2, 3].map((grade) => ({
  grade,
  label: `${grade}학년 교실`,
  rooms: Array.from({ length: 10 }, (_, index) => `${grade}-${index + 1}`),
}));
const specialRooms = [
  '과학실',
  '음악실',
  '미술실',
  '컴퓨터실',
  '도서실',
  '시청각실',
  '다목적실',
];
const fixedRooms = [
  ...gradeRooms.flatMap((group) => group.rooms),
  ...specialRooms,
];
const homerooms = gradeRooms.flatMap((group) => group.rooms);
const initialTeachers: Teacher[] = [
  {
    id: 't1',
    name: '김가람',
    subject: '국어',
    homeroom: '2-1',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't2',
    name: '이누리',
    subject: '수학',
    homeroom: '2-2',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't3',
    name: '박다온',
    subject: '과학',
    homeroom: '2-3',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't4',
    name: '최라온',
    subject: '영어',
    homeroom: '2-4',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: 's3',
  },
  {
    id: 't5',
    name: '정마루',
    subject: '사회',
    homeroom: '3-1',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't6',
    name: '윤보람',
    subject: '역사',
    homeroom: '3-2',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't7',
    name: '오새봄',
    subject: '도덕',
    homeroom: '3-3',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't8',
    name: '한아람',
    subject: '기술',
    homeroom: '3-4',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't9',
    name: '송이든',
    subject: '국어',
    homeroom: '',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't10',
    name: '임지음',
    subject: '영어',
    homeroom: '',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't11',
    name: '조하람',
    subject: '음악',
    homeroom: '',
    role: '강사',
    max: 2,
    autoMax: true,
    unavailable: 's1',
  },
  {
    id: 't12',
    name: '배해솔',
    subject: '',
    homeroom: '',
    role: '성적담당',
    max: 2,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't13',
    name: '강누리',
    subject: '보건',
    homeroom: '',
    role: '비교과',
    max: 2,
    autoMax: true,
    unavailable: '',
  },
  {
    id: 't14',
    name: '서다솜',
    subject: '체육',
    homeroom: '',
    role: '교과교사',
    max: 4,
    autoMax: true,
    unavailable: '',
  },
];
const initialSessions: ExamSession[] = [
  {
    id: 's1',
    date: '4/27(월)',
    period: '1교시',
    grade1Subject: '자습',
    grade2Subject: '국어',
    grade3Subject: '국어',
    rooms: '2-1, 2-2, 3-1, 3-2',
  },
  {
    id: 's2',
    date: '4/27(월)',
    period: '2교시',
    grade1Subject: '자습',
    grade2Subject: '과학',
    grade3Subject: '과학',
    rooms: '2-1, 2-2, 3-1, 3-2',
  },
  {
    id: 's3',
    date: '4/28(화)',
    period: '1교시',
    grade1Subject: '자습',
    grade2Subject: '자습',
    grade3Subject: '사회',
    rooms: '2-1, 2-2, 3-1, 3-2',
  },
];
const STORAGE_KEY = 'exam-supervisor-planner-v1';

function roomOrder(room: string) {
  const match = room.match(/^([1-3])-(\d+)$/);
  if (match) return Number(match[1]) * 100 + Number(match[2]);
  const specialIndex = specialRooms.indexOf(room);
  return 1000 + (specialIndex < 0 ? specialRooms.length : specialIndex);
}
function selectedRoomList(session: ExamSession) {
  return session.rooms
    .split(',')
    .map((room) => room.trim())
    .filter(Boolean);
}
function roomList(session: ExamSession) {
  return activeRooms(session).sort(
    (a, b) => roomOrder(a) - roomOrder(b) || a.localeCompare(b, 'ko'),
  );
}
function subjectForRoom(session: ExamSession, room: string) {
  if (room.startsWith('1-')) return session.grade1Subject;
  if (room.startsWith('2-')) return session.grade2Subject;
  if (room.startsWith('3-')) return session.grade3Subject;
  return '특별실';
}
function unavailableIds(teacher: Teacher) {
  return teacher.unavailable
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
function slotKey(sessionId: string, room: string) {
  return `${sessionId}::${room}`;
}
function assignmentField(duty: Duty) {
  return duty === 'assistant' ? ('assistant' as const) : ('chief' as const);
}
function lockField(duty: Duty) {
  return duty === 'assistant'
    ? ('assistantLocked' as const)
    : ('chiefLocked' as const);
}
function defaultAssignments(sessions: ExamSession[]): AssignmentMap {
  const result: AssignmentMap = {};
  sessions.forEach((session) => {
    roomList(session).forEach((room) => {
      result[slotKey(session.id, room)] = { chief: '', assistant: '' };
    });
    hallwayGroups(session).forEach((group) => {
      result[hallwaySlotKey(session.id, group.id)] = {
        chief: '',
        assistant: '',
      };
    });
  });
  return result;
}

function sameAssignments(left: AssignmentMap, right: AssignmentMap) {
  return JSON.stringify(left) === JSON.stringify(right);
}

type ScheduleIssue = { kind: string; message: string; target: string };
const issueKinds = [
  '미배정',
  '중복 배정',
  '감독 불가',
  '교과 충돌',
  '담임 학급',
  '횟수 초과',
  '학교 조건',
  '설정 확인',
];
function validateSchedule(
  teachers: Teacher[],
  sessions: ExamSession[],
  assignments: AssignmentMap,
  excludeHomeroom: boolean,
  year = new Date().getFullYear(),
): ScheduleIssue[] {
  const found: ScheduleIssue[] = [];
  const byTime = new Map<
    string,
    Map<string, { target: string; place: string }[]>
  >();
  const byTeacher = new Map<string, { target: string; place: string }[]>();
  teachers
    .filter((teacher) => teacher.needsYoungPartner)
    .forEach((teacher) => {
      if (
        !teachers.some((candidate) =>
          youngerPartner(teacher, candidate, teachers),
        )
      )
        found.push({
          kind: '설정 확인',
          message: `${teacher.name}: 나이순에서 뒤에 있는 젊은 일반 교사가 없습니다. 명단 순서 또는 배려 대상 설정을 확인하세요.`,
          target: 'teacher-rules',
        });
    });
  teachers
    .filter(
      (teacher) =>
        teacher.setterSubject && teacher.setterDuty && !teacher.setterGrade,
    )
    .forEach((teacher) => {
      found.push({
        kind: '설정 확인',
        message: `${teacher.name}: 출제 학년을 선택하세요. 같은 과목도 학년별로 출제자를 구분합니다.`,
        target: 'teacher-rules',
      });
    });
  sessions.forEach((session) => {
    const configuredSetters = teachers.some((teacher) => teacher.setterSubject);
    if (configuredSetters)
      examGradeSubjects(session).forEach(({ grade, subject }) => {
        const standby = teachers.filter(
          (teacher) =>
            teacher.setterGrade === grade &&
            teacher.setterSubject === subject &&
            teacher.setterDuty === 'standby',
        );
        const assistants = teachers.filter(
          (teacher) =>
            teacher.setterGrade === grade &&
            teacher.setterSubject === subject &&
            teacher.setterDuty === 'assistant',
        );
        if (standby.length !== 1)
          found.push({
            kind: '설정 확인',
            message: `${session.date} ${session.period} · ${grade}학년 ${subject}: 교무실 대기 출제자를 1명 지정하세요. 현재 ${standby.length}명입니다.`,
            target: 'session-' + session.id,
          });
        if (assistants.length !== 1)
          found.push({
            kind: '설정 확인',
            message: `${session.date} ${session.period} · ${grade}학년 ${subject}: 부감독 출제자를 1명 지정하세요. 현재 ${assistants.length}명입니다.`,
            target: 'session-' + session.id,
          });
      });
    const time = examDateKey(session.date, year) + ' ' + session.period.trim();
    if (!roomList(session).length)
      found.push({
        kind: '설정 확인',
        message: time + ': 선택한 고사실이 없습니다. 시험 설정을 확인하세요.',
        target: 'session-' + session.id,
      });
    const used =
      byTime.get(time) ??
      new Map<string, { target: string; place: string }[]>();
    byTime.set(time, used);
    officeStandbyTeachers(session, teachers).forEach((teacher) => {
      const entry = {
        target: 'session-' + session.id,
        place: time + ' · 교무실 대기',
      };
      used.set(teacher.id, [...(used.get(teacher.id) ?? []), entry]);
      byTeacher.set(teacher.id, [...(byTeacher.get(teacher.id) ?? []), entry]);
      if (unavailableIds(teacher).includes(session.id))
        found.push({
          kind: '감독 불가',
          message:
            entry.place +
            ' — ' +
            teacher.name +
            ' 선생님의 감독 불가 시간입니다.',
          target: entry.target,
        });
    });
    roomList(session).forEach((room) => {
      const target = 'assignment-' + slotKey(session.id, room);
      const item = assignments[slotKey(session.id, room)];
      const subject = subjectForRoom(session, room);
      const duties: Duty[] = roomNeedsAssistant(session, subject)
        ? ['chief', 'assistant']
        : ['chief'];
      duties.forEach((duty) => {
        const place =
          time +
          ' · ' +
          room +
          ' · ' +
          (duty === 'chief'
            ? subject === '자습'
              ? '자습감독'
              : '정감독'
            : '부감독');
        const add = (kind: string, message: string) =>
          found.push({ kind, message: place + ' — ' + message, target });
        const teacher = teachers.find(
          (t) => t.id === item?.[assignmentField(duty)],
        );
        if (!teacher) {
          add('미배정', '교사를 배정하세요.');
          return;
        }
        schoolRuleReasons(
          teacher,
          session,
          room,
          duty,
          teachers,
          sessions,
          assignments,
          year,
        ).forEach((reason) => add('학교 조건', teacher.name + ' — ' + reason));
        const entry = { target, place };
        used.set(teacher.id, [...(used.get(teacher.id) ?? []), entry]);
        byTeacher.set(teacher.id, [
          ...(byTeacher.get(teacher.id) ?? []),
          entry,
        ]);
        const unavailable = sessions.some(
          (other) =>
            examDateKey(other.date, year) + ' ' + other.period.trim() ===
              time && unavailableIds(teacher).includes(other.id),
        );
        if (unavailable)
          add('감독 불가', teacher.name + ' 선생님의 감독 불가 시간입니다.');
        if (
          subject !== '자습' &&
          teacher.subject
            .split(/[,/]/)
            .map((v) => v.trim())
            .includes(subject) &&
          !setterAssistantAllowedRoom(teacher, session, room)
        )
          add('교과 충돌', teacher.name + ' 선생님의 담당 과목 시험입니다.');
        if (teacher.homeroom === room)
          add('담임 학급', teacher.name + ' 선생님의 담임 학급입니다.');
      });
    });
    hallwayGroups(session).forEach((group) => {
      const key = hallwaySlotKey(session.id, group.id);
      const target = 'assignment-' + key;
      const place = time + ' · ' + group.label + ' · 복도감독';
      const add = (kind: string, message: string) =>
        found.push({ kind, message: place + ' — ' + message, target });
      const teacher = teachers.find(
        (item) => item.id === assignments[key]?.chief,
      );
      if (!teacher) {
        add('미배정', '교사를 배정하세요.');
        return;
      }
      schoolRuleReasons(
        teacher,
        session,
        group.label,
        'hallway',
        teachers,
        sessions,
        assignments,
        year,
      ).forEach((reason) => add('학교 조건', teacher.name + ' — ' + reason));
      const entry = { target, place };
      used.set(teacher.id, [...(used.get(teacher.id) ?? []), entry]);
      byTeacher.set(teacher.id, [...(byTeacher.get(teacher.id) ?? []), entry]);
      const unavailable = sessions.some(
        (other) =>
          examDateKey(other.date, year) + ' ' + other.period.trim() === time &&
          unavailableIds(teacher).includes(other.id),
      );
      if (unavailable)
        add('감독 불가', teacher.name + ' 선생님의 감독 불가 시간입니다.');
    });
  });
  byTime.forEach((used) =>
    used.forEach((places, teacherId) => {
      if (places.length < 2) return;
      const name = teachers.find((t) => t.id === teacherId)?.name;
      places.forEach((entry) =>
        found.push({
          kind: '중복 배정',
          message:
            entry.place +
            ' — ' +
            name +
            ' 선생님이 같은 시간에 ' +
            places.length +
            '곳 배정되었습니다.',
          target: entry.target,
        }),
      );
    }),
  );
  teachers.forEach((teacher) => {
    const places = byTeacher.get(teacher.id) ?? [];
    if (places.length > teacher.max)
      found.push({
        kind: '횟수 초과',
        message:
          teacher.name +
          ': ' +
          places.length +
          '회 배정 / 상한 ' +
          teacher.max +
          '회. 배정 또는 교사 설정을 조정하세요.',
        target: places[0].target,
      });
  });
  return found;
}

export default function Home() {
  const [teacherRecords, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [sessions, setSessions] = useState<ExamSession[]>(initialSessions);
  const [assignments, setAssignments] = useState<AssignmentMap>(() =>
    defaultAssignments(initialSessions),
  );
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentMap[]>(
    [],
  );
  const assignmentVariantRef = useRef(0);
  const [excludeHomeroom, setExcludeHomeroom] = useState(true);
  const [notice, setNotice] = useState(
    '예시 자료가 준비되었습니다. 자동 편성을 실행해 보세요.',
  );
  const [loaded, setLoaded] = useState(false);
  const [isExcelBusy, setIsExcelBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('sessions');
  const rosterInputRef = useRef<HTMLInputElement>(null);
  const teacherOrderInputRef = useRef<HTMLInputElement>(null);
  const [teacherOrderError, setTeacherOrderError] = useState('');
  const [rosterPreview, setRosterPreview] = useState<RosterPreview | null>(
    null,
  );
  const [rosterMode, setRosterMode] = useState<'merge' | 'replace'>('merge');
  const [rosterError, setRosterError] = useState('');
  const [examName, setExamName] = useState('이름 없는 시험');
  const defaultMax = useMemo(
    () => countExamPeriods(sessions, examYear(examName)),
    [sessions, examName],
  );
  const teachers = useMemo(
    () =>
      applyRegularLessonBlocks(
        applyDefaultMax(teacherRecords, defaultMax),
        sessions,
        examYear(examName),
      ),
    [teacherRecords, defaultMax, sessions, examName],
  );
  const regularLessonStatus = useMemo(() => {
    let blockedTeacherCount = 0;
    let blockedSlotCount = 0;
    let timetableTeacherCount = 0;
    teachers.forEach((teacher) => {
      if (teacher.regularLessons?.trim()) timetableTeacherCount += 1;
      const blocked = regularLessonBlockedSessionIds(
        teacher,
        sessions,
        examYear(examName),
      ).length;
      if (blocked > 0) blockedTeacherCount += 1;
      blockedSlotCount += blocked;
    });
    return { timetableTeacherCount, blockedTeacherCount, blockedSlotCount };
  }, [teachers, sessions, examName]);
  const removedTeachers = rosterPreview
    ? teachers.filter(
        (teacher) =>
          !rosterPreview.rows.some(
            (row) =>
              row.name.replace(/\s+/g, '') === teacher.name.replace(/\s+/g, ''),
          ),
      )
    : [];

  const [examError, setExamError] = useState('');
  const [draftError, setDraftError] = useState('');
  const [pendingExam, setPendingExam] = useState<ExamFile | null>(null);
  const [nextExamOpen, setNextExamOpen] = useState(false);
  const [nextExamName, setNextExamName] = useState('');
  const [replacementApproved, setReplacementApproved] = useState(false);
  const [previousExam, setPreviousExam] = useState<ExamData | null>(null);
  const examFileRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setExamName(
          typeof data.examName === 'string' ? data.examName : '기존 시험 자료',
        );
        setTeachers(data.teachers ?? initialTeachers);
        const savedSessions = (data.sessions ?? initialSessions).map(
          (session: ExamSession) => ({
            ...session,
            grade1Subject: session.grade1Subject ?? '자습',
          }),
        );
        setSessions(savedSessions);
        setAssignments(data.assignments ?? defaultAssignments(savedSessions));
        setExcludeHomeroom(data.excludeHomeroom ?? true);
      }
    } catch {
      setNotice('저장된 자료를 읽지 못해 예시 자료로 시작했습니다.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          teachers,
          sessions,
          assignments,
          excludeHomeroom,
          examName,
        }),
      );
      setDraftError('');
    } catch {
      setDraftError(
        '임시 저장 공간이 부족하거나 사용할 수 없습니다. 시험 자료 파일로 저장해 주세요.',
      );
    }
  }, [teachers, sessions, assignments, excludeHomeroom, examName, loaded]);

  useEffect(() => {
    if (!loaded) return;
    setAssignments((current) => {
      const next = defaultAssignments(sessions);
      sessions.forEach((session) =>
        roomList(session).forEach((room) => {
          const key = slotKey(session.id, room);
          const saved = current[key];
          if (!saved) return;
          const chief = teachers.some((teacher) => teacher.id === saved.chief)
            ? saved.chief
            : '';
          const assistant =
            roomNeedsAssistant(session, subjectForRoom(session, room)) &&
            teachers.some((teacher) => teacher.id === saved.assistant)
              ? saved.assistant
              : '';
          next[key] = {
            chief,
            assistant,
            chiefLocked: Boolean(chief && saved.chiefLocked),
            assistantLocked: Boolean(assistant && saved.assistantLocked),
          };
        }),
      );
      sessions.forEach((session) =>
        hallwayGroups(session).forEach((group) => {
          const key = hallwaySlotKey(session.id, group.id);
          const saved = current[key];
          if (!saved) return;
          const chief = teachers.some((teacher) => teacher.id === saved.chief)
            ? saved.chief
            : '';
          next[key] = {
            chief,
            assistant: '',
            chiefLocked: Boolean(chief && saved.chiefLocked),
          };
        }),
      );
      return next;
    });
  }, [sessions, teachers, loaded]);

  useEffect(() => {
    setAssignmentHistory([]);
  }, [sessions, teachers, excludeHomeroom]);

  function rememberAssignments() {
    setAssignmentHistory((current) => {
      if (current.length && sameAssignments(current.at(-1)!, assignments))
        return current;
      return [...current.slice(-19), structuredClone(assignments)];
    });
  }
  function updateAssignment(key: string, duty: Duty, value: string) {
    const item = assignments[key] ?? { chief: '', assistant: '' };
    if (item[lockField(duty)]) return;
    rememberAssignments();
    setAssignments((current) => ({
      ...current,
      [key]: { ...item, [assignmentField(duty)]: value },
    }));
  }
  function toggleAssignmentLock(key: string, duty: Duty) {
    const item = assignments[key];
    if (!item?.[assignmentField(duty)]) return;
    const field = lockField(duty);
    rememberAssignments();
    setAssignments((current) => ({
      ...current,
      [key]: { ...item, [field]: !item[field] },
    }));
  }
  function undoAssignment() {
    let previousIndex = assignmentHistory.length - 1;
    while (
      previousIndex >= 0 &&
      sameAssignments(assignmentHistory[previousIndex], assignments)
    )
      previousIndex -= 1;
    const previous = assignmentHistory[previousIndex];
    if (!previous) {
      setNotice('되돌릴 이전 편성 결과가 없습니다.');
      return;
    }
    setAssignments(previous);
    setAssignmentHistory((current) => current.slice(0, previousIndex));
    assignmentVariantRef.current = 0;
    setActiveTab('schedule');
    setNotice('직전 편성 또는 배정 변경을 되돌렸습니다.');
  }

  function clearUnlockedAssignments() {
    const next = defaultAssignments(sessions);
    Object.entries(assignments).forEach(([key, current]) => {
      if (!next[key]) return;
      if (current.chiefLocked && current.chief)
        Object.assign(next[key], { chief: current.chief, chiefLocked: true });
      if (current.assistantLocked && current.assistant)
        Object.assign(next[key], {
          assistant: current.assistant,
          assistantLocked: true,
        });
    });
    if (sameAssignments(next, assignments)) {
      setNotice('초기화할 미고정 배정이 없습니다.');
      return;
    }
    rememberAssignments();
    setAssignments(next);
    assignmentVariantRef.current = 0;
    setActiveTab('schedule');
    setNotice('고정 배정은 유지하고 나머지 배정을 초기화했습니다.');
  }

  const counts = useMemo(() => {
    const result = Object.fromEntries(
      teachers.map((teacher) => [
        teacher.id,
        { total: 0, chief: 0, assistant: 0, hallway: 0, standby: 0 },
      ]),
    );
    sessions.forEach((session) => {
      officeStandbyTeachers(session, teachers).forEach((teacher) => {
        if (result[teacher.id]) {
          result[teacher.id].total += 1;
          result[teacher.id].standby += 1;
        }
      });
      roomList(session).forEach((room) => {
        const assignment = assignments[slotKey(session.id, room)] ?? {
          chief: '',
          assistant: '',
        };
        const duties: Duty[] = roomNeedsAssistant(
          session,
          subjectForRoom(session, room),
        )
          ? ['chief', 'assistant']
          : ['chief'];
        duties.forEach((duty) => {
          const id = assignment[assignmentField(duty)];
          if (id && result[id]) {
            result[id].total += 1;
            result[id][duty] += 1;
          }
        });
      });
      hallwayGroups(session).forEach((group) => {
        const id = assignments[hallwaySlotKey(session.id, group.id)]?.chief;
        if (id && result[id]) {
          result[id].total += 1;
          result[id].hallway += 1;
        }
      });
    });
    return result;
  }, [assignments, sessions, teachers]);

  const issues = useMemo(
    () =>
      validateSchedule(
        teachers,
        sessions,
        assignments,
        excludeHomeroom,
        examYear(examName),
      ),
    [teachers, sessions, assignments, excludeHomeroom, examName],
  );
  const [issueFilter, setIssueFilter] = useState('전체');
  const visibleIssues = issues.filter(
    (issue) => issueFilter === '전체' || issue.kind === issueFilter,
  );
  function goToIssue(target: string) {
    const row = document.getElementById(target);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.focus({ preventScroll: true });
  }

  const assignedCount = sessions.reduce(
    (sum, session) =>
      sum +
      roomList(session).reduce((roomSum, room) => {
        const item = assignments[slotKey(session.id, room)] ?? {
          chief: '',
          assistant: '',
        };
        return (
          roomSum +
          Number(Boolean(item.chief)) +
          (roomNeedsAssistant(session, subjectForRoom(session, room))
            ? Number(Boolean(item.assistant))
            : 0)
        );
      }, 0) +
      hallwayGroups(session).reduce(
        (hallwaySum, group) =>
          hallwaySum +
          Number(
            Boolean(assignments[hallwaySlotKey(session.id, group.id)]?.chief),
          ),
        0,
      ),
    0,
  );
  const requiredCount = sessions.reduce(
    (sum, session) =>
      sum +
      roomList(session).reduce(
        (roomSum, room) =>
          roomSum +
          (roomNeedsAssistant(session, subjectForRoom(session, room)) ? 2 : 1),
        0,
      ) +
      hallwayGroups(session).length,
    0,
  );

  function autoAssign(alternate = false) {
    const variant = alternate ? assignmentVariantRef.current + 1 : 0;
    assignmentVariantRef.current = variant;
    const next = defaultAssignments(sessions);
    const year = examYear(examName);
    const timeKey = (session: ExamSession) =>
      examDateKey(session.date, year) + ' ' + session.period.trim();
    const totals = Object.fromEntries(
      teachers.map((teacher) => [
        teacher.id,
        { total: 0, chief: 0, assistant: 0, hallway: 0, standby: 0 },
      ]),
    );
    const assignedBySession: Record<string, Set<string>> = {};
    sessions.forEach((session) => {
      const time = timeKey(session);
      assignedBySession[time] ??= new Set<string>();
      officeStandbyTeachers(session, teachers).forEach((teacher) => {
        assignedBySession[time].add(teacher.id);
        totals[teacher.id].total += 1;
        totals[teacher.id].standby += 1;
      });
    });
    const slots = sessions.flatMap((session) => [
      ...roomList(session).flatMap((room) =>
        roomNeedsAssistant(session, subjectForRoom(session, room))
          ? [
              {
                session,
                room,
                key: slotKey(session.id, room),
                duty: 'chief' as Duty,
              },
              {
                session,
                room,
                key: slotKey(session.id, room),
                duty: 'assistant' as Duty,
              },
            ]
          : [
              {
                session,
                room,
                key: slotKey(session.id, room),
                duty: 'chief' as Duty,
              },
            ],
      ),
      ...hallwayGroups(session).map((group) => ({
        session,
        room: group.label,
        key: hallwaySlotKey(session.id, group.id),
        duty: 'hallway' as Duty,
      })),
    ]);
    const eligible = (
      teacher: Teacher,
      session: ExamSession,
      room: string,
      duty: Duty,
    ) => {
      const subject = duty === 'hallway' ? '' : subjectForRoom(session, room);
      const teachesSubject =
        duty !== 'hallway' &&
        subject !== '자습' &&
        teacher.subject
          .split(/[,/]/)
          .map((v) => v.trim())
          .includes(subject) &&
        !setterAssistantAllowedRoom(teacher, session, room);
      return (
        !teachesSubject &&
        !sessions.some(
          (other) =>
            timeKey(other) === timeKey(session) &&
            unavailableIds(teacher).includes(other.id),
        ) &&
        (duty === 'hallway' || teacher.homeroom !== room) &&
        !assignedBySession[timeKey(session)]?.has(teacher.id) &&
        totals[teacher.id].total < teacher.max &&
        schoolRuleReasons(
          teacher,
          session,
          room,
          duty,
          teachers,
          sessions,
          next,
          year,
        ).length === 0
      );
    };
    const lockErrors: string[] = [];
    slots.forEach(({ session, room, key, duty }) => {
      const saved = assignments[key];
      const locked = saved?.[lockField(duty)];
      if (!locked) return;
      const teacher = teachers.find(
        (item) => item.id === saved[assignmentField(duty)],
      );
      if (!teacher || !eligible(teacher, session, room, duty)) {
        lockErrors.push(
          `${session.date} ${session.period} ${room} ${duty === 'chief' ? '정감독' : duty === 'assistant' ? '부감독' : '복도감독'}`,
        );
        return;
      }
      assignedBySession[timeKey(session)] ??= new Set<string>();
      assignedBySession[timeKey(session)].add(teacher.id);
      next[key][assignmentField(duty)] = teacher.id;
      next[key][lockField(duty)] = true;
      totals[teacher.id].total += 1;
      totals[teacher.id][duty] += 1;
    });
    if (lockErrors.length) {
      setActiveTab('schedule');
      setNotice(
        `고정 배정 충돌 ${lockErrors.length}건: ${lockErrors.slice(0, 3).join(', ')}. 고정을 해제하거나 조건을 수정하세요. 기존 감독표는 유지했습니다.`,
      );
      return;
    }
    slots.sort(
      (a, b) =>
        teachers.filter((teacher) =>
          eligible(teacher, a.session, a.room, a.duty),
        ).length -
          teachers.filter((teacher) =>
            eligible(teacher, b.session, b.room, b.duty),
          ).length || (a.duty === 'chief' ? -1 : 1),
    );
    slots.forEach(({ session, room, key, duty }) => {
      if (next[key][assignmentField(duty)]) return;
      assignedBySession[timeKey(session)] ??= new Set<string>();
      const candidates = teachers.filter((teacher) =>
        eligible(teacher, session, room, duty),
      );
      const candidateScore = (teacher: Teacher) =>
        (setterAssistantForSession(teacher, session) && duty === 'assistant'
          ? -4
          : 0) +
        totals[teacher.id].total / Math.max(teacher.max, 1) +
        totals[teacher.id][duty] * 0.12 +
        (teacher.role === '교과교사' ? 0 : 10) +
        (lowLoadTeacher(teacher) ? 2 : 0) +
        (teacher.role === '성적담당' &&
        !/^1(?:교시)?$/.test(session.period.trim())
          ? 1
          : 0);
      candidates.sort((a, b) => {
        return (
          candidateScore(a) - candidateScore(b) ||
          a.name.localeCompare(b.name, 'ko')
        );
      });
      const bestScore = candidates[0]
        ? candidateScore(candidates[0])
        : Infinity;
      const comparable = variant
        ? candidates.filter(
            (teacher) => candidateScore(teacher) <= bestScore + 0.35,
          )
        : candidates.slice(0, 1);
      const slotOffset = [...key].reduce(
        (sum, character) => sum + character.charCodeAt(0),
        0,
      );
      const chosen = comparable.length
        ? comparable[(variant + slotOffset) % comparable.length]
        : undefined;
      if (!chosen) return;
      next[key][assignmentField(duty)] = chosen.id;
      totals[chosen.id].total += 1;
      totals[chosen.id][duty] += 1;
      assignedBySession[timeKey(session)].add(chosen.id);
    });
    if (sameAssignments(next, assignments)) {
      setActiveTab('schedule');
      setNotice(
        alternate
          ? '현재 조건에서 다른 편성안을 만들 수 없었습니다. 조건이나 고정 배정을 조정해 보세요.'
          : '현재 조건이 같아 기존 편성 결과와 동일합니다. 다른 결과는 ‘다른 편성안’을 눌러 보세요.',
      );
      return;
    }
    rememberAssignments();
    setAssignments(next);
    setActiveTab('schedule');
    const filled = sessions.reduce(
      (sum, session) =>
        sum +
        roomList(session).reduce((roomSum, room) => {
          const item = next[slotKey(session.id, room)];
          return (
            roomSum +
            Number(Boolean(item.chief)) +
            (roomNeedsAssistant(session, subjectForRoom(session, room))
              ? Number(Boolean(item.assistant))
              : 0)
          );
        }, 0) +
        hallwayGroups(session).reduce(
          (hallwaySum, group) =>
            hallwaySum +
            Number(Boolean(next[hallwaySlotKey(session.id, group.id)]?.chief)),
          0,
        ),
      0,
    );
    setNotice(
      filled === requiredCount
        ? '모든 감독 자리를 조건에 맞춰 편성했습니다.'
        : `${requiredCount - filled}자리를 채우지 못했습니다. 현재 편성 순서에서 가능한 교사가 부족합니다. 불가 시간·수업 학급·상한을 확인하세요. 가능한 배정이 전혀 없다는 뜻은 아닙니다.`,
    );
  }

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: {
              name: string;
              title: string;
              description: string;
              inputSchema: object;
              annotations: {
                readOnlyHint: boolean;
                untrustedContentHint: boolean;
              };
              execute: () => Promise<object>;
            },
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      modelContext.registerTool(
        {
          name: 'generate_exam_supervision_schedule',
          title: '시험감독 자동 편성',
          description:
            '현재 입력된 교사, 시험 시간, 예외 조건을 사용해 감독표를 자동 편성합니다.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute() {
            const button = document.querySelector<HTMLButtonElement>(
              '[data-action="auto-assign"]',
            );
            if (!button)
              throw new Error('자동 편성 기능을 사용할 수 없습니다.');
            button.click();
            await Promise.resolve();
            return {
              status: 'completed',
              sessionCount: sessions.length,
              requiredAssignments: requiredCount,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [requiredCount, sessions.length]);

  function updateTeacher(
    id: string,
    field: keyof Teacher,
    value: string | number | boolean,
  ) {
    setTeachers((current) =>
      current.map((teacher) =>
        teacher.id === id
          ? {
              ...teacher,
              [field]: value,
              ...(field === 'max' ? { autoMax: false } : {}),
            }
          : teacher,
      ),
    );
  }
  function toggleUnavailable(teacherId: string, sessionId: string) {
    setTeachers((current) =>
      current.map((teacher) => {
        if (teacher.id !== teacherId) return teacher;
        const automatic = new Set(
          regularLessonBlockedSessionIds(teacher, sessions, examYear(examName)),
        );
        if (automatic.has(sessionId)) return teacher;
        const blocked = new Set(
          (teacher.manualUnavailable ?? teacher.unavailable)
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        );
        if (blocked.has(sessionId)) blocked.delete(sessionId);
        else blocked.add(sessionId);
        const unavailable = [...blocked].join(', ');
        return { ...teacher, manualUnavailable: unavailable, unavailable };
      }),
    );
  }
  function updateSession(id: string, field: keyof ExamSession, value: string) {
    setSessions((current) =>
      current.map((session) =>
        session.id === id ? { ...session, [field]: value } : session,
      ),
    );
  }
  function setSessionRooms(id: string, rooms: string[]) {
    updateSession(
      id,
      'rooms',
      [...new Set(rooms)]
        .sort((a, b) => roomOrder(a) - roomOrder(b) || a.localeCompare(b, 'ko'))
        .join(', '),
    );
  }
  function toggleGrade(session: ExamSession, grade: number) {
    const field =
      grade === 1
        ? 'grade1Subject'
        : grade === 2
          ? 'grade2Subject'
          : 'grade3Subject';
    updateSession(
      session.id,
      field,
      gradeParticipates(session, grade) ? NO_EXAM : '자습',
    );
  }
  function toggleRoom(session: ExamSession, room: string) {
    const selected = new Set(selectedRoomList(session));
    if (selected.has(room)) selected.delete(room);
    else selected.add(room);
    setSessionRooms(session.id, [...selected]);
  }
  function toggleRoomGroup(session: ExamSession, rooms: string[]) {
    const selected = new Set(selectedRoomList(session));
    const allSelected = rooms.every((room) => selected.has(room));
    rooms.forEach((room) => {
      if (allSelected) selected.delete(room);
      else selected.add(room);
    });
    setSessionRooms(session.id, [...selected]);
  }
  function updateCustomRooms(session: ExamSession, value: string) {
    const selectedFixed = selectedRoomList(session).filter((room) =>
      fixedRooms.includes(room),
    );
    const custom = value
      .split(',')
      .map((room) => room.trim())
      .filter(Boolean);
    setSessionRooms(session.id, [...selectedFixed, ...custom]);
  }
  function addTeacher() {
    const id = `t${Date.now()}`;
    setTeachers((current) => [
      ...current,
      {
        id,
        name: '새 교사',
        subject: '',
        homeroom: '',
        role: '교과교사',
        max: 4,
        autoMax: true,
        unavailable: '',
      },
    ]);
  }
  function moveTeacher(id: string, direction: -1 | 1) {
    setTeachers((current) => {
      const index = current.findIndex((teacher) => teacher.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function addSession() {
    const id = `s${Date.now()}`;
    setSessions((current) => [
      ...current,
      {
        id,
        date: sessions.at(-1)?.date ?? formatExamDate(new Date()),
        period: '1교시',
        grade1Subject: '자습',
        grade2Subject: '자습',
        grade3Subject: '자습',
        rooms: [...gradeRooms[1].rooms, ...gradeRooms[2].rooms].join(', '),
      },
    ]);
  }
  function resetExample() {
    setTeachers(initialTeachers);
    setSessions(initialSessions);
    setAssignments(defaultAssignments(initialSessions));
    setExcludeHomeroom(true);
    setActiveTab('sessions');
    setNotice('예시 자료로 초기화했습니다.');
  }

  function currentExam(): ExamData {
    return { name: examName, teachers, sessions, assignments, excludeHomeroom };
  }
  function loadExam(data: ExamData) {
    setExamName(data.name);
    setTeachers(structuredClone(data.teachers));
    setSessions(structuredClone(data.sessions));
    setAssignments(structuredClone(data.assignments));
    setExcludeHomeroom(data.excludeHomeroom);
    setAssignmentHistory([]);
    setActiveTab('sessions');
    setIssueFilter('전체');
    setRosterPreview(null);
    setRosterError('');
  }
  function saveExam() {
    setExamError('');
    try {
      downloadExamFile(currentExam());
      setNotice(
        '시험 자료 다운로드를 요청했습니다. 다운로드 폴더에서 파일을 확인해 주세요.',
      );
    } catch (error) {
      setExamError(
        error instanceof Error
          ? error.message
          : '시험 자료를 저장하지 못했습니다.',
      );
    }
  }
  async function selectExamFile(file?: File) {
    if (!file) return;
    setIsExcelBusy(true);
    setExamError('');
    try {
      if (!/\.json$/i.test(file.name) || file.size > 5 * 1024 * 1024)
        throw new Error(
          '이 앱에서 저장한 .json 시험 자료 파일(5MB 이하)을 선택하세요.',
        );
      const imported = readExamFile(await file.text());
      setReplacementApproved(false);
      setPendingExam(imported);
    } catch (error) {
      setExamError(
        error instanceof Error ? error.message : '시험 자료를 읽지 못했습니다.',
      );
    } finally {
      setIsExcelBusy(false);
      if (examFileRef.current) examFileRef.current.value = '';
    }
  }
  function replaceExam() {
    if (!replacementApproved) return;
    try {
      const data =
        pendingExam?.data ?? copyForNextExam(currentExam(), nextExamName);
      setPreviousExam(structuredClone(currentExam()));
      loadExam(data);
      setPendingExam(null);
      setNextExamOpen(false);
      setExamError('');
      setNotice(
        pendingExam
          ? '시험 자료를 불러왔습니다. 편성 검증을 확인하세요.'
          : '교사 기본 정보를 복사했습니다. 시험 시간·고사실과 감독 불가 시간을 새로 설정하세요.',
      );
    } catch (error) {
      setExamError(
        error instanceof Error ? error.message : '시험을 전환하지 못했습니다.',
      );
    }
  }
  function restorePreviousExam() {
    if (!previousExam) return;
    loadExam(previousExam);
    setPreviousExam(null);
    setNotice('시험 전환 직전 자료로 되돌렸습니다.');
  }

  async function handleRosterUpload(file?: File) {
    if (!file) return;
    setIsExcelBusy(true);
    setRosterError('');
    try {
      const preview = await readRoster(file);
      setRosterMode('merge');
      setRosterPreview(preview);
    } catch (error) {
      setRosterError(
        error instanceof Error ? error.message : '교사 명단을 읽지 못했습니다.',
      );
    } finally {
      setIsExcelBusy(false);
      if (rosterInputRef.current) rosterInputRef.current.value = '';
    }
  }
  async function handleTeacherOrderUpload(file?: File) {
    if (!file) return;
    setIsExcelBusy(true);
    setTeacherOrderError('');
    try {
      const ordered = await readTeacherOrder(file, teachers);
      setTeachers(ordered);
      setAssignmentHistory([]);
      setNotice(
        `교사 ${ordered.length}명의 나이순을 적용했습니다. 위에서부터 연장자 순서인지 확인하세요.`,
      );
    } catch (error) {
      setTeacherOrderError(
        error instanceof Error
          ? error.message
          : '나이순 명단을 읽지 못했습니다.',
      );
    } finally {
      setIsExcelBusy(false);
      if (teacherOrderInputRef.current) teacherOrderInputRef.current.value = '';
    }
  }
  async function handleRosterTemplate() {
    setIsExcelBusy(true);
    setRosterError('');
    try {
      await downloadRosterTemplate();
    } catch {
      setRosterError('양식을 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsExcelBusy(false);
    }
  }
  function confirmRoster() {
    if (
      !rosterPreview ||
      rosterPreview.errors.length ||
      !rosterPreview.rows.length
    )
      return;
    try {
      const next = applyRoster(teachers, rosterPreview.rows, rosterMode, () =>
        crypto.randomUUID(),
      );
      setTeachers(next);
      setAssignmentHistory([]);
      setNotice(
        '교사 명단 ' +
          rosterPreview.rows.length +
          '명을 적용했습니다. 감독표의 편성 검증도 확인해 주세요.',
      );
      setRosterPreview(null);
      setRosterError('');
    } catch (error) {
      setRosterError(
        error instanceof Error ? error.message : '명단을 적용하지 못했습니다.',
      );
    }
  }

  async function handleExcelImport(file?: File) {
    if (!file) return;
    setIsExcelBusy(true);
    setNotice('엑셀 감독표를 읽고 있습니다…');
    try {
      const imported = await importScheduleWorkbook(file);
      setTeachers(imported.teachers);
      setSessions(
        imported.sessions.map((session) => ({
          ...session,
          grade1Subject: session.grade1Subject ?? '자습',
        })),
      );
      setAssignments(imported.assignments);
      setActiveTab('teachers');
      setNotice(
        `${file.name}에서 교사 ${imported.teachers.length}명과 시험 시간 ${imported.sessions.length}개를 불러왔습니다.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '엑셀 파일을 읽지 못했습니다.',
      );
    } finally {
      setIsExcelBusy(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  }
  async function exportXlsx() {
    setIsExcelBusy(true);
    setNotice('엑셀 파일을 만들고 있습니다…');
    try {
      await exportScheduleWorkbook(teachers, sessions, assignments);
      setNotice(
        '토탈·날짜별 시트가 포함된 시험감독표.xlsx 파일을 저장했습니다.',
      );
    } catch {
      setNotice('엑셀 파일을 만드는 중 문제가 발생했습니다.');
    } finally {
      setIsExcelBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="no-print sticky top-0 z-30 border-b-2 border-primary/15 bg-card shadow-sm">
        <div className="mx-auto flex max-w-[1540px] flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="school-brand">
              <img
                src="/school-emblem.png"
                alt="학교 교표"
                width={48}
                height={49}
              />
              <span>시험감독편성</span>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] text-muted-foreground">
                교무부 업무 도구
              </p>
              <h1 className="text-lg font-bold tracking-tight">
                시험감독 편성실
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) =>
                void handleExcelImport(event.target.files?.[0])
              }
            />
            <Button
              variant="outline"
              disabled={isExcelBusy}
              onClick={() => excelInputRef.current?.click()}
            >
              <Upload /> 기존 감독표 불러오기
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> 인쇄
            </Button>
            <Button
              variant="outline"
              disabled={isExcelBusy}
              onClick={() => void exportXlsx()}
            >
              <Download /> 학교양식 엑셀 저장
            </Button>
          </div>
        </div>
        <nav
          aria-label="작업 단계"
          className="mx-auto grid max-w-[1540px] grid-cols-3 gap-2 px-5 pb-3 lg:px-8"
        >
          {(
            [
              {
                value: 'sessions',
                number: '1',
                label: '시험 설정',
                detail: '일정·과목·고사실',
              },
              {
                value: 'teachers',
                number: '2',
                label: '교사 설정',
                detail: '교사 자료·배정 조건',
              },
              {
                value: 'schedule',
                number: '3',
                label: '감독표',
                detail: '자동 편성·검토',
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`group flex min-h-16 items-center justify-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors sm:min-h-20 sm:px-5 ${activeTab === tab.value ? 'border-[#1187c9] bg-[#e8f5fc] text-[#083f77] shadow-sm' : 'border-border bg-background text-muted-foreground hover:border-[#83bddf] hover:bg-[#f5f9fd]'}`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black sm:size-10 sm:text-base ${activeTab === tab.value ? 'bg-[#083f77] text-white' : 'bg-muted text-foreground'}`}
              >
                {tab.number}
              </span>
              <span>
                <strong className="block text-base font-extrabold text-foreground sm:text-xl">
                  {tab.label}
                </strong>
                <span className="hidden text-xs sm:block sm:text-sm">
                  {tab.detail}
                </span>
              </span>
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1540px] px-5 py-6 lg:px-8">
        <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#075787]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f2fc] px-3 py-1">
                <CheckCircle2 className="size-3.5" /> 기기 안에서만 처리
              </span>
              <span className="text-muted-foreground">
                토탈·날짜별 엑셀 시트 지원
              </span>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
              조건은 꼼꼼하게, 편성은 한 번에.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              기존 감독표의 교사·일정·사선 표시를 읽고, 정·부·자습감독 색상과
              감독 제외 사선이 반영된 학교용 엑셀로 저장합니다.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#cee2f2] bg-[#edf6fc] px-4 py-3 text-sm text-[#174d75]">
            <CheckCircle2 className="size-4 shrink-0" /> {notice}
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={<CalendarDays />}
            label="시험 시간"
            value={`${sessions.length}개`}
            tone="green"
          />
          <Metric
            icon={<Users />}
            label="등록 교사"
            value={`${teachers.length}명`}
            tone="blue"
          />
          <Metric
            icon={<CheckCircle2 />}
            label="배정 완료"
            value={`${assignedCount}/${requiredCount}`}
            tone="amber"
          />
          <Metric
            icon={<AlertTriangle />}
            label="확인 필요"
            value={`${issues.length}건`}
            tone={issues.length ? 'red' : 'green'}
          />
        </section>

        <section className="no-print mb-6 rounded-2xl border border-[#cee2f2] bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-60 flex-1 text-sm font-semibold">
              현재 시험 이름
              <Input
                className="mt-1 max-w-xl"
                maxLength={100}
                value={examName}
                onChange={(event) => setExamName(event.target.value)}
                placeholder="예: 2026학년도 1학기 중간고사"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!loaded || isExcelBusy || !examName.trim()}
                onClick={saveExam}
              >
                <Download /> 시험 자료 저장
              </Button>
              <Button
                variant="outline"
                disabled={!loaded || isExcelBusy}
                onClick={() => examFileRef.current?.click()}
              >
                <Upload /> 시험 자료 불러오기
              </Button>
              <Button
                disabled={!loaded || isExcelBusy}
                onClick={() => {
                  setNextExamName('');
                  setReplacementApproved(false);
                  setNextExamOpen(true);
                  setExamError('');
                }}
              >
                <Plus /> 다음 시험 만들기
              </Button>
              {previousExam && (
                <Button
                  variant="outline"
                  disabled={isExcelBusy}
                  onClick={restorePreviousExam}
                >
                  <Undo2 /> 시험 전환 되돌리기
                </Button>
              )}
            </div>
          </div>
          <input
            ref={examFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="저장한 시험 자료 파일"
            onChange={(event) => void selectExamFile(event.target.files?.[0])}
          />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            시험별 자료는 파일로 보관합니다. 이름·교사·시험 설정·배정·고정
            상태를 함께 저장합니다. 이 브라우저의 현재 작업은 임시 보관되며 다른
            기기와 자동 동기화되지 않습니다.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            파일에는 교사 개인정보가 포함됩니다. 학교에서 승인한 보관 장소를
            이용하세요. 시험 전환 되돌리기는 새로고침 전, 마지막 전환 1회에만
            사용할 수 있습니다.
          </p>
          {(examError || draftError) && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {examError || draftError}
            </p>
          )}
        </section>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
          className="gap-4"
        >
          <div className="no-print flex justify-end border-b border-border">
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="size-4 accent-[#083f77]"
              />
              담임은 자기 학급에서 제외
            </label>
          </div>

          <TabsContent value="schedule">
            <section className="no-print mb-5 rounded-2xl border-2 border-[#b9d9ed] bg-[#f5faff] p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-[#083f77] sm:text-xl">
                    감독표 편성
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    자동 편성을 실행하거나, 현재 고정 조건을 유지한 다른
                    편성안을 만듭니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-4 text-sm font-bold sm:px-5 sm:text-base"
                    disabled={!assignmentHistory.length || isExcelBusy}
                    onClick={undoAssignment}
                  >
                    <Undo2 /> 편성 실행 취소
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-4 text-sm font-bold sm:px-5 sm:text-base"
                    disabled={isExcelBusy}
                    onClick={clearUnlockedAssignments}
                  >
                    <Trash2 /> 미고정 배정 초기화
                  </Button>
                  <Button
                    data-action="auto-assign"
                    size="lg"
                    className="h-12 bg-[#083f77] px-5 text-base font-bold hover:bg-[#06335f]"
                    onClick={() => autoAssign()}
                  >
                    <Sparkles /> 자동 편성
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 bg-[#1187c9] px-5 text-base font-bold hover:bg-[#0d73ae]"
                    disabled={isExcelBusy}
                    onClick={() => autoAssign(true)}
                  >
                    <Shuffle /> 다른 편성안
                  </Button>
                </div>
              </div>
            </section>
            <div className="no-print mb-4 flex justify-end">
              <PersonalSchedule
                data={currentExam()}
                issueCount={issues.length}
              />
            </div>
            <p className="no-print mb-4 rounded-xl border bg-card px-4 py-3 text-sm">
              교사를 선택한 뒤 자물쇠를 누르면 자동 편성에서도 유지됩니다.
              고정된 칸을 수정하려면 먼저 고정을 해제하세요. 실행 취소는 최근
              20회까지 가능하며, 시험·교사 조건을 바꾸면 기록이 초기화됩니다.
            </p>
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="space-y-5">
                {sessions.map((session) => (
                  <section
                    key={session.id}
                    id={'session-' + session.id}
                    tabIndex={-1}
                    className="scroll-mt-24 overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(15_23_42/4%)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[#f5f9fd] px-5 py-4">
                      <div>
                        <h3 className="font-bold">
                          {session.date} · {session.period}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          1학년 {session.grade1Subject} · 2학년{' '}
                          {session.grade2Subject} · 3학년{' '}
                          {session.grade3Subject}
                        </p>
                        {officeStandbyTeachers(session, teachers).length >
                          0 && (
                          <p className="mt-1 text-xs font-semibold text-primary">
                            교무실 대기:{' '}
                            {officeStandbyTeachers(session, teachers)
                              .map(
                                (teacher) =>
                                  `${teacher.name}(${teacher.setterGrade ?? '?'}학년 ${teacher.setterSubject})`,
                              )
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <i className="size-3 rounded-sm bg-[#f4bd45]" />
                          정감독
                        </span>
                        <span className="flex items-center gap-1.5">
                          <i className="size-3 rounded-sm bg-[#b9cee9]" />
                          부감독
                        </span>
                        <span className="flex items-center gap-1.5">
                          <i className="size-3 rounded-sm bg-[#e8d9f2]" />
                          복도감독
                        </span>
                        <span className="flex items-center gap-1.5">
                          <i className="size-3 rounded-sm bg-[#cfe2bf]" />
                          자습감독
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th className="w-28 px-5 py-3 font-semibold">
                              고사실
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              시험 과목
                            </th>
                            <th className="px-4 py-3 font-semibold">
                              정감독 / 자습감독
                            </th>
                            <th className="px-4 py-3 font-semibold">부감독</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomList(session).map((room) => {
                            const key = slotKey(session.id, room);
                            const assignment = assignments[key] ?? {
                              chief: '',
                              assistant: '',
                            };
                            const isStudy =
                              subjectForRoom(session, room) === '자습';
                            return (
                              <tr
                                key={room}
                                id={'assignment-' + key}
                                tabIndex={-1}
                                className="scroll-mt-24 border-t border-border/70 focus:bg-amber-50 focus:outline-2 focus:outline-amber-500"
                              >
                                <td className="px-5 py-3">
                                  <span className="inline-flex min-w-14 justify-center rounded-lg border bg-background px-2.5 py-1.5 font-bold">
                                    {room}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-muted-foreground">
                                  {subjectForRoom(session, room)}
                                </td>
                                <td className="px-4 py-3">
                                  <TeacherSelect
                                    tone={isStudy ? 'study' : 'chief'}
                                    value={assignment.chief}
                                    teachers={teachers}
                                    locked={Boolean(assignment.chiefLocked)}
                                    onToggleLock={() =>
                                      toggleAssignmentLock(key, 'chief')
                                    }
                                    onChange={(value) =>
                                      updateAssignment(key, 'chief', value)
                                    }
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  {isStudy || session.singleSupervision ? (
                                    <span className="inline-flex min-w-40 items-center rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                      {isStudy
                                        ? '자습은 부감독 없음'
                                        : '단일감독 시간'}
                                    </span>
                                  ) : (
                                    <TeacherSelect
                                      tone="assistant"
                                      value={assignment.assistant}
                                      teachers={teachers}
                                      locked={Boolean(
                                        assignment.assistantLocked,
                                      )}
                                      onToggleLock={() =>
                                        toggleAssignmentLock(key, 'assistant')
                                      }
                                      onChange={(value) =>
                                        updateAssignment(
                                          key,
                                          'assistant',
                                          value,
                                        )
                                      }
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {hallwayGroups(session).map((group) => {
                            const key = hallwaySlotKey(session.id, group.id);
                            const assignment = assignments[key] ?? {
                              chief: '',
                              assistant: '',
                            };
                            return (
                              <tr
                                key={key}
                                id={'assignment-' + key}
                                tabIndex={-1}
                                className="scroll-mt-24 border-t border-[#d8c9e2] bg-[#fbf7fd] focus:bg-purple-50 focus:outline-2 focus:outline-purple-500"
                              >
                                <td className="px-5 py-3">
                                  <span className="inline-flex min-w-14 justify-center rounded-lg border border-[#cdb7dc] bg-white px-2.5 py-1.5 font-bold text-[#68417d]">
                                    복도
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-medium text-muted-foreground">
                                  {group.label}
                                </td>
                                <td colSpan={2} className="px-4 py-3">
                                  <TeacherSelect
                                    tone="hallway"
                                    value={assignment.chief}
                                    teachers={teachers}
                                    locked={Boolean(assignment.chiefLocked)}
                                    onToggleLock={() =>
                                      toggleAssignmentLock(key, 'hallway')
                                    }
                                    onChange={(value) =>
                                      updateAssignment(key, 'hallway', value)
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
              <aside className="space-y-5">
                <section className="rounded-2xl border bg-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold">편성 검증</h3>
                    <span
                      className={
                        issues.length
                          ? 'text-sm font-bold text-red-700'
                          : 'text-sm font-bold text-emerald-700'
                      }
                      aria-live="polite"
                    >
                      {issues.length
                        ? `${issues.length}건`
                        : requiredCount
                          ? '이상 없음'
                          : '검사할 배정 없음'}
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    변경 즉시 검사합니다. 항목을 누르면 해당 배정으로
                    이동합니다. 중복은 각 배정 칸별로 표시합니다.
                  </p>
                  <label className="mb-3 block text-sm">
                    문제 유형
                    <select
                      className="field-select mt-1"
                      value={issueFilter}
                      onChange={(e) => setIssueFilter(e.target.value)}
                    >
                      {['전체', ...issueKinds].map((kind) => (
                        <option key={kind} value={kind}>
                          {kind} (
                          {kind === '전체'
                            ? issues.length
                            : issues.filter((issue) => issue.kind === kind)
                                .length}
                          )
                        </option>
                      ))}
                    </select>
                  </label>
                  {visibleIssues.length ? (
                    <ul className="max-h-[430px] space-y-2 overflow-auto">
                      {visibleIssues.map((issue, index) => (
                        <li key={issue.target + issue.kind + index}>
                          <button
                            type="button"
                            className="w-full rounded-lg border border-red-100 bg-red-50/50 p-3 text-left text-sm leading-6 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
                            onClick={() => goToIssue(issue.target)}
                          >
                            <span className="block font-semibold text-red-700">
                              {issue.kind}
                            </span>
                            {issue.message}
                            <span className="block text-[#083f77]">
                              해당 배정으로 이동 →
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
                      {issues.length
                        ? '선택한 유형의 문제는 없습니다.'
                        : requiredCount
                          ? '설정된 조건에서 발견된 문제가 없습니다. 배부 전 시험 일정과 교사 정보를 최종 확인하세요.'
                          : '시험 시간과 고사실을 먼저 설정하세요.'}
                    </p>
                  )}
                </section>
                <section className="rounded-2xl border bg-card p-5">
                  <h3 className="mb-4 font-bold">교사별 감독 횟수</h3>
                  <div className="max-h-[430px] space-y-3 overflow-auto pr-1">
                    {[...teachers]
                      .sort(
                        (a, b) =>
                          (counts[b.id]?.total ?? 0) -
                          (counts[a.id]?.total ?? 0),
                      )
                      .map((teacher) => {
                        const count = counts[teacher.id] ?? {
                          total: 0,
                          chief: 0,
                          assistant: 0,
                          hallway: 0,
                          standby: 0,
                        };
                        return (
                          <div key={teacher.id}>
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                              <span className="font-semibold">
                                {teacher.name}{' '}
                                <em className="ml-1 not-italic text-muted-foreground">
                                  {teacher.role !== '교과교사'
                                    ? teacher.role
                                    : ''}
                                </em>
                              </span>
                              <span className="tabular-nums text-muted-foreground">
                                {count.total}/{teacher.max}회
                                {count.hallway
                                  ? ` · 복도 ${count.hallway}`
                                  : ''}
                                {count.standby
                                  ? ` · 대기 ${count.standby}`
                                  : ''}
                              </span>
                            </div>
                            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                              <span
                                className="bg-[#dda631]"
                                style={{
                                  width: `${Math.min(100, (count.chief / Math.max(teacher.max, 1)) * 100)}%`,
                                }}
                              />
                              <span
                                className="bg-[#84a9d4]"
                                style={{
                                  width: `${Math.min(100, (count.assistant / Math.max(teacher.max, 1)) * 100)}%`,
                                }}
                              />
                              <span
                                className="bg-[#b596c8]"
                                style={{
                                  width: `${Math.min(100, (count.hallway / Math.max(teacher.max, 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="teachers">
            <div className="space-y-5">
              <section className="no-print rounded-2xl border-2 border-[#b9d9ed] bg-[#f5faff] px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#083f77] sm:text-xl">
                      교사 자료 업로드
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      교사 설정에 필요한 파일을 이 영역에서 차례로 올릴 수
                      있습니다. 파일은 기기 안에서만 처리합니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2" aria-live="polite">
                    <span className="rounded-full border border-[#b9d9ed] bg-white px-3 py-1.5 text-sm font-bold text-[#174d75]">
                      시간표 반영 {regularLessonStatus.timetableTeacherCount}명
                    </span>
                    <span className="rounded-full bg-[#083f77] px-3 py-1.5 text-sm font-bold text-white">
                      정규수업 자동 불가 {regularLessonStatus.blockedTeacherCount}명 ·{' '}
                      {regularLessonStatus.blockedSlotCount}칸
                    </span>
                  </div>
                </div>
                <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-[#174d75]">
                  {regularLessonStatus.timetableTeacherCount === 0
                    ? '아직 전체 교사 시간표가 반영되지 않았습니다. 아래에서 시간표를 업로드한 뒤 확인창의 ‘반영’을 눌러 주세요.'
                    : regularLessonStatus.blockedSlotCount === 0
                      ? '시간표는 반영되었습니다. 시험 날짜·교시와 응시 학년을 설정하면 시험을 보지 않는 학년의 정규수업이 자동으로 계산됩니다.'
                      : '자동 불가 시간은 아래 감독 불가 시간표에 ‘수업’으로 표시되며, 자동 편성 후보에서도 제외됩니다.'}
                </p>
              </section>
              <TeacherTimetableUpload
                defaultMax={defaultMax}
                teachers={teachers}
                sessions={sessions}
                examYear={examYear(examName)}
                onChange={setTeachers}
              />
              <section className="no-print rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold">교사 명단 일괄 입력</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      양식을 작성해 업로드하면
                      이름·담당과목·담임·구분·감독상한을 한 번에 입력합니다.
                      .xlsx, 최대 5MB.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={isExcelBusy}
                      onClick={() => void handleRosterTemplate()}
                    >
                      <Download /> 교사 양식 다운로드
                    </Button>
                    <Button
                      disabled={isExcelBusy}
                      onClick={() => rosterInputRef.current?.click()}
                    >
                      <Upload /> 교사 명단 업로드
                    </Button>
                    <input
                      ref={rosterInputRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      aria-label="교사 명단 엑셀 파일"
                      onChange={(event) =>
                        void handleRosterUpload(event.target.files?.[0])
                      }
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  파일은 기기 안에서만 처리합니다. 이름으로 기존 교사를 찾으므로
                  동명이인은 이름에 구분 표시를 붙여 주세요.
                </p>
                {isExcelBusy && (
                  <p role="status" className="mt-2 text-sm">
                    엑셀 파일을 처리하고 있습니다…
                  </p>
                )}
                {rosterError && !rosterPreview && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {rosterError}
                  </p>
                )}
              </section>
              <section className="no-print rounded-2xl border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold">나이순 명단 업로드</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      이름 한 열의 엑셀 명단을 나이 많은 순서대로 올리면 교사
                      순서를 한 번에 정리합니다.
                    </p>
                  </div>
                  <div>
                    <input
                      ref={teacherOrderInputRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      aria-label="나이순 교사 명단 엑셀 파일"
                      onChange={(event) =>
                        void handleTeacherOrderUpload(event.target.files?.[0])
                      }
                    />
                    <Button
                      disabled={isExcelBusy || !teachers.length}
                      onClick={() => teacherOrderInputRef.current?.click()}
                    >
                      <Upload /> 나이순 명단 업로드
                    </Button>
                  </div>
                </div>
                {teacherOrderError && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {teacherOrderError}
                  </p>
                )}
              </section>
              <TeacherRuleSettings teachers={teachers} onChange={setTeachers} />
              <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                  <div>
                    <h3 className="font-bold">교사 기본 정보</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      기본 감독 상한: {defaultMax}회 (자습 제외, 같은
                      날짜·교시는 학년과 관계없이 1회). 기본값 사용 시 시험
                      일정에 따라 자동 변경됩니다. 기존 상한과 양식에 입력한
                      상한은 개별값으로 유지합니다.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#075787]">
                      명단은 위에서부터 나이 많은 순서입니다. 이름 한 열의 엑셀
                      명단을 올리거나 화살표로 조정하면 감독표와 엑셀에도 같은
                      순서가 적용됩니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <BulkTeacherMax
                      teachers={teachers}
                      defaultMax={defaultMax}
                      onChange={setTeachers}
                    />
                    <Button onClick={addTeacher}>
                      <Plus /> 교사 추가
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-muted/45 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">나이순 / 이름</th>
                        <th className="px-4 py-3 text-left">담당 과목</th>
                        <th className="px-4 py-3 text-left">담임</th>
                        <th className="px-4 py-3 text-left">구분</th>
                        <th className="px-4 py-3 text-left">감독 상한</th>
                        <th className="px-4 py-3 text-center">불가</th>
                        <th className="w-14" />
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map((teacher, index) => (
                        <tr key={teacher.id} className="border-t">
                          <td className="p-2 pl-4">
                            <div className="flex min-w-52 items-center gap-1">
                              <span className="w-6 text-center text-xs font-bold text-muted-foreground">
                                {index + 1}
                              </span>
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  disabled={index === 0}
                                  aria-label={`${teacher.name} 위로 이동`}
                                  onClick={() => moveTeacher(teacher.id, -1)}
                                >
                                  <ArrowUp className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6"
                                  disabled={index === teachers.length - 1}
                                  aria-label={`${teacher.name} 아래로 이동`}
                                  onClick={() => moveTeacher(teacher.id, 1)}
                                >
                                  <ArrowDown className="size-3.5" />
                                </Button>
                              </div>
                              <Input
                                value={teacher.name}
                                onChange={(e) =>
                                  updateTeacher(
                                    teacher.id,
                                    'name',
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <select
                              aria-label={`${teacher.name} 담당 과목`}
                              className="field-select"
                              value={teacher.subject}
                              onChange={(e) =>
                                updateTeacher(
                                  teacher.id,
                                  'subject',
                                  e.target.value,
                                )
                              }
                            >
                              <option value="">없음</option>
                              {teacher.subject &&
                                !subjects.includes(teacher.subject) && (
                                  <option value={teacher.subject}>
                                    {teacher.subject}
                                  </option>
                                )}
                              {subjects.map((subject) => (
                                <option key={subject} value={subject}>
                                  {subject}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              aria-label={`${teacher.name} 담임 학급`}
                              className="field-select"
                              value={teacher.homeroom}
                              onChange={(e) =>
                                updateTeacher(
                                  teacher.id,
                                  'homeroom',
                                  e.target.value,
                                )
                              }
                            >
                              <option value="">없음</option>
                              {teacher.homeroom &&
                                !homerooms.includes(teacher.homeroom) && (
                                  <option value={teacher.homeroom}>
                                    {teacher.homeroom}
                                  </option>
                                )}
                              {homerooms.map((room) => (
                                <option key={room} value={room}>
                                  {room}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              className="field-select"
                              value={teacher.role}
                              onChange={(e) =>
                                updateTeacher(
                                  teacher.id,
                                  'role',
                                  e.target.value as Role,
                                )
                              }
                            >
                              {roles.map((role) => (
                                <option key={role}>{role}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <Input
                              aria-label={`${teacher.name} 감독 상한`}
                              type="number"
                              min={0}
                              step={1}
                              value={teacher.max}
                              onChange={(e) =>
                                updateTeacher(
                                  teacher.id,
                                  'max',
                                  Math.max(
                                    0,
                                    Math.floor(Number(e.target.value) || 0),
                                  ),
                                )
                              }
                            />
                            <label className="mt-1 flex items-center gap-1 whitespace-nowrap text-xs">
                              <input
                                type="checkbox"
                                checked={teacher.autoMax === true}
                                onChange={(e) =>
                                  setTeachers((current) =>
                                    current.map((t) =>
                                      t.id === teacher.id
                                        ? {
                                            ...t,
                                            autoMax: e.target.checked,
                                            max: teacher.max,
                                          }
                                        : t,
                                    ),
                                  )
                                }
                              />
                              기본값 사용
                            </label>
                          </td>
                          <td className="p-2 text-center">
                            <span className="inline-flex min-w-10 justify-center rounded-full bg-muted px-2 py-1 text-xs font-bold">
                              {unavailableIds(teacher).length}개
                            </span>
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${teacher.name} 삭제`}
                              onClick={() =>
                                setTeachers((current) =>
                                  current.filter(
                                    (item) => item.id !== teacher.id,
                                  ),
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
                  <div>
                    <h3 className="font-bold">감독 불가 시간표</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      감독할 수 없는 시간을 체크하세요. ‘수업’ 표시는 시험을
                      보지 않는 학년의 정규수업에서 자동 반영되어 해제할 수
                      없습니다. 저장한 엑셀의 해당 칸에는 사선이 표시됩니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-[#e1f2fc] px-3 py-1.5 text-[#075787]">
                      수업 = 시간표 자동 반영
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
                      일반 체크 = 직접 지정
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max border-collapse text-sm">
                    <thead className="bg-muted/45 text-xs text-muted-foreground">
                      <tr>
                        <th className="sticky left-0 z-10 min-w-32 border-r bg-muted px-4 py-3 text-left">
                          교사
                        </th>
                        {sessions.map((session) => (
                          <th
                            key={session.id}
                            className="min-w-28 px-3 py-3 text-center"
                          >
                            <span className="block font-semibold text-foreground">
                              {session.date}
                            </span>
                            <span>{session.period}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.map((teacher) => (
                        <tr key={teacher.id} className="border-t">
                          <th className="sticky left-0 z-10 border-r bg-card px-4 py-3 text-left font-semibold">
                            {teacher.name}
                          </th>
                          {sessions.map((session) => (
                            <td
                              key={session.id}
                              className="px-3 py-3 text-center"
                            >
                              {(() => {
                                const automatic =
                                  regularLessonBlockedSessionIds(
                                    teacher,
                                    sessions,
                                    examYear(examName),
                                  ).includes(session.id);
                                return (
                                  <label className="inline-flex flex-col items-center gap-1">
                                    <input
                                      type="checkbox"
                                      className="size-5 cursor-pointer accent-[#083f77] disabled:cursor-not-allowed"
                                      checked={unavailableIds(teacher).includes(
                                        session.id,
                                      )}
                                      disabled={automatic}
                                      aria-label={`${teacher.name} ${session.date} ${session.period} 감독 불가${automatic ? ' (정규수업 자동)' : ''}`}
                                      onChange={() =>
                                        toggleUnavailable(
                                          teacher.id,
                                          session.id,
                                        )
                                      }
                                    />
                                    {automatic && (
                                      <span className="text-[11px] font-semibold text-primary">
                                        수업
                                      </span>
                                    )}
                                  </label>
                                );
                              })()}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="flex flex-wrap justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('sessions')}
                >
                  <ArrowLeft /> 시험 설정으로
                </Button>
                <Button onClick={() => setActiveTab('schedule')}>
                  감독표 확인 <ArrowRight />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sessions">
            <div className="space-y-4">
              {sessions.map((session) => (
                <section
                  key={session.id}
                  className="rounded-2xl border bg-card p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">
                        {session.date} {session.period}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        선택 고사실 <b>{roomList(session).length}개</b> ·{' '}
                        {session.singleSupervision
                          ? `정감독 + 복도감독 ${hallwayGroups(session).length}명`
                          : '정·부감독'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="시험 시간 삭제"
                      onClick={() =>
                        setSessions((current) =>
                          current.filter((item) => item.id !== session.id),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <fieldset className="mb-4 rounded-xl border bg-[#edf6fc] p-4">
                    <legend className="px-1 text-sm font-bold">
                      응시 학년 (이 시험 시간)
                    </legend>
                    <div className="flex flex-wrap gap-5">
                      {gradeRooms.map((group) => (
                        <label
                          key={group.grade}
                          className="flex cursor-pointer items-center gap-2 text-sm font-semibold"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-[#083f77]"
                            checked={gradeParticipates(session, group.grade)}
                            onChange={() => toggleGrade(session, group.grade)}
                          />
                          {group.grade}학년
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      체크를 해제하면 해당 학년은 시험 없음으로 처리하고 교실
                      감독·미배정 검사에서 제외합니다. 기존 배정과 고정은
                      해제됩니다. 자습감독이 필요하면 학년을 체크하고 과목을
                      자습으로 선택하세요. 다시 체크하면 자습으로 시작하므로
                      과목을 확인하세요.
                    </p>
                  </fieldset>
                  <fieldset className="mb-4 rounded-xl border bg-[#fbf7fd] p-4">
                    <legend className="px-1 text-sm font-bold">
                      감독 방식 (학교 지정)
                    </legend>
                    <div className="flex flex-wrap gap-5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input
                          type="radio"
                          name={`mode-${session.id}`}
                          checked={!session.singleSupervision}
                          onChange={() =>
                            setSessions((current) =>
                              current.map((item) =>
                                item.id === session.id
                                  ? { ...item, singleSupervision: false }
                                  : item,
                              ),
                            )
                          }
                        />
                        교실별 정·부감독
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input
                          type="radio"
                          name={`mode-${session.id}`}
                          checked={session.singleSupervision === true}
                          onChange={() =>
                            setSessions((current) =>
                              current.map((item) =>
                                item.id === session.id
                                  ? { ...item, singleSupervision: true }
                                  : item,
                              ),
                            )
                          }
                        />
                        정감독 + 두 학급당 복도감독
                      </label>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      학교에서 단일감독 시간을 지정한 경우에만 두 번째 항목을
                      선택하세요. 학년별 학급 순서대로 두 반씩 묶으며, 홀수로
                      남는 학급과 특별실도 별도 복도 구역으로 편성합니다.
                    </p>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <ExamDatePicker
                      value={session.date}
                      year={examYear(examName)}
                      onChange={(value) =>
                        updateSession(session.id, 'date', value)
                      }
                    />
                    <Field label="교시">
                      <Input
                        value={session.period}
                        onChange={(e) =>
                          updateSession(session.id, 'period', e.target.value)
                        }
                      />
                    </Field>
                    <Field label="1학년 과목">
                      <SubjectSelect
                        disabled={!gradeParticipates(session, 1)}
                        value={session.grade1Subject}
                        onChange={(value) =>
                          updateSession(session.id, 'grade1Subject', value)
                        }
                      />
                    </Field>
                    <Field label="2학년 과목">
                      <SubjectSelect
                        disabled={!gradeParticipates(session, 2)}
                        value={session.grade2Subject}
                        onChange={(value) =>
                          updateSession(session.id, 'grade2Subject', value)
                        }
                      />
                    </Field>
                    <Field label="3학년 과목">
                      <SubjectSelect
                        disabled={!gradeParticipates(session, 3)}
                        value={session.grade3Subject}
                        onChange={(value) =>
                          updateSession(session.id, 'grade3Subject', value)
                        }
                      />
                    </Field>
                  </div>
                  <div className="mt-5 rounded-xl border bg-[#f5f9fd] p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-bold">고사실 선택</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        응시 학년의 교실을 선택하세요. 특별실은 학년 선택과
                        별도로 유지되므로 사용할 특별실만 체크하세요.
                      </p>
                    </div>
                    <div className="space-y-4">
                      {gradeRooms.map((group) => (
                        <RoomGroup
                          key={group.grade}
                          disabled={!gradeParticipates(session, group.grade)}
                          label={group.label}
                          rooms={group.rooms}
                          selected={roomList(session)}
                          onToggleRoom={(room) => toggleRoom(session, room)}
                          onToggleGroup={() =>
                            toggleRoomGroup(session, group.rooms)
                          }
                        />
                      ))}
                      <RoomGroup
                        label="특별실"
                        rooms={specialRooms}
                        selected={roomList(session)}
                        onToggleRoom={(room) => toggleRoom(session, room)}
                        onToggleGroup={() =>
                          toggleRoomGroup(session, specialRooms)
                        }
                      />
                      <Field label="기타 특별실(쉼표로 구분)">
                        <Input
                          value={roomList(session)
                            .filter((room) => !fixedRooms.includes(room))
                            .join(', ')}
                          placeholder="예: 영어전용실, 진로활동실"
                          onChange={(e) =>
                            updateCustomRooms(session, e.target.value)
                          }
                        />
                      </Field>
                    </div>
                  </div>
                </section>
              ))}
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={resetExample}>
                  <RefreshCw /> 예시로 초기화
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={addSession}>
                    <Plus /> 시험 시간 추가
                  </Button>
                  <Button onClick={() => setActiveTab('teachers')}>
                    교사 설정으로 <ArrowRight />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={Boolean(pendingExam) || nextExamOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPendingExam(null);
            setNextExamOpen(false);
            setExamError('');
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingExam ? '저장한 시험 불러오기' : '다음 시험 만들기'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              현재 화면의 시험 자료가 바뀝니다. 계속 보관할 시험은 먼저 파일로
              저장하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingExam ? (
            <div className="rounded-lg bg-muted p-3 text-sm leading-6">
              <p className="font-bold">{pendingExam.data.name}</p>
              <p>
                교사 {pendingExam.data.teachers.length}명 · 시험 시간{' '}
                {pendingExam.data.sessions.length}개
              </p>
              <p>
                파일 저장 시각:{' '}
                {new Date(pendingExam.savedAt).toLocaleString('ko-KR')}
              </p>
              <p>교사 정보·감독 불가 시간·시험 설정·배정·고정을 불러옵니다.</p>
            </div>
          ) : (
            <>
              <label className="text-sm font-semibold">
                새 시험 이름
                <Input
                  className="mt-1"
                  maxLength={100}
                  value={nextExamName}
                  onChange={(event) => setNextExamName(event.target.value)}
                  placeholder="예: 2026학년도 1학기 기말고사"
                />
              </label>
              <p className="text-sm leading-6">
                교사의 기본 정보·개인별 배정 조건·수업 학급을 복사합니다. 학기가
                바뀌면 수업 학급을 다시 확인하세요. 시험 일정·고사실·감독 불가
                시간·배정·고정은 비워서 시작합니다.
              </p>
            </>
          )}
          <Button
            variant="outline"
            onClick={saveExam}
            disabled={!examName.trim()}
          >
            <Download /> 현재 시험 자료 먼저 저장
          </Button>
          <label className="flex items-start gap-2 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-[#083f77]"
              checked={replacementApproved}
              onChange={(event) => setReplacementApproved(event.target.checked)}
            />
            현재 자료를 파일로 보관했거나, 현재 화면의 자료를 교체해도 됩니다.
          </label>
          {examError && (
            <p role="alert" className="text-sm text-red-700">
              {examError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !replacementApproved || (!pendingExam && !nextExamName.trim())
              }
              onClick={replaceExam}
            >
              {pendingExam ? '불러오기' : '새 시험 시작'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(rosterPreview)}
        onOpenChange={(open) => {
          if (!open) {
            setRosterPreview(null);
            setRosterError('');
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>교사 명단 확인</DialogTitle>
            <DialogDescription>
              아직 적용하지 않았습니다. {rosterPreview?.sheet} 시트에서 읽은
              내용을 확인하세요.
            </DialogDescription>
          </DialogHeader>
          {rosterPreview && (
            <>
              <p className="text-sm">
                정상 {rosterPreview.rows.length}명 · 오류{' '}
                {rosterPreview.errors.length}행
              </p>
              {rosterPreview.errors.length > 0 && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                >
                  <p className="mb-2 font-bold">
                    오류를 수정한 뒤 다시 업로드하세요. 일부만 적용하지
                    않습니다.
                  </p>
                  <ul className="max-h-44 list-disc space-y-1 overflow-auto pl-5">
                    {rosterPreview.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="max-h-64 overflow-auto rounded-lg border">
                <table className="w-full min-w-[540px] text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {['이름', '담당과목', '담임', '구분', '감독상한'].map(
                        (label) => (
                          <th key={label} className="p-2 text-left">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rosterPreview.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2">{row.subject || '없음'}</td>
                        <td className="p-2">{row.homeroom || '없음'}</td>
                        <td className="p-2">{row.role}</td>
                        <td className="p-2">{row.max}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="text-sm font-semibold">
                적용 방식
                <select
                  className="field-select mt-1"
                  value={rosterMode}
                  onChange={(event) =>
                    setRosterMode(event.target.value as 'merge' | 'replace')
                  }
                >
                  <option value="merge">
                    추가·업데이트 — 파일에 없는 기존 교사 유지
                  </option>
                  <option value="replace">
                    전체 교체 — 파일에 없는 기존 교사 삭제
                  </option>
                </select>
              </label>
              <p className="text-sm leading-6 text-muted-foreground">
                동일 이름은 다섯 항목만 갱신하며 감독 불가 시간과 배정·고정은
                유지합니다. 새 교사는 추가됩니다. 시험 설정은 바뀌지 않으며,
                적용하면 편성 실행 취소 기록은 초기화됩니다.
              </p>
              {rosterMode === 'replace' && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  파일에 없는 기존 교사 {removedTeachers.length}명이 삭제됩니다.
                  해당 교사의 배정과 고정도 해제됩니다.
                  {removedTeachers.length > 0 && (
                    <span className="mt-1 block max-h-24 overflow-auto">
                      {removedTeachers
                        .map((teacher) => teacher.name)
                        .join(', ')}
                    </span>
                  )}
                </p>
              )}
              {rosterError && (
                <p role="alert" className="text-sm text-red-700">
                  {rosterError}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRosterPreview(null);
                    setRosterError('');
                  }}
                >
                  취소
                </Button>
                <Button
                  disabled={
                    Boolean(rosterPreview.errors.length) ||
                    !rosterPreview.rows.length
                  }
                  onClick={confirmRoster}
                >
                  {rosterMode === 'replace' ? '전체 교체 적용' : '명단 적용'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'green' | 'blue' | 'amber' | 'red';
}) {
  const tones = {
    green: 'bg-[#e1f2fc] text-[#075787]',
    blue: 'bg-[#e7eef8] text-[#386a9f]',
    amber: 'bg-[#fbf0d6] text-[#9b6b08]',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgb(15_23_42/3%)]">
      <div
        className={`mb-3 grid size-9 place-items-center rounded-xl ${tones[tone]} [&_svg]:size-4`}
      >
        {icon}
      </div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
function TeacherSelect({
  tone,
  value,
  teachers,
  onChange,
  locked,
  onToggleLock,
}: {
  tone: Duty | 'study';
  value: string;
  teachers: Teacher[];
  onChange: (value: string) => void;
  locked: boolean;
  onToggleLock: () => void;
}) {
  const label =
    tone === 'chief'
      ? '정감독 선택'
      : tone === 'assistant'
        ? '부감독 선택'
        : tone === 'hallway'
          ? '복도감독 선택'
          : '자습감독 선택';
  const color =
    tone === 'chief'
      ? 'border-[#e8c469] bg-[#fff6db]'
      : tone === 'assistant'
        ? 'border-[#b6cce5] bg-[#edf4fc]'
        : tone === 'hallway'
          ? 'border-[#cdb7dc] bg-[#f5eef9]'
          : 'border-[#bad3a7] bg-[#eef6e8]';
  return (
    <div className="flex items-center gap-2">
      <select
        disabled={locked}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-w-40 rounded-lg border px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-ring ${color}`}
      >
        <option value="">미배정</option>
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {teacher.name}
          </option>
        ))}
      </select>
      <Button
        variant={locked ? 'default' : 'outline'}
        size="icon"
        disabled={!value}
        aria-pressed={locked}
        aria-label={`${label} ${locked ? '고정 해제' : '고정'}`}
        title={locked ? '고정 해제' : '배정 고정'}
        onClick={onToggleLock}
      >
        {locked ? <LockKeyhole /> : <UnlockKeyhole />}
      </Button>
    </div>
  );
}
function SubjectSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      disabled={disabled}
      className="field-select disabled:opacity-50"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="자습">자습</option>
      {value && value !== '자습' && !subjects.includes(value) && (
        <option value={value}>{value}</option>
      )}
      {subjects.map((subject) => (
        <option key={subject} value={subject}>
          {subject}
        </option>
      ))}
    </select>
  );
}
function RoomGroup({
  label,
  rooms,
  selected,
  onToggleRoom,
  onToggleGroup,
  disabled = false,
}: {
  disabled?: boolean;
  label: string;
  rooms: string[];
  selected: string[];
  onToggleRoom: (room: string) => void;
  onToggleGroup: () => void;
}) {
  const allSelected = rooms.every((room) => selected.includes(room));
  const selectedCount = rooms.filter((room) => selected.includes(room)).length;
  return (
    <fieldset
      disabled={disabled}
      className={disabled ? 'opacity-50' : undefined}
    >
      <legend className="sr-only">{label}</legend>
      <label className="mb-2 inline-flex cursor-pointer items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          className="size-4 accent-[#083f77]"
          checked={allSelected}
          onChange={onToggleGroup}
        />
        {label} {disabled ? '시험 없음' : '전체'}{' '}
        <span className="font-normal text-muted-foreground">
          ({selectedCount}/{rooms.length})
        </span>
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-10">
        {rooms.map((room) => (
          <label
            key={room}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${selected.includes(room) ? 'border-[#71b8dc] bg-[#e1f2fc] font-semibold text-[#083f77]' : 'bg-card text-muted-foreground'}`}
          >
            <input
              type="checkbox"
              className="size-4 accent-[#083f77]"
              checked={selected.includes(room)}
              onChange={() => onToggleRoom(room)}
            />
            {room}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
