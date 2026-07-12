const EXAM_TIME = new Date('2026-07-19T00:00:00+08:00').getTime()

export function daysUntilExam(now = new Date()): number {
  return Math.max(0, Math.ceil((EXAM_TIME - now.getTime()) / 86400000))
}
