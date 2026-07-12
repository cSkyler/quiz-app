import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const configs=[
  {
    slug:'psychological-counseling-process-methods',chapters:16,questions:288,
    required:['心理咨询','共同因素','三阶段模型','专业胜任力','知情同意','探索阶段','情感反映','治疗性沉默','领悟阶段','挑战','解释','联盟破裂','行动阶段','角色演练','个案概念化','复发预防'],
  },
  {
    slug:'psychological-measurement-assessment',chapters:12,questions:270,
    required:['心理测量','心理测评','标准化','经典测量理论','信度','效度','量表编制','知情同意','初始评估','精神状态检查','风险筛查','安全计划','人格','五因素模型','效度量表','人格病理','神经心理评估','表现效度','发展性评估','算法偏差'],
  },
]

function assert(condition,message,errors){if(!condition)errors.push(message)}

for(const config of configs){
  const directory=path.join(root,'content','course-packs',config.slug)
  const coursePackage=JSON.parse(await readFile(path.join(directory,'course-package.json'),'utf8'))
  const sql=await readFile(path.join(directory,'import.sql'),'utf8')
  const errors=[]
  const allQuestions=coursePackage.chapters.flatMap(chapter=>chapter.questions)
  const allText=JSON.stringify(coursePackage)
  const typeCounts={}
  for(const question of allQuestions)typeCounts[question.type]=(typeCounts[question.type]??0)+1
  assert(coursePackage.chapters.length===config.chapters,`章节数应为${config.chapters}`,errors)
  assert(allQuestions.length===config.questions,`题目数应为${config.questions}`,errors)
  assert(coursePackage.chapters.every(chapter=>chapter.review_content.split('---PAGE---').length>=9),'每章复习资料至少9页',errors)
  assert(coursePackage.chapters.every(chapter=>chapter.questions.some(question=>question.type==='case')),'每章必须有案例题',errors)
  assert(coursePackage.chapters.every(chapter=>chapter.questions.some(question=>question.type==='short')),'每章必须有简答题',errors)
  for(const term of config.required)assert(allText.includes(term),`缺少重点：${term}`,errors)
  for(const question of allQuestions){
    assert(question.stem.length>=12,`题干过短：${question.id}`,errors)
    if(question.options){
      assert(question.options.every(option=>option.text.length>=2),`选项过短：${question.id}`,errors)
      assert(new Set(question.options.map(option=>option.text)).size===4,`选项重复：${question.id}`,errors)
    }
  }
  if(config.slug==='psychological-measurement-assessment'){
    const objective=(typeCounts.single??0)+(typeCounts.multi??0)
    assert(objective/allQuestions.length>=0.85,'心测选择题比例必须至少85%',errors)
    const core=coursePackage.chapters.filter(chapter=>chapter.priority==='core')
    const normal=coursePackage.chapters.filter(chapter=>chapter.priority!=='core')
    assert(core.length===5,'心测核心章节应为5章',errors)
    assert(Math.min(...core.map(chapter=>chapter.questions.length))>Math.max(...normal.map(chapter=>chapter.questions.length)),'核心章节题量必须高于普通章节',errors)
  }
  if(config.slug==='psychological-counseling-process-methods'){
    assert(typeCounts.single===112&&typeCounts.multi===48&&typeCounts.blank===48&&typeCounts.short===48&&typeCounts.case===32,'咨询课题型分布不符合修订后的多样化结构',errors)
    for(const chapter of coursePackage.chapters){
      const stems=chapter.questions.map(question=>question.stem.replace(/\s+/g,''))
      assert(new Set(stems).size===stems.length,`${chapter.title}存在重复题干`,errors)
      const blanks=chapter.questions.filter(question=>question.type==='blank')
      const cases=chapter.questions.filter(question=>question.type==='case')
      const systemQuestions=chapter.questions.filter(question=>question.type==='short'&&question.stem.includes('主要技术或核心要点'))
      const singleAnswers=new Set(chapter.questions.filter(question=>question.type==='single').map(question=>question.options.find(option=>option.key===question.answer.correct)?.text).filter(Boolean))
      const blankAnswers=blanks.flatMap(question=>question.answer.correct)
      assert(blanks.length===3,`${chapter.title}应包含3道流程填空题`,errors)
      assert(cases.length===2,`${chapter.title}应包含2道不同案例题`,errors)
      assert(systemQuestions.length===1,`${chapter.title}应包含1道技术体系列举题`,errors)
      assert(blanks.every(question=>question.stem.includes('补全工作流程')),`${chapter.title}填空题不得重复概念定义题`,errors)
      assert(blankAnswers.every(answer=>!singleAnswers.has(answer)),`${chapter.title}选择题与填空题使用了相同答案考点`,errors)
    }
    const explanationChapter=coursePackage.chapters.find(chapter=>chapter.title.includes('解释的技术'))
    const explanationSystemQuestion=explanationChapter?.questions.find(question=>question.type==='short'&&question.stem.includes('主要技术或核心要点'))
    for(const term of ['解释','解释焦点','试探性语言','解释证据','功能性理解','解释深度','解释检验']){
      assert(explanationSystemQuestion?.answer?.reference?.includes(term),`“解释的技术有哪些”缺少要点：${term}`,errors)
    }
  }
  const lowerSql=sql.toLowerCase()
  for(const forbidden of ['delete from','truncate ','auth.users','user_question_status','chapter_progress','attempts','user_mastery'])assert(!lowerSql.includes(forbidden),`SQL包含禁止操作：${forbidden}`,errors)
  for(const table of ['public.courses','public.course_brief','public.chapters','public.chapter_review_notes','public.questions'])assert(lowerSql.includes(table),`SQL缺少内容表：${table}`,errors)
  assert(lowerSql.includes('begin;')&&lowerSql.includes('commit;'),'SQL必须使用事务',errors)
  if(errors.length)throw new Error(`${config.slug} 审计失败：\n${errors.join('\n')}`)
  console.log(JSON.stringify({slug:config.slug,valid:true,chapters:coursePackage.chapters.length,questions:allQuestions.length,typeCounts},null,2))
}

const protectedSql=(await readFile(path.join(root,'content','course-packs','protected-content-only.sql'),'utf8')).toLowerCase()
const protectedErrors=[]
assert(protectedSql.includes('begin;')&&protectedSql.includes('commit;'),'受保护内容SQL必须使用事务',protectedErrors)
assert((protectedSql.match(/insert into public\.course_brief/g)??[]).length===2,'受保护内容SQL应包含2条课程简介写入',protectedErrors)
assert((protectedSql.match(/insert into public\.chapter_review_notes/g)??[]).length===28,'受保护内容SQL应包含28条复习资料写入',protectedErrors)
for(const forbidden of ['delete from','truncate ','auth.users','user_question_status','chapter_progress','attempts','user_mastery'])assert(!protectedSql.includes(forbidden),`受保护内容SQL包含禁止操作：${forbidden}`,protectedErrors)
if(protectedErrors.length)throw new Error(`protected-content-only.sql 审计失败：\n${protectedErrors.join('\n')}`)
console.log(JSON.stringify({slug:'protected-content-only',valid:true,courseBriefs:2,reviewNotes:28},null,2))
