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
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">Admin - Chapters</h1>
          <p className="ui-subtitle">创建章节、管理章节题目入口在这里</p>
        </div>
      </div>
  
      <div className="ui-status">{status}</div>
  
      {!isAdmin ? null : (
        <>
          <div className="ui-card">
            <h2 className="ui-title" style={{ fontSize: 16 }}>新增章节</h2>
  
            <div className="ui-col" style={{ marginTop: 10, maxWidth: 560 }}>
              <input
                className="ui-input"
                placeholder="章节标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
  
              <input
                className="ui-input"
                placeholder="顺序（数字）"
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
              />
  
              <button className="ui-btn ui-btn-primary" onClick={addChapter} disabled={!canSubmit} style={{ maxWidth: 200 }}>
                添加
              </button>
            </div>
          </div>
  
          <div className="ui-card">
            <div className="ui-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="ui-title" style={{ fontSize: 16 }}>章节列表</h2>
              <span className="ui-badge">{chapters.length} 章</span>
            </div>
  
            {loading ? (
              <p className="ui-subtitle">Loading...</p>
            ) : chapters.length === 0 ? (
              <p className="ui-subtitle">暂无章节。请先新增章节。</p>
            ) : (
              <table className="ui-table" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>顺序</th>
                    <th>标题</th>
                    <th style={{ width: 220 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {chapters.map((c) => (
                    <tr key={c.id}>
                      <td>{c.order_index}</td>
                      <td style={{ fontWeight: 600 }}>{c.title}</td>
                      <td>
                        <div className="ui-row">
                          <Link
                            className="ui-btn"
                            href={`/admin/chapters/${c.id}`}
                            style={{ textDecoration: 'none' }}
                          >
                            管理题目
                          </Link>
  
                          <button className="ui-btn ui-btn-danger" onClick={() => deleteChapter(c.id)}>
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  )
  
}
