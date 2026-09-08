import { activeRooms } from './session-grades';

export type HallwaySession = {
  id: string;
  grade1Subject: string;
  grade2Subject: string;
  grade3Subject: string;
  rooms: string;
  singleSupervision?: boolean;
};

export type HallwayGroup = { id: string; rooms: string[]; label: string };

function roomOrder(room: string) {
  const match = room.match(/^([1-3])-(\d+)$/);
  return match ? Number(match[1]) * 100 + Number(match[2]) : 1000;
}

export function hallwayGroups(session: HallwaySession): HallwayGroup[] {
  if (!session.singleSupervision) return [];
  const rooms = activeRooms(session).sort((a, b) => roomOrder(a) - roomOrder(b) || a.localeCompare(b, 'ko'));
  const buckets = [
    rooms.filter(room => room.startsWith('1-')),
    rooms.filter(room => room.startsWith('2-')),
    rooms.filter(room => room.startsWith('3-')),
    rooms.filter(room => !/^[1-3]-/.test(room)),
  ];
  const groups: HallwayGroup[] = [];
  buckets.forEach((bucket, bucketIndex) => {
    for (let index = 0; index < bucket.length; index += 2) {
      const pair = bucket.slice(index, index + 2);
      groups.push({ id: `${bucketIndex}-${index / 2}`, rooms: pair, label: `${pair.join(' · ')} 앞` });
    }
  });
  return groups;
}

export function hallwaySlotKey(sessionId: string, groupId: string) {
  return `${sessionId}::복도-${groupId}`;
}

export function roomNeedsAssistant(session: HallwaySession, subject: string) {
  return !session.singleSupervision && subject !== '자습';
}
