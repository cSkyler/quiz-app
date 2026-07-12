'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Save, Settings } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

const keys = ['announcement', 'changelog', 'landing_intro', 'disclaimer'] as const
type Key = typeof keys[number]

export default function AdminSettingsPage(){
  const supabase=useMemo(()=>supabaseBrowser(),[])
  const[allowed,setAllowed]=useState<boolean|null>(null)
  const[values,setValues]=useState<Record<Key,string>>({announcement:'',changelog:'',landing_intro:'',disclaimer:''})
  const[status,setStatus]=useState('');const[saving,setSaving]=useState(false)
  useEffect(()=>{;(async()=>{const{data:s}=await supabase.auth.getSession();const user=s.session?.user;if(!user){setAllowed(false);return}const{data:p}=await supabase.from('user_profiles').select('role').eq('user_id',user.id).maybeSingle();const ok=p?.role==='admin'||p?.role==='owner';setAllowed(ok);if(!ok)return;const{data}=await supabase.from('site_settings').select('key,value').in('key',[...keys]);setValues(prev=>{const next={...prev};for(const row of data??[]){if(keys.includes(row.key as Key))next[row.key as Key]=row.value??''}return next})})()},[supabase])
  async function save(){setSaving(true);setStatus('');try{const{error}=await supabase.from('site_settings').upsert(keys.map(key=>({key,value:values[key]})),{onConflict:'key'});if(error)throw error;setStatus('平台设置已保存。')}catch(error){setStatus(`保存失败：${error instanceof Error?error.message:'未知错误'}`)}finally{setSaving(false)}}
  if(allowed===null)return <main className="workspace-page"><div className="ui-status">正在检查管理权限…</div></main>
  if(!allowed)return <main className="workspace-page"><div className="empty-state"><AlertTriangle/><strong>没有管理权限</strong></div></main>
  return <main className="workspace-page"><div className="workspace-heading"><div><span className="page-eyebrow">平台管理</span><h1>平台设置</h1><p>维护官网说明、学生公告和重要提示。</p></div></div>{status?<div className="admin-notice">{status}</div>:null}<section className="panel settings-panel"><div className="panel-heading"><div><h2>公开内容</h2><p>保存后由对应页面读取；空白内容会使用系统默认文案</p></div><Settings size={19}/></div><div className="admin-form-grid"><label className="is-full">官网简介<textarea rows={4} value={values.landing_intro} onChange={e=>setValues({...values,landing_intro:e.target.value})} placeholder="MAPer 学习平台的公开介绍"/></label><label className="is-full">学习首页公告<textarea rows={6} value={values.announcement} onChange={e=>setValues({...values,announcement:e.target.value})}/></label><label className="is-full">更新记录<textarea rows={6} value={values.changelog} onChange={e=>setValues({...values,changelog:e.target.value})}/></label><label className="is-full">免责声明<textarea rows={4} value={values.disclaimer} onChange={e=>setValues({...values,disclaimer:e.target.value})} placeholder="题目与解析如与课堂标准答案冲突，请以课堂为准。"/></label></div><button className="button button--primary" onClick={save} disabled={saving}><Save size={16}/>{saving?'正在保存…':'保存平台设置'}</button></section></main>
}
