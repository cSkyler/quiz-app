import type { SupabaseClient } from '@supabase/supabase-js'

export type LearningStatus = 'green' | 'yellow' | 'red'

export type ProgressSummary = {
  total: number
  green: number
  yellow: number
  red: number
  attempted: number
  unseen: number
}

export type CourseProgress = ProgressSummary & { course_id: string }
export type ChapterProgress = ProgressSummary & { chapter_id: string }

export type ChapterRef = { id: string; course_id: string }
export type QuestionRef = { id: string; chapter_id: string }
export type QuestionStatusRow = {
  question_id: string
  status: string | null
  wrong_count?: number | null
}

const PAGE_SIZE = 1000
const IN_FILTER_CHUNK_SIZE = 200

function emptySummary(): ProgressSummary {
  return { total: 0, green: 0, yellow: 0, red: 0, attempted: 0, unseen: 0 }
}

export function normalizeLearningStatus(status: string | null | undefined): LearningStatus {
  if (status === 'green' || status === 'correct') return 'green'
  if (status === 'red' || status === 'wrong') return 'red'
  return 'yellow'
}

export function buildLearningProgress(
  chapters: ChapterRef[],
  questions: QuestionRef[],
  statuses: QuestionStatusRow[]
): {
  courseProgress: Record<string, CourseProgress>
  chapterProgress: Record<string, ChapterProgress>
} {
  const courseProgress: Record<string, CourseProgress> = {}
  const chapterProgress: Record<string, ChapterProgress> = {}
  const chapterCourse = new Map<string, string>()
  const statusByQuestion = new Map(statuses.map((row) => [row.question_id, row]))

  for (const chapter of chapters) {
    chapterCourse.set(chapter.id, chapter.course_id)
    chapterProgress[chapter.id] = { chapter_id: chapter.id, ...emptySummary() }
    courseProgress[chapter.course_id] ??= { course_id: chapter.course_id, ...emptySummary() }
  }

  for (const question of questions) {
    const courseId = chapterCourse.get(question.chapter_id)
    const chapter = chapterProgress[question.chapter_id]
    if (!courseId || !chapter) continue

    const course = courseProgress[courseId]
    chapter.total += 1
    course.total += 1

    const statusRow = statusByQuestion.get(question.id)
    if (!statusRow) continue

    const status = normalizeLearningStatus(statusRow.status)
    chapter.attempted += 1
    chapter[status] += 1
    course.attempted += 1
    course[status] += 1
  }

  for (const row of Object.values(chapterProgress)) row.unseen = Math.max(0, row.total - row.attempted)
  for (const row of Object.values(courseProgress)) row.unseen = Math.max(0, row.total - row.attempted)

  return { courseProgress, chapterProgress }
}

export async function loadQuestionStatuses(
  supabase: SupabaseClient,
  userId: string,
  questionIds?: string[]
): Promise<QuestionStatusRow[]> {
  if (questionIds) {
    if (questionIds.length === 0) return []
    const rows: QuestionStatusRow[] = []
    for (let index = 0; index < questionIds.length; index += IN_FILTER_CHUNK_SIZE) {
      const chunk = questionIds.slice(index, index + IN_FILTER_CHUNK_SIZE)
      const { data, error } = await supabase
        .from('user_question_status')
        .select('question_id,status,wrong_count')
        .eq('user_id', userId)
        .in('question_id', chunk)
      if (error) throw error
      rows.push(...((data ?? []) as QuestionStatusRow[]))
    }
    return rows
  }

  const rows: QuestionStatusRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('user_question_status')
      .select('question_id,status,wrong_count')
      .eq('user_id', userId)
      .order('question_id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as QuestionStatusRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

export async function loadAllLearningProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  courseProgress: Record<string, CourseProgress>
  chapterProgress: Record<string, ChapterProgress>
}> {
  const [chapters, questions, statuses] = await Promise.all([
    loadAllChapters(supabase),
    loadAllQuestions(supabase),
    loadQuestionStatuses(supabase, userId),
  ])
  return buildLearningProgress(chapters, questions, statuses)
}

async function loadAllChapters(supabase: SupabaseClient): Promise<ChapterRef[]> {
  const rows: ChapterRef[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('chapters')
      .select('id,course_id')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as ChapterRef[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function loadAllQuestions(supabase: SupabaseClient): Promise<QuestionRef[]> {
  const rows: QuestionRef[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('questions')
      .select('id,chapter_id')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as QuestionRef[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}
