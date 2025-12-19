'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

const AVATARS: Record<string, { label: string }> = {
  a1: { label: '🙂' },
  a2: { label: '😺' },
  a3: { label: '🦊' },
  a4: { label: '🐼' },
  a5: { label: '🐯' },
  a6: { label: '🐸' },
  a7: { label: '🧠' },
  a8: { label: '📚' },
}

const STORAGE_KEY = 'mobile_avatar_fab_pos_v1'
const FAB_SIZE = 42
const EDGE_GAP = 10
const TOP_GAP = 10
const BOTTOM_GAP = 10
const DRAG_THRESHOLD = 6

type Pos = { x: number; y: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export default function MobileAvatarFab() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const btnRef = useRef<HTMLButtonElement | null>(null)
  const startRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  const [ready, setReady] = useState(false)
  const [sessionOk, setSessionOk] = useState(false)
  const [avatarKey, setAvatarKey] = useState<string>('a1')

  const [pressed, setPressed] = useState(false)
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 })

  // 初始化位置（右上角默认）+ 恢复上次拖动位置
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 390
    const defaultPos = { x: w - FAB_SIZE - EDGE_GAP, y: TOP_GAP }

    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
      if (raw) {
        const p = JSON.parse(raw) as Pos
        setPos(p)
      } else {
        setPos(defaultPos)
      }
    } catch {
      setPos(defaultPos)
    }
  }, [])

  // 会话 + 头像 key
  useEffect(() => {
    let alive = true

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const hasSession = !!data.session
      if (!alive) return

      setSessionOk(hasSession)
      setReady(true)

      if (!hasSession) return

      const uid = data.session!.user.id
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('avatar_key')
        .eq('user_id', uid)
        .maybeSingle()

      if (!alive) return
      if (prof?.avatar_key) setAvatarKey(prof.avatar_key)
    })()

    return () => {
      alive = false
    }
  }, [supabase])

  // 位置持久化
  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
    } catch {}
  }, [pos, ready])

  // 屏幕尺寸变化时：保证按钮仍在可见范围
  useEffect(() => {
    function onResize() {
      const w = window.innerWidth
      const h = window.innerHeight
      setPos((p) => ({
        x: clamp(p.x, EDGE_GAP, w - FAB_SIZE - EDGE_GAP),
        y: clamp(p.y, TOP_GAP, h - FAB_SIZE - BOTTOM_GAP),
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function goProfile() {
    if (!sessionOk) {
      router.push(`/login?next=${encodeURIComponent('/me')}`)
      return
    }
    router.push('/me')
  }

  function onPointerDown(e: React.PointerEvent) {
    // 只在主指针处理
    if (e.button !== undefined && e.button !== 0) return

    movedRef.current = false
    setPressed(true)

    const rect = btnRef.current?.getBoundingClientRect()
    const currentX = rect ? rect.left : pos.x
    const currentY = rect ? rect.top : pos.y

    startRef.current = { px: e.clientX, py: e.clientY, x: currentX, y: currentY }

    try {
      btnRef.current?.setPointerCapture(e.pointerId)
    } catch {}
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pressed) return
    const s = startRef.current
    if (!s) return

    const dx = e.clientX - s.px
    const dy = e.clientY - s.py

    if (!movedRef.current && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      movedRef.current = true
    }

    const w = window.innerWidth
    const h = window.innerHeight

    const nx = clamp(s.x + dx, EDGE_GAP, w - FAB_SIZE - EDGE_GAP)
    const ny = clamp(s.y + dy, TOP_GAP, h - FAB_SIZE - BOTTOM_GAP)

    setPos({ x: nx, y: ny })
  }

  function snapToNearestEdge() {
    const w = window.innerWidth
    // 以按钮中心判断离哪侧更近：左 / 右
    const centerX = pos.x + FAB_SIZE / 2
    const snapLeft = centerX <= w / 2
    const x = snapLeft ? EDGE_GAP : w - FAB_SIZE - EDGE_GAP
    setPos((p) => ({ x, y: p.y }))
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pressed) return
    setPressed(false)

    try {
      btnRef.current?.releasePointerCapture(e.pointerId)
    } catch {}

    // 如果几乎没移动：视为点击
    if (!movedRef.current) {
      goProfile()
      return
    }

    // 拖动结束：磁吸到最近边缘
    snapToNearestEdge()
  }

  // 避免首屏闪烁：session 未判定前不渲染
  if (!ready) return null

  const emoji = sessionOk ? (AVATARS[avatarKey]?.label ?? '🙂') : '👤'

  return (
    <button
      ref={btnRef}
      className={`mobile-avatar-fab ${pressed ? 'is-pressed' : ''}`}
      aria-label="个人中心"
      type="button"
      title={sessionOk ? '个人中心' : '登录后进入个人中心'}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setPressed(false)}
    >
      <span className="mobile-avatar-fab__inner">{emoji}</span>
    </button>
  )
}
