'use client'

import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Chapter = {
  id: string
  title: string
  order_index: number
  created_at: string
}

export default function AdminPage() {
  const [status, setStatus] = useState('Checking auth...')
  const [isAdmin, setIsAdmin] = useState(false)

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [orderIndex, setOrderIndex] = useState<number>(1)
  const canSubmit = useMemo(() => title.trim().length > 0 && Number.isFinite(orderIndex), [title, orderIndex])

  async function loadChapters() {
    setLoading(true)
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setStatus(`ERROR loading chapters: ${error.message}`)
      setLoading(false)
      return
    }

    setChapters((data ?? []) as Chapter[])
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setStatus('Not logged in. Go to /login first.')
        setIsAdmin(false)
        return
      }

      const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (pErr) {
        setStatus(`ERROR reading profile: ${pErr.message}`)
        setIsAdmin(false)
        return
      }

      if (profile?.role !== 'admin') {
        setStatus(`Logged in as ${user.email}, role=${profile?.role}. Not admin.`)
        setIsAdmin(false)
        return
      }

      setIsAdmin(true)
      setStatus('OK: admin')
      await loadChapters()
    }

    init()
  }, [])

  async function addChapter() {
    if (!canSubmit) return
    setStatus('Adding chapter...')

    const { error } = await supabase.from('chapters').insert([
      { title: title.trim(), order_index: orderIndex }
    ])

    if (error) {
      setStatus(`ERROR add chapter: ${error.message}`)
      return
    }

    setTitle('')
    setOrderIndex(1)
    setStatus('OK: chapter added')
    await loadChapters()
  }

  async function deleteChapter(id: string) {
    if (!confirm('确定删除该章节吗？删除章节会同时删除该章节下的题目。')) return
    setStatus('Deleting chapter...')

    const { error } = await supabase.from('chapters').delete().eq('id', id)
    if (error) {
      setStatus(`ERROR delete chapter: ${error.message}`)
      return
    }

    setStatus('OK: chapter deleted')
    await loadChapters()
  }

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Admin - Chapters</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{status}</pre>

      {!isAdmin ? null : (
        <>
          <section style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
            <h2 style={{ marginTop: 0 }}>新增章节</h2>
            <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
              <input
                placeholder="章节标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ padding: 10 }}
              />
              <input
                placeholder="顺序（数字）"
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                style={{ padding: 10 }}
              />
              <button onClick={addChapter} disabled={!canSubmit} style={{ padding: 10 }}>
                添加
              </button>
            </div>
          </section>

          <section style={{ marginTop: 16 }}>
            <h2>章节列表</h2>

            {loading ? (
              <p>Loading...</p>
            ) : chapters.length === 0 ? (
              <p>暂无章节。请先新增章节。</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>顺序</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>标题</th>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {chapters.map((c) => (
                    <tr key={c.id}>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{c.order_index}</td>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{c.title}</td>
                      <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
  <Link
    href={`/admin/chapters/${c.id}`}
    style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: 6, textDecoration: 'none' }}
  >
    管理题目
  </Link>

  <button onClick={() => deleteChapter(c.id)} style={{ padding: '6px 10px' }}>
    删除
  </button>
</div>

                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  )
}
