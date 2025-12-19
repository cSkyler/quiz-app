'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function DesktopProfileEntry() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [ready, setReady] = useState(false)
  const [sessionOk, setSessionOk] = useState(false)
  const [avatarKey, setAvatarKey] = useState<string>('a1')

  useEffect(() => {
    let alive = true

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (!alive) return

      setSessionOk(!!session)
      setReady(true)

      if (!session) return

      const uid = session.user.id
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

  function go() {
    if (!sessionOk) {
      router.push(`/login?next=${encodeURIComponent('/me')}`)
      return
    }
    router.push('/me')
  }

  if (!ready) return null

  const emoji = sessionOk ? (AVATARS[avatarKey]?.label ?? '🙂') : '👤'

  return (
    <button
      type="button"
      className="desktop-profile-entry ui-btn ui-btn-ghost ui-btn-sm"
      onClick={go}
      aria-label="个人中心"
      title={sessionOk ? '个人中心' : '登录后进入个人中心'}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{emoji}</span>
      <span className="desktop-profile-entry__text">个人中心</span>
    </button>
  )
}
