'use client'

import { useEffect, useMemo, useState } from 'react'

export type OrderOption = {
  id: string
  text: string
  meta?: any
}

export type OrderAnswer = {
  correct_order: string[]
  strict?: boolean
  rule_code?: string
}

export type OrderReasonCode =
  | 'STRICT_MATCH'
  | 'FIRST_MISMATCH'
  | 'LENGTH_MISMATCH'
  | 'UNKNOWN'

type Props = {
  stem: string
  options: OrderOption[]
  answer: OrderAnswer
  explanation?: string | null
  layout?: 'row' | 'column'
  onSubmit?: (payload: {
    isCorrect: boolean
    userOrder: string[]
    correctOrder: string[]
    firstMismatchIndex: number | null
    reasonCode: OrderReasonCode | null
  }) => void
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function firstMismatchIndex(a: string[], b: string[]) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  if (a.length !== b.length) return n
  return null
}

/**
 * 将“片段卡片”拼成 APA 引用文本（轻量清洗）：
 * - 默认用空格连接
 * - 去掉标点前多余空格、括号内空格、压缩多空格
 */
function assembleReference(parts: string[]) {
  let s = parts
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')

  // 去掉标点前的空格： " , . ; : ? ! ) ]" 前不应有空格
  s = s.replace(/\s+([,.;:?!\)\]\}])/g, '$1')

  // 左括号后不应紧跟空格："( 2019" -> "(2019"
  s = s.replace(/([\(\[\{])\s+/g, '$1')

  // 左引号后不应紧跟空格
  s = s.replace(/([“"'])\s+/g, '$1')

  // 多空格压缩
  s = s.replace(/\s{2,}/g, ' ').trim()

  return s
}

export default function OrderQuestion(props: Props) {
  const layout = props.layout ?? 'row'
  const strict = props.answer?.strict !== false

  const optionMap = useMemo(() => {
    const m = new Map<string, OrderOption>()
    for (const o of props.options ?? []) m.set(o.id, o)
    return m
  }, [props.options])

  // 初始顺序：以 options 当前顺序为准（通常你出题时已经打乱了）
  const initialOrder = useMemo(() => (props.options ?? []).map((o) => o.id), [props.options])

  const correctOrder = useMemo(() => {
    const arr = (props.answer?.correct_order ?? []).map((x) => String(x))
    return arr
  }, [props.answer])

  const [order, setOrder] = useState<string[]>(initialOrder)

  // DnD
  const [dragId, setDragId] = useState<string | null>(null)

  // 提交结果
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [mismatchAt, setMismatchAt] = useState<number | null>(null)
  const [reason, setReason] = useState<OrderReasonCode | null>(null)

  useEffect(() => {
    // 当题目变了，重置状态
    setOrder(initialOrder)
    setDragId(null)
    setSubmitted(false)
    setIsCorrect(null)
    setMismatchAt(null)
    setReason(null)
  }, [initialOrder.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  function move(from: number, to: number) {
    if (from === to) return
    setOrder((prev) => {
      const next = prev.slice()
      const [x] = next.splice(from, 1)
      next.splice(to, 0, x)
      return next
    })
  }

  function handleSubmit() {
    const userOrder = order.slice()
    const corr = correctOrder.slice()

    // 基本健壮性：长度不一致直接错
    if (userOrder.length !== corr.length) {
      setSubmitted(true)
      setIsCorrect(false)
      setReason('LENGTH_MISMATCH')
      const mm = firstMismatchIndex(userOrder, corr)
      setMismatchAt(mm)

      props.onSubmit?.({
        isCorrect: false,
        userOrder,
        correctOrder: corr,
        firstMismatchIndex: mm,
        reasonCode: 'LENGTH_MISMATCH',
      })
      return
    }

    const ok = strict ? arraysEqual(userOrder, corr) : arraysEqual(userOrder, corr)
    const mm = firstMismatchIndex(userOrder, corr)

    setSubmitted(true)
    setIsCorrect(ok)
    setMismatchAt(mm)
    setReason(ok ? 'STRICT_MATCH' : 'FIRST_MISMATCH')

    props.onSubmit?.({
      isCorrect: ok,
      userOrder,
      correctOrder: corr,
      firstMismatchIndex: mm,
      reasonCode: ok ? 'STRICT_MATCH' : 'FIRST_MISMATCH',
    })
  }

  function handleReset() {
    setOrder(initialOrder)
    setDragId(null)
    setSubmitted(false)
    setIsCorrect(null)
    setMismatchAt(null)
    setReason(null)
  }

  const userTexts = order.map((id) => optionMap.get(id)?.text ?? '')
  const correctTexts = correctOrder.map((id) => optionMap.get(id)?.text ?? '')

  const assembledUser = assembleReference(userTexts)
  const assembledCorrect = assembleReference(correctTexts)

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 16,
        padding: 14,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{props.stem}</div>
          <div style={{ marginTop: 6, opacity: 0.85, fontSize: 13 }}>
            Drag to reorder. Then click Submit.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="ui-btn ui-btn-primary"
            onClick={handleSubmit}
            disabled={submitted}
            type="button"
          >
            提交
          </button>
          <button className="ui-btn" onClick={handleReset} type="button">
            重置
          </button>
        </div>
      </div>

      {/* 横排一行卡片带（可滚动） */}
      <div
        style={
          layout === 'row'
            ? {
                display: 'flex',
                flexDirection: 'row',
                gap: 10,
                overflowX: 'auto',
                padding: '12px 2px 6px',
                marginTop: 10,
              }
            : { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, marginTop: 10 }
        }
      >
        {order.map((id, idx) => {
          const opt = optionMap.get(id)
          const text = opt?.text ?? ''

          const isMismatchHere = submitted && mismatchAt !== null && idx === mismatchAt

          return (
            <div
              key={id}
              draggable={!submitted}
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => {
                if (!submitted) e.preventDefault()
              }}
              onDrop={(e) => {
                if (submitted) return
                e.preventDefault()
                if (!dragId) return
                if (dragId === id) return
                const from = order.indexOf(dragId)
                const to = order.indexOf(id)
                if (from >= 0 && to >= 0) move(from, to)
                setDragId(null)
              }}
              style={{
                border: isMismatchHere ? '2px solid rgba(239,68,68,0.95)' : '1px solid rgba(255,255,255,0.18)',
                borderRadius: 14,
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.08)', // 玻璃态
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: 'rgba(255,255,255,0.92)', // 白字
                fontSize: 13,
                lineHeight: 1.35,
                cursor: submitted ? 'default' : 'grab',
                boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
              
                // 横排：更紧凑，宽度随内容，但别太大
                ...(layout === 'row'
                  ? { width: 'fit-content', minWidth: 140, maxWidth: 380, flex: '0 0 auto' as const }
                  : {}),
              }}
              
            >
              <div
  style={{
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    maxHeight: 72,          // 控制高度（大约 4 行）
    overflow: 'hidden',
  }}
>
  {text}
</div>


              {/* 移动端兜底：左右移动 */}
             
            </div>
          )
        })}
      </div>

      {/* 结果区 */}
      {submitted ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            {isCorrect ? <span style={{ color: '#22c55e' }}>✔ Correct.</span> : <span style={{ color: '#ef4444' }}>✘ Incorrect.</span>}
            <span style={{ opacity: 0.85, fontWeight: 600 }}>
              {strict ? 'Strict scoring' : 'Loose scoring'}
            </span>
          </div>

          <div style={{ marginTop: 10, opacity: 0.9, fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>Your assembled reference:</div>
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{assembledUser || '(empty)'}</div>
          </div>

          {!isCorrect ? (
            <div style={{ marginTop: 12, opacity: 0.95, fontSize: 13 }}>
              <div style={{ fontWeight: 800 }}>The correct order is:</div>
              <ol style={{ marginTop: 8, paddingLeft: 18 }}>
                {correctTexts.map((t, i) => (
                  <li key={i} style={{ margin: '6px 0' }}>
                    {t}
                  </li>
                ))}
              </ol>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 800 }}>Correct assembled reference:</div>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{assembledCorrect || '(empty)'}</div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  padding: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <div style={{ fontWeight: 900 }}>First mismatch {mismatchAt === null ? '' : `(position ${mismatchAt + 1})`}</div>
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <div style={{ opacity: 0.9 }}>
                    You placed:
                    <div style={{ marginTop: 4, fontWeight: 700 }}>
                      {mismatchAt === null ? '-' : (optionMap.get(order[mismatchAt])?.text ?? '-')}
                    </div>
                  </div>
                  <div style={{ opacity: 0.9 }}>
                    Correct should be:
                    <div style={{ marginTop: 4, fontWeight: 700 }}>
                      {mismatchAt === null ? '-' : (optionMap.get(correctOrder[mismatchAt])?.text ?? '-')}
                    </div>
                  </div>
                  <div style={{ opacity: 0.9 }}>
                    Reason code:
                    <div style={{ marginTop: 4, fontWeight: 800 }}>{reason ?? 'UNKNOWN'}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* 规则说明（可选） */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>APA ordering rules</div>
            <div style={{ marginTop: 8, opacity: 0.9, whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {props.explanation ?? '无'}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
