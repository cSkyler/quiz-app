'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type UserProfile = {
  user_id: string
  username: string | null
  display_name: string | null
  role: string | null
  is_banned: boolean | null
  banned_until: string | null
  mute_until: string | null
  created_at: string | null
  updated_at: string | null
}

function toISOPlusDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export default function AdminUsersPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState('Checking auth...')
  const [isAdmin, setIsAdmin] = useState(false)

  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<UserProfile[]>([])
  const [err, setErr] = useState('')

  // 通知发送
  const [notifyUserId, setNotifyUserId] = useState<string | null>(null)
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyBody, setNotifyBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user?.id
      if (!uid) {
        setIsAdmin(false)
        setStatus('Not logged in')
        return
      }

      const { data: prof, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle()

      if (error) {
        setIsAdmin(false)
        setStatus(`Auth error: ${error.message}`)
        return
      }

      const ok = prof?.role === 'owner'
setIsAdmin(ok)
setStatus(ok ? 'OK' : 'Forbidden')

    })()
  }, [supabase])

  async function search() {
    if (!isAdmin) return
    setErr('')
    setLoading(true)

    try {
      const term = q.trim()
      let query = supabase
        .from('user_profiles')
        .select('user_id, username, display_name, role, is_banned, banned_until, mute_until, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200)

      if (term) {
        // term 可能是 uuid，也可能是 username/display_name
        const isUuidLike = /^[0-9a-fA-F-]{32,36}$/.test(term)
        if (isUuidLike) {
          query = query.eq('user_id', term)
        } else {
          const like = `%${term}%`
          query = query.or(`username.ilike.${like},display_name.ilike.${like}`)
        }
      }

      const { data, error } = await query
      if (error) {
        setErr(error.message)
        setRows([])
        return
      }
      setRows((data ?? []) as any)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function setBan(userId: string, mode: 'clear' | 'forever' | 'days', days?: number) {
    setErr('')
    if (!isAdmin) return
    let patch: any = {}

    if (mode === 'clear') {
      patch = { is_banned: false, banned_until: null }
    } else if (mode === 'forever') {
      patch = { is_banned: true, banned_until: null }
    } else {
      patch = { is_banned: true, banned_until: toISOPlusDays(days ?? 7) }
    }

    const { error } = await supabase.from('user_profiles').update(patch).eq('user_id', userId)
    if (error) {
      setErr(error.message)
      return
    }
    await search()
  }

  async function setMute(userId: string, mode: 'clear' | 'days', days?: number) {
    setErr('')
    if (!isAdmin) return

    const patch =
      mode === 'clear'
        ? { mute_until: null }
        : { mute_until: toISOPlusDays(days ?? 7) }

    const { error } = await supabase.from('user_profiles').update(patch).eq('user_id', userId)
    if (error) {
      setErr(error.message)
      return
    }
    await search()
  }

  async function sendNotification() {
    if (!isAdmin || !notifyUserId) return
    const title = notifyTitle.trim()
    const body = notifyBody.trim()
    if (!body) {
      setErr('通知内容不能为空')
      return
    }

    setErr('')
    setSending(true)
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: notifyUserId,
        type: 'system',
        title: title || null,
        body,
        payload: null,
      })

      if (error) {
        setErr(error.message)
        return
      }

      setNotifyTitle('')
      setNotifyBody('')
      setNotifyUserId(null)
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <Link className="ui-link" href="/admin">← 返回管理端</Link>
        <div className="ui-badge">{status}</div>
      </div>

      {!isAdmin ? (
        <div className="ui-card">
          <h1 className="ui-title" style={{ fontSize: 18, marginTop: 0 }}>无权限</h1>
          <p className="ui-subtitle">仅 owner 可访问用户管理。</p>
        </div>
      ) : (
        <>
          <div className="ui-card">
            <h1 className="ui-title" style={{ fontSize: 18, marginTop: 0 }}>用户管理</h1>
            <p className="ui-subtitle">可搜索用户并设置封禁/禁言，或发送系统通知。</p>

            <div className="ui-row" style={{ marginTop: 12, gap: 10 }}>
              <input
                className="ui-input"
                placeholder="搜索：username / display_name / user_id"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="ui-btn ui-btn-primary" onClick={search} disabled={loading}>
                {loading ? '查询中…' : '查询'}
              </button>
            </div>

            {err ? <div className="ui-status">{err}</div> : null}
          </div>

          {/* Desktop table */}
          <div className="ui-only-desktop" style={{ marginTop: 14 }}>
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ width: 240 }}>用户</th>
                  <th style={{ width: 120 }}>角色</th>
                  <th>状态</th>
                  <th style={{ width: 380 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const banned = !!u.is_banned || (u.banned_until ? new Date(u.banned_until) > new Date() : false)
                  const muted = u.mute_until ? new Date(u.mute_until) > new Date() : false

                  return (
                    <tr key={u.user_id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{u.display_name ?? '—'}</div>
                        <div className="ui-meta">{u.username ?? '—'}</div>
                        <div className="ui-meta">{u.user_id}</div>
                      </td>
                      <td>{u.role ?? '—'}</td>
                      <td>
                        <div className="ui-body">
                          {banned ? `封禁${u.banned_until ? ` 至 ${new Date(u.banned_until).toLocaleString()}` : '（永久/未设置截止）'}` : '正常'}
                        </div>
                        <div className="ui-meta">
                          {muted ? `禁言至 ${new Date(u.mute_until!).toLocaleString()}` : '未禁言'}
                        </div>
                      </td>
                      <td>
                        <div className="ui-row" style={{ gap: 8 }}>
                          <button className="ui-btn ui-btn-sm" onClick={() => setBan(u.user_id, 'clear')}>解封</button>
                          <button className="ui-btn ui-btn-sm" onClick={() => setBan(u.user_id, 'days', 7)}>封禁7天</button>
                          <button className="ui-btn ui-btn-sm" onClick={() => setBan(u.user_id, 'days', 30)}>封禁30天</button>
                          <button className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setBan(u.user_id, 'forever')}>永久封禁</button>

                          <button className="ui-btn ui-btn-sm" onClick={() => setMute(u.user_id, 'clear')}>解除禁言</button>
                          <button className="ui-btn ui-btn-sm" onClick={() => setMute(u.user_id, 'days', 3)}>禁言3天</button>
                          <button className="ui-btn ui-btn-sm" onClick={() => setMute(u.user_id, 'days', 7)}>禁言7天</button>

                          <button className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setNotifyUserId(u.user_id)}>
                            发送通知
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="ui-only-mobile" style={{ marginTop: 14 }}>
            <div className="ui-col" style={{ gap: 10 }}>
              {rows.map((u) => {
                const banned = !!u.is_banned || (u.banned_until ? new Date(u.banned_until) > new Date() : false)
                const muted = u.mute_until ? new Date(u.mute_until) > new Date() : false

                return (
                  <div key={u.user_id} className="ui-card" style={{ padding: 14 }}>
                    <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{u.display_name ?? '—'}</div>
                        <div className="ui-meta">{u.username ?? '—'}</div>
                      </div>
                      <span className="ui-badge">{u.role ?? '—'}</span>
                    </div>

                    <div className="ui-meta" style={{ marginTop: 8 }}>{u.user_id}</div>

                    <div className="ui-body" style={{ marginTop: 8 }}>
                      {banned ? `封禁${u.banned_until ? ` 至 ${new Date(u.banned_until).toLocaleString()}` : '（永久/未设置截止）'}` : '正常'}
                      {' · '}
                      {muted ? `禁言至 ${new Date(u.mute_until!).toLocaleString()}` : '未禁言'}
                    </div>

                    <div className="ui-row" style={{ marginTop: 10, gap: 8 }}>
                      <button className="ui-btn ui-btn-xs" onClick={() => setBan(u.user_id, 'clear')}>解封</button>
                      <button className="ui-btn ui-btn-xs" onClick={() => setBan(u.user_id, 'days', 7)}>封7天</button>
                      <button className="ui-btn ui-btn-danger ui-btn-xs" onClick={() => setBan(u.user_id, 'forever')}>永久封</button>

                      <button className="ui-btn ui-btn-xs" onClick={() => setMute(u.user_id, 'clear')}>解禁言</button>
                      <button className="ui-btn ui-btn-xs" onClick={() => setMute(u.user_id, 'days', 7)}>禁言7天</button>

                      <button className="ui-btn ui-btn-ghost ui-btn-xs" onClick={() => setNotifyUserId(u.user_id)}>
                        通知
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notify panel */}
          {notifyUserId ? (
            <div className="ui-card" style={{ marginTop: 14 }}>
              <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 className="ui-title" style={{ fontSize: 16, marginTop: 0, marginBottom: 0 }}>发送系统通知</h2>
                <button className="ui-btn ui-btn-sm" onClick={() => setNotifyUserId(null)}>关闭</button>
              </div>

              <div className="ui-meta" style={{ marginTop: 8 }}>目标用户：{notifyUserId}</div>

              <div className="ui-col" style={{ gap: 10, marginTop: 10 }}>
                <input
                  className="ui-input"
                  placeholder="标题（可选）"
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                />
                <textarea
                  className="ui-textarea"
                  rows={4}
                  placeholder="通知内容（必填）"
                  value={notifyBody}
                  onChange={(e) => setNotifyBody(e.target.value)}
                />
                <div className="ui-row" style={{ gap: 10 }}>
                  <button className="ui-btn ui-btn-primary" onClick={sendNotification} disabled={sending}>
                    {sending ? '发送中…' : '发送'}
                  </button>
                  <button className="ui-btn" onClick={() => { setNotifyTitle(''); setNotifyBody(''); }}>
                    清空
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  )
}
