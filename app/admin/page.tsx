'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Course = { id: string; title: string; order_index: number; created_at?: string }
type Chapter = { id: string; title: string; order_index: number; course_id: string; created_at?: string }
type AuditLog = {
  id: string
  actor_user_id: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  table_name: string
  record_id: string | null
  occurred_at: string
  before_data: any | null
  after_data: any | null
}

export default function AdminPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])

  const [status, setStatus] = useState('Checking auth...')
  const [isPrivileged, setIsPrivileged] = useState(false) // admin 或 owner
  const [role, setRole] = useState<'admin' | 'owner' | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  // site settings
  const [announcement, setAnnouncement] = useState('')
  const [changelog, setChangelog] = useState('')
  const [saving, setSaving] = useState(false)

  // audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [auditTable, setAuditTable] = useState('all')
  const [auditAction, setAuditAction] = useState('all')
  const [auditLimit, setAuditLimit] = useState(100)

  // courses
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  // create course
  const [courseTitle, setCourseTitle] = useState('')
  const [courseOrder, setCourseOrder] = useState<number>(1)
  const [creatingCourse, setCreatingCourse] = useState(false)

  // chapters
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loadingChapters, setLoadingChapters] = useState(false)

  // create chapter
  const [chapterTitle, setChapterTitle] = useState('')
  const [chapterOrder, setChapterOrder] = useState<number>(1)
  const [creatingChapter, setCreatingChapter] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  async function loadCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('id,title,order_index,created_at')
      .order('order_index', { ascending: true })

    if (error) {
      setStatus(`ERROR loading courses: ${error.message}`)
      return
    }

    const list = (data ?? []) as Course[]
    setCourses(list)
    if (!selectedCourseId && list.length > 0) {
      setSelectedCourseId(list[0].id)
    }
  }

  async function loadChapters(courseId: string) {
    setLoadingChapters(true)
    const { data, error } = await supabase
      .from('chapters')
      .select('id,title,order_index,course_id,created_at')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    if (error) {
      setStatus(`ERROR loading chapters: ${error.message}`)
      setLoadingChapters(false)
      return
    }

    setChapters((data ?? []) as Chapter[])
    setLoadingChapters(false)
  }

  async function fetchSiteSettings() {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key,value')
      .in('key', ['announcement', 'changelog'])

    if (!error && data) {
      const map: Record<string, string> = {}
      for (const r of data as any[]) map[r.key] = r.value
      setAnnouncement(map.announcement ?? '')
      setChangelog(map.changelog ?? '')
    }
  }

  async function saveSiteSettings() {
    setSaving(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess.session?.user?.id ?? null

      const rows = [
        { key: 'announcement', value: announcement, updated_by: uid, updated_at: new Date().toISOString() },
        { key: 'changelog', value: changelog, updated_by: uid, updated_at: new Date().toISOString() },
      ]

      const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' })
      if (error) alert(`保存失败：${error.message}`)
      else alert('已保存')
    } finally {
      setSaving(false)
    }
  }

  async function fetchAuditLogs() {
    setAuditError('')
    setAuditLoading(true)
    try {
      let q = supabase
        .from('audit_logs')
        .select('id, actor_user_id, action, table_name, record_id, occurred_at, before_data, after_data')
        .order('occurred_at', { ascending: false })
        .limit(auditLimit)

      if (auditTable !== 'all') q = q.eq('table_name', auditTable)
      if (auditAction !== 'all') q = q.eq('action', auditAction)

      const { data, error } = await q
      if (error) {
        setAuditError(error.message)
        setAuditLogs([])
        return
      }
      setAuditLogs((data ?? []) as any)
    } finally {
      setAuditLoading(false)
    }
  }

  async function addCourse() {
    const title = courseTitle.trim()
    if (!title) {
      setStatus('ERROR: 课程标题不能为空')
      return
    }

    setCreatingCourse(true)
    setStatus('Adding course...')

    const { error } = await supabase.from('courses').insert([
      { title, order_index: Number(courseOrder) || 1 }
    ])

    if (error) {
      setStatus(`ERROR add course: ${error.message}`)
      setCreatingCourse(false)
      return
    }

    setStatus('OK: 课程已新增')
    setCourseTitle('')
    setCourseOrder(1)
    await loadCourses()
    setCreatingCourse(false)
  }

  async function addChapter() {
    if (!selectedCourseId) {
      setStatus('ERROR: 请先选择课程')
      return
    }

    const title = chapterTitle.trim()
    if (!title) {
      setStatus('ERROR: 章节标题不能为空')
      return
    }

    setCreatingChapter(true)
    setStatus('Adding chapter...')

    const { error } = await supabase.from('chapters').insert([
      { course_id: selectedCourseId, title, order_index: Number(chapterOrder) || 1 }
    ])

    if (error) {
      setStatus(`ERROR add chapter: ${error.message}`)
      setCreatingChapter(false)
      return
    }

    setStatus('OK: 章节已新增')
    setChapterTitle('')
    setChapterOrder(1)
    await loadChapters(selectedCourseId)
    setCreatingChapter(false)
  }

  async function deleteChapter(chapterId: string) {
    if (!confirm('确定删除该章节吗？（会影响章节下题目展示）')) return
    setStatus('Deleting chapter...')

    const { error } = await supabase.from('chapters').delete().eq('id', chapterId)
    if (error) {
      setStatus(`ERROR delete chapter: ${error.message}`)
      return
    }

    setStatus('OK: 章节已删除')
    if (selectedCourseId) await loadChapters(selectedCourseId)
  }
  async function deleteCourse(courseId: string) {
    if (!confirm('确定删除该课程吗？（将同时删除该课程下的所有章节与题目）')) return
  
    setStatus('Deleting course...')
  
    // 1) 找出该课程下所有章节 id
    const { data: chs, error: chErr } = await supabase
      .from('chapters')
      .select('id')
      .eq('course_id', courseId)
  
    if (chErr) {
      setStatus(`ERROR deleting course: ${chErr.message}`)
      return
    }
  
    const chapterIds = (chs ?? []).map((x: any) => x.id).filter(Boolean)
  
    // 2) 先删题目（避免 FK 卡住）
    if (chapterIds.length > 0) {
      const { error: qErr } = await supabase
        .from('questions')
        .delete()
        .in('chapter_id', chapterIds)
  
      if (qErr) {
        setStatus(`ERROR deleting questions: ${qErr.message}`)
        return
      }
    }
  
    // 3) 再删章节
    const { error: delChErr } = await supabase
      .from('chapters')
      .delete()
      .eq('course_id', courseId)
  
    if (delChErr) {
      setStatus(`ERROR deleting chapters: ${delChErr.message}`)
      return
    }
  
    // 4) 最后删课程
    const { error: cErr } = await supabase
      .from('courses')
      .delete()
      .eq('id', courseId)
  
    if (cErr) {
      setStatus(`ERROR deleting course: ${cErr.message}`)
      return
    }
  
    setStatus('OK: 课程已删除')
  
    // 刷新课程列表，并自动重置选择
    await loadCourses()
  
    // 如果当前选中的就是被删的课程，把选择切到第一门或清空
    setSelectedCourseId((prev) => {
      if (prev !== courseId) return prev
      const next = courses.find((c) => c.id !== courseId)?.id
      return next ?? ''
    })
  }
  
  // auth + init
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setStatus('Checking auth...')
      const { data: sess } = await supabase.auth.getSession()
      const user = sess.session?.user

      if (!user) {
        setIsPrivileged(false)
        setStatus('Not logged in. Go to /login first.')
        return
      }

      setEmail(user.email ?? null)

      const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (pErr) {
        setIsPrivileged(false)
        setStatus(`ERROR reading profile: ${pErr.message}`)
        return
      }

      const ok = profile?.role === 'admin' || profile?.role === 'owner'
      if (!ok) {
        setIsPrivileged(false)
        setStatus(`Logged in as ${user.email}, role=${profile?.role}. Not authorized.`)
        return
      }

      if (cancelled) return
      setIsPrivileged(true)
      setRole(profile?.role === 'admin' || profile?.role === 'owner' ? profile.role : null)
      setStatus('OK: admin')

      await fetchSiteSettings()
      await loadCourses()
    })()

    return () => {
      cancelled = true
    }
  }, [supabase])

  // load audit logs
  useEffect(() => {
    if (!isPrivileged) return
    fetchAuditLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivileged, auditTable, auditAction, auditLimit])

  // load chapters when course changes
  useEffect(() => {
    if (!isPrivileged) return
    if (!selectedCourseId) {
      setChapters([])
      return
    }
    loadChapters(selectedCourseId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, isPrivileged])

  if (!isPrivileged) {
    return (
      <main className="ui-container">
        <div className="ui-topbar">
          <div>
            <h1 className="ui-title">管理端</h1>
            <p className="ui-subtitle">仅管理员可进入</p>
          </div>
          <div className="ui-row" style={{ gap: 10 }}>
            <Link className="ui-link" href="/">🏠 首页</Link>
            <Link className="ui-link" href="/courses">课程</Link>
            <Link className="ui-link" href="/login">去登录</Link>
          </div>
        </div>
        <div className="ui-status">{status}</div>
      </main>
    )
  }

  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">管理端</h1>
          <p className="ui-subtitle">{email ? `管理员：${email}` : '管理员'}</p>
        </div>

        <div className="ui-row" style={{ gap: 10 }}>
          <Link className="ui-btn ui-btn-ghost ui-btn-sm" href="/admin/users" style={{ textDecoration: 'none' }}>
            用户管理
          </Link>

          <Link className="ui-link" href="/">🏠 首页</Link>
          <Link className="ui-link" href="/courses">课程</Link>

          <button
            className="ui-link"
            onClick={signOut}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            退出登录
          </button>
        </div>
      </div>

      <div className="ui-status">{status}</div>

     {/* 选择课程 + 章节管理（放前面） */}
<div className="ui-card">
  <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div className="ui-badge">章节管理</div>
      <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>选择课程后管理章节</div>
    </div>
  </div>

  <div className="ui-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
    <span className="ui-badge">当前课程</span>
    <select
      className="ui-select"
      value={selectedCourseId}
      onChange={(e) => setSelectedCourseId(e.target.value)}
      style={{ maxWidth: 420 }}
    >
      <option value="">请选择课程...</option>
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.order_index}. {c.title}
        </option>
      ))}
    </select>

    <button
      className="ui-btn"
      onClick={() => selectedCourseId && loadChapters(selectedCourseId)}
      disabled={!selectedCourseId}
    >
      刷新章节列表
    </button>

    
  </div>

  {!selectedCourseId ? (
    <div className="ui-card" style={{ marginTop: 12 }}>
      <p className="ui-subtitle">请先选择一门课程，然后再新增/查看该课程的章节。</p>
    </div>
  ) : (
    <>
      {/* 新增章节 */}
      <div className="ui-card" style={{ marginTop: 12 }}>
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>新增章节</div>
          <span className="ui-badge">{chapters.length} 章</span>
        </div>

        <div className="ui-col" style={{ marginTop: 12, maxWidth: 720 }}>
          <input
            className="ui-input"
            placeholder="章节标题（例如：第一章 绪论）"
            value={chapterTitle}
            onChange={(e) => setChapterTitle(e.target.value)}
          />

          <div className="ui-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="ui-badge">顺序</span>
            <input
              className="ui-input"
              style={{ maxWidth: 140 }}
              type="number"
              value={chapterOrder}
              onChange={(e) => setChapterOrder(Number(e.target.value))}
            />

            <button className="ui-btn ui-btn-primary" onClick={addChapter} disabled={creatingChapter}>
              {creatingChapter ? '添加中...' : '新增章节'}
            </button>
          </div>
        </div>
      </div>

      {/* 章节列表 */}
      <div className="ui-card" style={{ marginTop: 12 }}>
        <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="ui-title" style={{ fontSize: 16 }}>章节列表</h2>
          <span className="ui-badge">{chapters.length} 章</span>
        </div>

        {loadingChapters ? (
          <p className="ui-subtitle">Loading...</p>
        ) : chapters.length === 0 ? (
          <p className="ui-subtitle">该课程暂无章节，请先新增。</p>
        ) : (
          <>
            <div className="ui-only-desktop" style={{ marginTop: 10 }}>
              <table className="ui-table">
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
                          <Link className="ui-btn" href={`/admin/chapters/${c.id}`} style={{ textDecoration: 'none' }}>
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
            </div>

            <div className="ui-only-mobile" style={{ marginTop: 10 }}>
              <div className="ui-col" style={{ gap: 10 }}>
                {chapters.map((c) => (
                  <div key={c.id} className="ui-card" style={{ padding: 14 }}>
                    <div className="ui-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <span className="ui-badge" style={{ flex: '0 0 auto' }}>{c.order_index}</span>
                      <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        <div className="ui-admin-chapter-title">{c.title}</div>
                      </div>
                    </div>

                    <div className="ui-row" style={{ marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
                      <Link className="ui-btn ui-btn-xs" href={`/admin/chapters/${c.id}`} style={{ textDecoration: 'none' }}>
                        题目管理
                      </Link>
                      <button className="ui-btn ui-btn-danger ui-btn-xs" onClick={() => deleteChapter(c.id)}>
                        删除章节
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )}
</div>

{/* 新增课程（放后面） */}
<div className="ui-card">
  <div className="ui-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div className="ui-badge">课程管理</div>
      <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700 }}>新增课程</div>
    </div>
    <span className="ui-badge">{courses.length} 门课</span>
  </div>

  <div className="ui-col" style={{ marginTop: 12, maxWidth: 720 }}>
    <input
      className="ui-input"
      placeholder="课程标题（例如：心理病理学）"
      value={courseTitle}
      onChange={(e) => setCourseTitle(e.target.value)}
    />

    <div className="ui-row" style={{ gap: 10, flexWrap: 'wrap' }}>
      <span className="ui-badge">顺序</span>
      <input
        className="ui-input"
        style={{ maxWidth: 140 }}
        type="number"
        value={courseOrder}
        onChange={(e) => setCourseOrder(Number(e.target.value))}
      />

      <button className="ui-btn ui-btn-primary" onClick={addCourse} disabled={creatingCourse}>
        {creatingCourse ? '添加中...' : '新增课程'}
      </button>

      <button className="ui-btn" onClick={loadCourses}>
        刷新课程列表
      </button>
    </div>
    <div className="ui-divider" style={{ marginTop: 14, marginBottom: 12 }} />

    {role === 'owner' ? (
  <>
    <div className="ui-divider" style={{ marginTop: 14, marginBottom: 12 }} />

    <div className="ui-col" style={{ gap: 8 }}>
      <div className="ui-meta">危险操作（仅 owner 可见）</div>

      <button
        className="ui-btn ui-btn-danger"
        onClick={() => selectedCourseId && deleteCourse(selectedCourseId)}
        disabled={!selectedCourseId}
      >
        删除当前课程{selectedCourseId ? '' : '（请先在上方选择课程）'}
      </button>

      <div className="ui-subtitle">
        将级联删除：该课程下所有章节与题目。删除需要两次输入确认（课程标题 + DELETE）。
      </div>
    </div>
  </>
) : null}


  </div>
</div>

    </main>
  )
}
