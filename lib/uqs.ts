// lib/uqs.ts
import type { SupabaseClient } from '@supabase/supabase-js'

type Verdict = 'correct' | 'wrong' | 'unsure'

type UqsRow = {
  user_id: string
  question_id: string
  status: 'red' | 'yellow' | 'green'
  wrong_count: number
  streak_correct: number
  last_is_correct: boolean | null
  last_answer_at: string | null
}

/**
 * 错题消除规则（默认）：
 * - wrong => red, streak=0, wrong_count+1
 * - correct => streak+1, streak>=2 => green 否则 yellow
 * - unsure => yellow, streak=0（不计入连续正确），wrong_count不变
 * - green 下 wrong => red
 */
export async function updateUserQuestionStatus(
  supabase: SupabaseClient,
  questionId: string,
  verdict: Verdict
) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user?.id
  if (!uid) return

  // 读旧状态（若不存在则当作首次）
  const { data: prev, error: prevErr } = await supabase
    .from('user_question_status')
    .select('status, wrong_count, streak_correct')
    .eq('user_id', uid)
    .eq('question_id', questionId)
    .maybeSingle()

  // 如果读取失败也不要影响做题主流程
  if (prevErr) return

  const now = new Date().toISOString()
  const prevStatus = (prev?.status as UqsRow['status']) ?? 'yellow'
  const prevWrong = Number(prev?.wrong_count ?? 0)
  const prevStreak = Number(prev?.streak_correct ?? 0)

  let next: UqsRow = {
    user_id: uid,
    question_id: questionId,
    status: 'yellow',
    wrong_count: prevWrong,
    streak_correct: prevStreak,
    last_is_correct: null,
    last_answer_at: now,
  }

  if (verdict === 'wrong') {
    next.status = 'red'
    next.wrong_count = prevWrong + 1
    next.streak_correct = 0
    next.last_is_correct = false
  } else if (verdict === 'unsure') {
    next.status = 'yellow'
    next.wrong_count = prevWrong
    next.streak_correct = 0
    next.last_is_correct = null
  } else {
   // correct
const newStreak = prevStreak + 1
next.wrong_count = prevWrong
next.streak_correct = newStreak
next.last_is_correct = true

// 规则调整：从未做错（wrong_count=0）时，第一次做对直接 green
// 否则沿用“连续正确”消除机制
if (prevWrong === 0) {
  next.status = 'green'
} else if (prevStatus === 'green') {
  next.status = 'green'
} else {
  next.status = newStreak >= 2 ? 'green' : 'yellow'
}

  }

  // upsert：一人一题一行
  await supabase
    .from('user_question_status')
    .upsert([next], { onConflict: 'user_id,question_id' })
}
