'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileJson, Upload } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

type QuestionType = 'tf' | 'single' | 'multi' | 'blank' | 'short' | 'case' | 'order'
type PackageQuestion = { id:string; chapter_id:string; type:QuestionType; stem:string; options:Array<{key:string;text:string}>|null; answer:Record<string,unknown>; explanation:string|null }
type PackageChapter = { id:string; course_id:string; title:string; order_index:number; provided_by:string|null; priority?:string; review_content:string; questions:PackageQuestion[] }
type CoursePackage = {
  version:number
  course:{ id:string; title:string; description:string|null; order_index:number }
  brief:{ exam_date:string; exam_structure:string; assignments:string; study_tips:string }
  chapters:PackageChapter[]
}

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const optionKeys=['A','B','C','D']
const allowedTypes=new Set<QuestionType>(['tf','single','multi','blank','short','case','order'])

function validateQuestion(question:PackageQuestion,label:string,errors:string[]){
  if(!uuidPattern.test(question.id??''))errors.push(`${label}：题目 ID 无效`)
  if(!allowedTypes.has(question.type))errors.push(`${label}：题型不支持`)
  if(!question.stem?.trim())errors.push(`${label}：题干为空`)
  if(!question.answer||typeof question.answer!=='object')errors.push(`${label}：答案缺失`)
  if(question.type==='single'||question.type==='multi'){
    if(!Array.isArray(question.options)||question.options.length!==4)errors.push(`${label}：选择题必须有4个选项`)
    const keys=question.options?.map(option=>option.key)
    if(JSON.stringify(keys)!==JSON.stringify(optionKeys))errors.push(`${label}：选项键必须依次为A-D`)
    if(question.options?.some(option=>!option.text?.trim()))errors.push(`${label}：选项文字为空`)
    if(new Set(question.options?.map(option=>option.text.trim())).size!==4)errors.push(`${label}：存在重复选项`)
  }
  if(question.type==='single'&&!optionKeys.includes(String(question.answer.correct??'')))errors.push(`${label}：单选答案无效`)
  if(question.type==='multi'){
    const correct=question.answer.correct
    if(!Array.isArray(correct)||correct.length<2||correct.some(key=>!optionKeys.includes(String(key))))errors.push(`${label}：多选答案无效`)
  }
  if(question.type==='blank'&&(!Array.isArray(question.answer.correct)||question.answer.correct.length===0))errors.push(`${label}：填空答案无效`)
  if((question.type==='short'||question.type==='case')&&!String(question.answer.reference??'').trim())errors.push(`${label}：主观题参考答案为空`)
}

function validatePackage(value:unknown){
  const errors:string[]=[]
  if(!value||typeof value!=='object')return{errors:['JSON 顶层必须是对象'],parsed:null}
  const parsed=value as CoursePackage
  if(parsed.version!==1)errors.push('课程包 version 必须为1')
  if(!uuidPattern.test(parsed.course?.id??''))errors.push('课程 ID 无效')
  if(!parsed.course?.title?.trim())errors.push('课程名称为空')
  if(parsed.brief?.exam_date!=='2026-07-19')errors.push('考试日期必须为2026-07-19')
  if(!Array.isArray(parsed.chapters)||parsed.chapters.length===0)errors.push('章节数组为空')
  const ids=new Set<string>();const signatures=new Set<string>()
  parsed.chapters?.forEach((chapter,chapterIndex)=>{
    const chapterLabel=`第${chapterIndex+1}章`
    if(!uuidPattern.test(chapter.id??''))errors.push(`${chapterLabel}：章节 ID 无效`)
    if(chapter.course_id!==parsed.course.id)errors.push(`${chapterLabel}：course_id 不一致`)
    if(!chapter.title?.trim())errors.push(`${chapterLabel}：章节名称为空`)
    if(chapter.order_index!==chapterIndex+1)errors.push(`${chapterLabel}：章节排序不连续`)
    if(!chapter.review_content?.trim())errors.push(`${chapterLabel}：复习资料为空`)
    if(!Array.isArray(chapter.questions)||chapter.questions.length===0)errors.push(`${chapterLabel}：题目为空`)
    chapter.questions?.forEach((question,questionIndex)=>{
      const label=`${chapterLabel}第${questionIndex+1}题`
      validateQuestion(question,label,errors)
      if(question.chapter_id!==chapter.id)errors.push(`${label}：chapter_id 不一致`)
      if(ids.has(question.id))errors.push(`${label}：题目 ID 重复`)
      ids.add(question.id)
      const signature=JSON.stringify({stem:question.stem?.replace(/\s+/g,''),options:question.options?.map(option=>option.text.replace(/\s+/g,''))??null})
      if(signatures.has(signature))errors.push(`${label}：题干与选项组合重复`)
      signatures.add(signature)
    })
  })
  return{errors,parsed}
}

function countTypes(coursePackage:CoursePackage){
  const counts:Record<string,number>={}
  for(const chapter of coursePackage.chapters)for(const question of chapter.questions)counts[question.type]=(counts[question.type]??0)+1
  return counts
}

function errorMessage(error:unknown){
  if(error instanceof Error)return error.message
  if(error&&typeof error==='object'&&'message' in error)return String((error as{message:unknown}).message)
  try{return JSON.stringify(error)}catch{return '未知错误'}
}

export default function CoursePackageImporter({onImported}:{onImported?:()=>void|Promise<void>}){
  const supabase=useMemo(()=>supabaseBrowser(),[])
  const[allowed,setAllowed]=useState<boolean|null>(null)
  const[raw,setRaw]=useState('');const[checkedPackage,setCheckedPackage]=useState<CoursePackage|null>(null)
  const[errors,setErrors]=useState<string[]>([]);const[status,setStatus]=useState('');const[importing,setImporting]=useState(false)
  const preview=checkedPackage?{chapters:checkedPackage.chapters.length,questions:checkedPackage.chapters.reduce((total,chapter)=>total+chapter.questions.length,0),reviews:checkedPackage.chapters.filter(chapter=>chapter.review_content.trim()).length,types:countTypes(checkedPackage)}:null

  useEffect(()=>{;(async()=>{const{data:sessionData}=await supabase.auth.getSession();const user=sessionData.session?.user;if(!user){setAllowed(false);return}const{data:profile}=await supabase.from('user_profiles').select('role').eq('user_id',user.id).maybeSingle();setAllowed(profile?.role==='admin'||profile?.role==='owner')})()},[supabase])

  function inspect(){
    setStatus('');setCheckedPackage(null);setErrors([])
    try{const result=validatePackage(JSON.parse(raw));if(result.errors.length){setErrors(result.errors.slice(0,20));return}setCheckedPackage(result.parsed);setStatus('完整课程包检查通过，可以导入。')}
    catch(error){setErrors([`JSON 解析失败：${error instanceof Error?error.message:'未知错误'}`])}
  }

  async function importPackage(){
    if(!checkedPackage)return
    setImporting(true);setStatus('正在执行导入前冲突检查…');setErrors([])
    try{
      const{data:existingById,error:idError}=await supabase.from('courses').select('id,title').eq('id',checkedPackage.course.id).maybeSingle();if(idError)throw idError
      if(existingById&&existingById.title!==checkedPackage.course.title)throw new Error('课程 ID 已被其他课程使用，已停止导入。')
      const{data:sameTitle,error:titleError}=await supabase.from('courses').select('id,title').eq('title',checkedPackage.course.title).neq('id',checkedPackage.course.id).limit(1);if(titleError)throw titleError
      if(sameTitle?.length)throw new Error('数据库已有同名但不同 ID 的课程，已停止导入以避免重复。')
      const{error:courseError}=await supabase.from('courses').upsert(checkedPackage.course,{onConflict:'id'});if(courseError)throw courseError
      const chapterRows=checkedPackage.chapters.map(({id,course_id,title,order_index,provided_by})=>({id,course_id,title,order_index,provided_by}))
      const{error:chapterError}=await supabase.from('chapters').upsert(chapterRows,{onConflict:'id'});if(chapterError)throw chapterError
      const questionRows=checkedPackage.chapters.flatMap(chapter=>chapter.questions.map(question=>({id:question.id,chapter_id:chapter.id,type:question.type,stem:question.stem.trim(),options:question.options,answer:question.answer,explanation:question.explanation?.trim()||null})))
      for(let index=0;index<questionRows.length;index+=100){const{error:questionError}=await supabase.from('questions').upsert(questionRows.slice(index,index+100),{onConflict:'id'});if(questionError)throw questionError}
      let noteWarning=false
      for(const chapter of checkedPackage.chapters){
        const{data:existingNote,error:noteReadError}=await supabase.from('chapter_review_notes').select('chapter_id').eq('course_id',checkedPackage.course.id).eq('chapter_id',chapter.id).maybeSingle();if(noteReadError)throw noteReadError
        const noteQuery=existingNote?supabase.from('chapter_review_notes').update({content:chapter.review_content}).eq('course_id',checkedPackage.course.id).eq('chapter_id',chapter.id):supabase.from('chapter_review_notes').insert({course_id:checkedPackage.course.id,chapter_id:chapter.id,content:chapter.review_content})
        const{error:noteWriteError}=await noteQuery
        if(noteWriteError){if(String(noteWriteError.message??'').includes('row-level security')){noteWarning=true;break}throw noteWriteError}
      }
      const{error:briefError}=await supabase.from('course_brief').upsert({course_id:checkedPackage.course.id,...checkedPackage.brief},{onConflict:'course_id'})
      if(briefError&&!String(briefError.message??'').includes('row-level security'))throw briefError
      if(noteWarning||briefError)setErrors(['课程、章节和题目已导入；数据库 RLS 未允许前端同步课程简介或复习资料。如课程包中的受保护内容有变化，请执行 content/course-packs/protected-content-only.sql。'])
      setStatus(`导入完成：${checkedPackage.course.title}，${checkedPackage.chapters.length}章，${questionRows.length}题${noteWarning||briefError?'；受保护内容未由前端同步':'。'}`);await onImported?.()
    }catch(error){setErrors([`导入停止：${errorMessage(error)}`])}finally{setImporting(false)}
  }

  if(allowed===null)return <section className="panel"><div className="ui-status">正在检查管理权限…</div></section>
  if(!allowed)return <section className="panel"><div className="empty-state"><AlertTriangle/><strong>没有管理权限</strong><p>只有管理员和 Owner 可以导入完整课程包。</p></div></section>
  return <section className="panel course-package-importer" id="course-package-import"><div className="panel-heading"><div><h2>完整课程包导入</h2><p>先检查课程、章节、资料、题型和答案，检查通过后才允许写入</p></div><FileJson size={20}/></div><textarea data-testid="course-package-json" className="json-editor" rows={8} value={raw} onChange={event=>{setRaw(event.target.value);setCheckedPackage(null);setErrors([]);setStatus('')}} placeholder="粘贴 course-package.json。完整课程包包含课程、章节、复习资料和题目。"/>{errors.length?<div className="admin-error course-package-errors"><AlertTriangle size={17}/><div>{errors.map(error=><p key={error}>{error}</p>)}</div></div>:null}{status?<div className="admin-notice"><CheckCircle2 size={17}/>{status}</div>:null}{preview?<div className="course-package-preview"><strong>{checkedPackage?.course.title}</strong><span>{preview.chapters} 章</span><span>{preview.reviews} 章资料</span><span>{preview.questions} 题</span><span>{Object.entries(preview.types).map(([type,count])=>`${type} ${count}`).join(' / ')}</span></div>:null}<div className="import-actions"><button className="button button--secondary" type="button" onClick={inspect} disabled={!raw.trim()||importing}>检查完整课程包</button><span>不会删除课程、用户、进度、错题或作答记录</span><button className="button button--primary" type="button" onClick={importPackage} disabled={!checkedPackage||importing}><Upload size={16}/>{importing?'正在导入…':'确认导入完整课程'}</button></div></section>
}
