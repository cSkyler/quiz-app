'use client'

import Link from 'next/link'
import { useMemo, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type ProfileRow = {
  user_id: string
  role: string | null
  username: string | null
  nickname: string | null
  bio: string | null
  avatar_key: string | null
  username_updated_at: string | null
  is_banned: boolean
  is_muted: boolean
  muted_until: string | null
}

const AVATARS = [
  { key: 'default_1', label: '默认 1', emoji: '🙂' },
  { key: 'default_2', label: '默认 2', emoji: '😎' },
  { key: 'default_3', label: '默认 3', emoji: '🤓' },
  { key: 'default_4', label: '默认 4', emoji: '🦊' },
  { key: 'default_5', label: '默认 5', emoji: '🐱' },
  { key: 'default_6', label: '默认 6', emoji: '🐼' },
] as const

function avatarEmoji(key: string | null | undefined) {
  const found = AVATARS.find((a) => a.key === key)
  return found?.emoji ?? '🙂'
}

export default function MePage() {
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const [email, setEmail] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  const [role, setRole] = useState<string | null>(null)
  const [isBanned, setIsBanned] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [mutedUntil, setMutedUntil] = useState<string | null>(null)
  const [usernameUpdatedAt, setUsernameUpdatedAt] = useState<string | null>(null)

  // editable fields
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [avatarKey, setAvatarKey] = useState<string>('default_1')

  const [saving, setSaving] = useState(false)

  async function loadProfile() {
    setStatus('')
    setLoading(true)
    try {
      const { data: sess, error: sErr } = await supabase.auth.getSession()
      if (sErr) {
        setStatus(`读取会话失败：${sErr.message}`)
        return
      }
      const user = sess.session?.user
      if (!user) {
        setStatus('未登录，请先登录。')
        return
      }

      setEmail(user.email ?? null)
      setUid(user.id)

      const { data: p, error: pErr } = await supabase
        .from('user_profiles')
        .select(
          'user_id, role, username, nickname, bio, avatar_key, username_updated_at, is_banned, is_muted, muted_until'
        )
        .eq('user_id', user.id)
        .maybeSingle()

      if (pErr) {
        setStatus(`读取个人资料失败：${pErr.message}`)
        return
      }

      // 如果没记录（极少数情况），补一条最基础的 profile
      if (!p) {
        const { error: upErr } = await supabase.from('user_profiles').upsert(
          [
            {
              user_id: user.id,
              nickname: '',
              bio: '',
              avatar_key: 'default_1',
            },
          ],
          { onConflict: 'user_id' }
        )
        if (upErr) {
          setStatus(`初始化个人资料失败：${upErr.message}`)
          return
        }

        // 再读一次
        const { data: p2, error: p2Err } = await supabase
          .from('user_profiles')
          .select(
            'user_id, role, username, nickname, bio, avatar_key, username_updated_at, is_banned, is_muted, muted_until'
          )
          .eq('user_id', user.id)
          .maybeSingle()

        if (p2Err) {
          setStatus(`读取个人资料失败：${p2Err.message}`)
          return
        }

        if (p2) {
          applyProfile(p2 as any)
        }
        return
      }

      applyProfile(p as any)
    } finally {
      setLoading(false)
    }
  }

  function applyProfile(p: ProfileRow) {
    setRole(p.role ?? null)
    setIsBanned(!!p.is_banned)
    setIsMuted(!!p.is_muted)
    setMutedUntil(p.muted_until ?? null)
    setUsernameUpdatedAt(p.username_updated_at ?? null)

    setUsername((p.username ?? '').toLowerCase())
    setNickname(p.nickname ?? '')
    setBio(p.bio ?? '')
    setAvatarKey(p.avatar_key ?? 'default_1')
  }

  useEffect(() => {
    loadProfile()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // 登录/退出后刷新
      loadProfile()
    })

    return () => {
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  async function saveProfile() {
    setStatus('')
    setSaving(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const user = sess.session?.user
      if (!user) {
        setStatus('未登录，无法保存。')
        return
      }

      const u = username.trim().toLowerCase()
      const payload = {
        username: u === '' ? null : u,
        nickname: nickname ?? '',
        bio: bio ?? '',
        avatar_key: avatarKey ?? 'default_1',
      }

      const { error } = await supabase.from('user_profiles').update(payload).eq('user_id', user.id)

      if (error) {
        // 友好提示常见失败原因
        const msg = error.message || '保存失败'
        if (msg.includes('invalid username format')) {
          setStatus('保存失败：用户名格式不合法（需 3-20 位，小写字母/数字/下划线，且以字母开头）。')
        } else if (msg.includes('username can only be changed once every 30 days')) {
          setStatus('保存失败：用户名 30 天内只能修改一次。')
        } else if (msg.toLowerCase().includes('duplicate') || msg.includes('unique')) {
          setStatus('保存失败：该用户名已被占用，请换一个。')
        } else {
          setStatus(`保存失败：${msg}`)
        }
        return
      }

      setStatus('已保存')
      await loadProfile()
    } finally {
      setSaving(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const mutedHint =
    isMuted && mutedUntil
      ? `禁言中，截止：${new Date(mutedUntil).toLocaleString()}`
      : isMuted
        ? '禁言中'
        : ''

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">个人中心</h1>
          <p className="ui-subtitle">用于未来论坛：公开资料与权限状态分层</p>
        </div>

        <div className="ui-row" style={{ gap: 10 }}>
          <Link className="ui-link" href="/">
            首页
          </Link>
          <Link className="ui-link" href="/courses">
            刷题
          </Link>
          <button
            className="ui-link"
            onClick={signOut}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            退出
          </button>
        </div>
      </div>

      {loading ? <div className="ui-status">加载中...</div> : null}
      {status ? <div className="ui-status">{status}</div> : null}

      {/* 状态条：封禁/禁言只读展示 */}
      {(isBanned || isMuted) && (
        <div className="ui-card ui-card--neutral" style={{ marginTop: 12 }}>
          <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="ui-title" style={{ fontSize: 16 }}>
              账号状态
            </div>
            <span className="ui-meta">{role ? `role=${role}` : ''}</span>
          </div>
          <div className="ui-body" style={{ marginTop: 8 }}>
            {isBanned ? '封禁中：你将无法使用论坛/刷题等功能。' : null}
            {isBanned && isMuted ? '；' : null}
            {isMuted ? mutedHint : null}
          </div>
        </div>
      )}

      <div className="ui-card" style={{ marginTop: 12, maxWidth: 820 }}>
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="ui-badge">公开资料</div>
            <div className="ui-subtitle" style={{ marginTop: 6 }}>
              username 唯一（小写），且 30 天内只能改一次（首次设置不受限）。
            </div>
          </div>
          <div className="ui-badge">{email ?? '—'}</div>
        </div>

        <div className="ui-divider" style={{ marginTop: 14, marginBottom: 12 }} />

        {/* 头像选择 */}
        <div className="ui-col" style={{ gap: 8 }}>
          <div className="ui-label">头像（系统预设）</div>
          <div className="ui-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {AVATARS.map((a) => {
              const active = avatarKey === a.key
              return (
                <button
                  key={a.key}
                  className="ui-btn"
                  onClick={() => setAvatarKey(a.key)}
                  type="button"
                  style={{
                    height: 44,
                    padding: '0 12px',
                    borderRadius: 14,
                    borderColor: active ? 'rgba(110,168,255,.55)' : undefined,
                    boxShadow: active ? '0 0 0 3px rgba(110,168,255,.12)' : undefined,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{a.emoji}</span>
                  <span className="ui-meta">{a.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ui-divider" style={{ marginTop: 14, marginBottom: 12 }} />

        <div className="ui-col" style={{ gap: 10 }}>
          <label className="ui-col" style={{ gap: 6 }}>
            <span className="ui-label">用户名（类似微信号）</span>
            <input
              className="ui-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如：baoshui_01"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="ui-subtitle">
              规则：3-20 位；小写字母/数字/下划线；以字母开头。{usernameUpdatedAt ? `上次修改：${new Date(usernameUpdatedAt).toLocaleString()}` : ''}
            </div>
          </label>

          <label className="ui-col" style={{ gap: 6 }}>
            <span className="ui-label">昵称（类似微信名）</span>
            <input
              className="ui-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="例如：抱水"
            />
          </label>

          <label className="ui-col" style={{ gap: 6 }}>
            <span className="ui-label">签名</span>
            <textarea
              className="ui-textarea"
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="写上最近看到触动你的一句话吧~"
            />
          </label>

          <div className="ui-row" style={{ gap: 10, marginTop: 6 }}>
            <button className="ui-btn ui-btn-primary" onClick={saveProfile} disabled={saving || !uid}>
              {saving ? '保存中…' : '保存资料'}
            </button>

            <button className="ui-btn" onClick={loadProfile} disabled={saving}>
              重新加载
            </button>

            <span className="ui-badge" title={uid ?? ''}>
              {uid ? `UID: ${uid.slice(0, 8)}…` : 'UID: —'}
            </span>

            <span className="ui-badge" title={avatarKey}>
              头像：{avatarEmoji(avatarKey)}
            </span>
          </div>
        </div>
      </div>
    </main>
  )
}
