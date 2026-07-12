'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BarChart3, BookOpen, CheckCircle2, RotateCcw, Target } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type Row = { course_id: string; total: number; green: number; yellow: number; red: number; attempted: number; unseen: number }
type Course = { id: string; title: string }

export default function ProgressPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [rows, setRows] = useState<Row[]>([])
  const [courses, setCourses] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => { ;(async () => { const { data: session } = await supabase.auth.getSession(); const user = session.session?.user; const [{ data: courseRows }, { data: progressRows }] = await Promise.all([supabase.from('courses').select('id,title'), user ? supabase.from('v_progress_courses').select('course_id,total,green,yellow,red,attempted,unseen').eq('user_id', user.id) : Promise.resolve({ data: [] })]); const map: Record<string,string> = {}; for (const c of (courseRows ?? []) as Course[]) map[c.id] = c.title; setCourses(map); setRows((progressRows ?? []) as Row[]); setLoading(false) })() }, [supabase])
  const totals = rows.reduce((a,r) => ({ total:a.total+r.total, green:a.green+r.green, red:a.red+r.red, attempted:a.attempted+r.attempted }), {total:0,green:0,red:0,attempted:0})
  return <main className="workspace-page"><div className="workspace-heading"><div><span className="page-eyebrow">学习分析</span><h1>学习进度</h1><p>用完成度和掌握状态决定下一次复习重点。</p></div></div><section className="metric-grid metric-grid--three"><article><span className="metric-icon"><BookOpen size={19}/></span><div><small>累计已练习</small><strong>{loading?'—':totals.attempted}</strong><em>共 {totals.total} 道题</em></div></article><article><span className="metric-icon is-teal"><CheckCircle2 size={19}/></span><div><small>已掌握</small><strong>{loading?'—':totals.green}</strong><em>{totals.attempted?Math.round(totals.green/totals.attempted*100):0}% 已练习题目</em></div></article><article><span className="metric-icon is-amber"><RotateCcw size={19}/></span><div><small>需重点复习</small><strong>{loading?'—':totals.red}</strong><em>红色掌握状态</em></div></article></section><section className="panel progress-panel"><div className="panel-heading"><div><h2>课程完成情况</h2><p>进度来自现有学习记录</p></div><BarChart3 size={19}/></div><div className="progress-course-list">{rows.map(row=>{const pct=row.total?Math.round(row.attempted/row.total*100):0;return <div className="progress-course-row" key={row.course_id}><div><strong>{courses[row.course_id]??'课程'}</strong><small>{row.attempted} / {row.total} 道题已练习</small></div><div className="stacked-progress"><i className="is-green" style={{width:`${row.total?row.green/row.total*100:0}%`}}/><i className="is-yellow" style={{width:`${row.total?row.yellow/row.total*100:0}%`}}/><i className="is-red" style={{width:`${row.total?row.red/row.total*100:0}%`}}/></div><strong>{pct}%</strong><Link href={`/courses/${row.course_id}`}>查看课程 <ArrowRight size={15}/></Link></div>})}{!loading&&rows.length===0?<div className="empty-state"><Target size={24}/><strong>还没有学习记录</strong><p>完成一次章节练习后，这里会显示课程进度。</p><Link className="button button--primary" href="/courses">选择课程</Link></div>:null}</div></section></main>
}
