'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Course = { id: string; title: string; order_index: number; created_at?: string }
type Chapter = { id: string; title: string; order_index: number; course_id: string; created_at?: string }

export default function AdminPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [announcement, setAnnouncement] = useState('')
  const [changelog, setChangelog] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [status, setStatus] = useState('Checking auth...')
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  // courses
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  // create course
  const [courseTitle, setCourseTitle] = useState('')
  const [courseOrder, setCourseOrder] = useState<number>(1)
  const [creatingCourse, setCreatingCourse] = useState(false)

  // chapters for selected course
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

    // 自动选中第一个课程（如果还没选）
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

  useEffect(() => {
    let cancelled = false
    

    ;(async () => {
      setStatus('Checking auth...')
      const { data: sess } = await supabase.auth.getSession()
      const user = sess.session?.user

      if (!user) {
        setIsAdmin(false)
        setStatus('Not logged in. Go to /login first.')
        return
      }

      setEmail(user.email ?? null)

      // role check
      const { data: profile, error: pErr } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      if (pErr) {
        setIsAdmin(false)
        setStatus(`ERROR reading profile: ${pErr.message}`)
        return
      }

      const isPrivileged = profile?.role === 'admin' || profile?.role === 'owner'

if (!isPrivileged) {
  setIsAdmin(false)
  setStatus(`Logged in as ${user.email}, role=${profile?.role}. Not authorized.`)
  return
}
// 读取公告/更新说明（所有人可读，owner 可写）
{
  const { data, error } = await supabase
    .from('site_settings')
    .select('key,value')
    .in('key', ['announcement', 'changelog'])

  if (!error && data) {
    const map: Record<string, string> = {}
    for (const r of data) map[r.key] = r.value
    setAnnouncement(map.announcement ?? '')
    setChangelog(map.changelog ?? '')
  }
}

setIsAdmin(true)

      const { data, error } = await supabase
      .from('site_settings')
      .select('key,value')
      .in('key', ['announcement', 'changelog'])
  
    if (!error && data) {
      const map: Record<string, string> = {}
      for (const r of data) map[r.key] = r.value
      setAnnouncement(map.announcement ?? '')
      setChangelog(map.changelog ?? '')
    }
      if (cancelled) return
      setIsAdmin(true)
      setStatus('OK: admin')

      await loadCourses()
    })()
    async function saveSiteSettings() {
      setSaving(true)
      try {
        const { data: sess } = await supabase.auth.getSession()
        const uid = sess.session?.user?.id ?? null
    
        const rows = [
          { key: 'announcement', value: announcement, updated_by: uid, updated_at: new Date().toISOString() },
          { key: 'changelog', value: changelog, updated_by: uid, updated_at: new Date().toISOString() },
        ]
    
        const { error } = await supabase
          .from('site_settings')
          .upsert(rows, { onConflict: 'key' })
    
        if (error) alert(`保存失败：${error.message}`)
        else alert('已保存')
      } finally {
        setSaving(false)
      }
    }
    
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  // 当选择课程变化时，加载该课程的章节
  useEffect(() => {
    if (!isAdmin) return
    if (!selectedCourseId) {
      setChapters([])
      return
    }
    loadChapters(selectedCourseId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, isAdmin])

  async function addCourse() {
    const title = courseTitle.trim()
    if (!title) {
      setStatus('ERROR: 课程标题不能为空')
      return
    }

    setCreatingCourse(true)
    setStatus('Adding course...')

    const { error } = await supabase.from('courses').insert([
      {
        title,
        order_index: Number(courseOrder) || 1
      }
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
      {
        course_id: selectedCourseId,
        title,
        order_index: Number(chapterOrder) || 1
      }
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

  if (!isAdmin) {
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
  async function saveSiteSettings() {
    setSaving(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const uid = sess.session?.user?.id ?? null
  
      const rows = [
        { key: 'announcement', value: announcement, updated_by: uid, updated_at: new Date().toISOString() },
        { key: 'changelog', value: changelog, updated_by: uid, updated_at: new Date().toISOString() },
      ]
  
      const { error } = await supabase
        .from('site_settings')
        .upsert(rows, { onConflict: 'key' })
  
      if (error) alert(`保存失败：${error.message}`)
      else alert('已保存')
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <main className="ui-container">
      <div className="ui-topbar">
        <div>
          <h1 className="ui-title">管理端</h1>
          <p className="ui-subtitle">{email ? `管理员：${email}` : '管理员'}</p>
        </div>
        <div className="ui-row" style={{ gap: 10 }}>
          <Link className="ui-link" href="/">🏠 首页</Link>
          <Link className="ui-link" href="/courses">课程</Link>
          <button className="ui-link" onClick={signOut} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
            退出登录
          </button>
        </div>
      </div>

      <div className="ui-status">{status}</div>

      {/* 新增课程 */}
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
        </div>
      </div>

      {/* 选择课程 + 章节管理 */}
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

          <button className="ui-btn" onClick={() => selectedCourseId && loadChapters(selectedCourseId)} disabled={!selectedCourseId}>
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
                <table className="ui-table" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>顺序</th>
                      <th>章节</th>
                      <th style={{ width: 240 }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chapters.map((ch) => (
                      <tr key={ch.id}>
                        <td>{ch.order_index}</td>
                        <td style={{ fontWeight: 600 }}>{ch.title}</td>
                        <td>
                          <div className="ui-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <Link className="ui-btn" href={`/admin/chapters/${ch.id}`} style={{ textDecoration: 'none' }}>
                              题目管理
                            </Link>
                            <button className="ui-btn ui-btn-danger" onClick={() => deleteChapter(ch.id)}>
                              删除章节
                            </button>
                          </div>
                        </td>
                        
                      </tr>
                      
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="ui-card" style={{ marginTop: 14 }}>
  <h2 className="ui-title" style={{ fontSize: 18, marginTop: 0 }}>公告与更新</h2>

  <div className="ui-subtitle" style={{ marginTop: 8 }}>公告（首页展示）</div>
  <textarea
    className="ui-textarea"
    rows={5}
    value={announcement}
    onChange={(e) => setAnnouncement(e.target.value)}
    placeholder="写给同学们的公告…"
  />

  <div className="ui-subtitle" style={{ marginTop: 10 }}>更新说明（首页展示）</div>
  <textarea
    className="ui-textarea"
    rows={6}
    value={changelog}
    onChange={(e) => setChangelog(e.target.value)}
    placeholder="本次更新内容…"
  />

  <div className="ui-row" style={{ marginTop: 12, gap: 10 }}>
    <button className="ui-btn ui-btn-primary" onClick={saveSiteSettings} disabled={saving}>
      {saving ? '保存中…' : '保存'}
    </button>
  </div>

  <p className="ui-subtitle" style={{ marginTop: 10 }}>
    仅 owner 可保存；其他角色会被数据库 RLS 拒绝。
  </p>
</div>

          </>
        )}
      </div>
    </main>
  )
}
