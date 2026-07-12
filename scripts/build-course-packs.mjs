import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import consultingCourse from './course-content/consulting.mjs'
import assessmentCourse from './course-content/assessment.mjs'
import { buildCoursePackage, packageStats, validateCoursePackage } from './course-pack-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputRoot = path.join(root, 'content', 'course-packs')

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlJson(value) {
  if (value === null || value === undefined) return 'NULL'
  return `${sqlString(JSON.stringify(value))}::jsonb`
}

function buildSql(coursePackage) {
  const lines = [
    '-- Generated MAPer course package. Safe scope: course content tables only.',
    'begin;',
    '',
    `insert into public.courses (id, title, description, order_index) values (${sqlString(coursePackage.course.id)}::uuid, ${sqlString(coursePackage.course.title)}, ${sqlString(coursePackage.course.description)}, ${coursePackage.course.order_index})`,
    'on conflict (id) do update set title = excluded.title, description = excluded.description, order_index = excluded.order_index;',
    '',
    `insert into public.course_brief (course_id, exam_date, exam_structure, assignments, study_tips) values (${sqlString(coursePackage.course.id)}::uuid, ${sqlString(coursePackage.brief.exam_date)}::date, ${sqlString(coursePackage.brief.exam_structure)}, ${sqlString(coursePackage.brief.assignments)}, ${sqlString(coursePackage.brief.study_tips)})`,
    'on conflict (course_id) do update set exam_date = excluded.exam_date, exam_structure = excluded.exam_structure, assignments = excluded.assignments, study_tips = excluded.study_tips;',
    '',
  ]

  for (const chapter of coursePackage.chapters) {
    lines.push(
      `insert into public.chapters (id, course_id, title, order_index, provided_by) values (${sqlString(chapter.id)}::uuid, ${sqlString(coursePackage.course.id)}::uuid, ${sqlString(chapter.title)}, ${chapter.order_index}, ${sqlString(chapter.provided_by)})`,
      'on conflict (id) do update set course_id = excluded.course_id, title = excluded.title, order_index = excluded.order_index, provided_by = excluded.provided_by;',
    )
  }

  lines.push('')
  for (const chapter of coursePackage.chapters) {
    lines.push(
      `update public.chapter_review_notes set content = ${sqlString(chapter.review_content)} where course_id = ${sqlString(coursePackage.course.id)}::uuid and chapter_id = ${sqlString(chapter.id)}::uuid;`,
      `insert into public.chapter_review_notes (course_id, chapter_id, content) select ${sqlString(coursePackage.course.id)}::uuid, ${sqlString(chapter.id)}::uuid, ${sqlString(chapter.review_content)} where not exists (select 1 from public.chapter_review_notes where course_id = ${sqlString(coursePackage.course.id)}::uuid and chapter_id = ${sqlString(chapter.id)}::uuid);`,
    )
  }

  lines.push('')
  for (const chapter of coursePackage.chapters) {
    for (const question of chapter.questions) {
      lines.push(
        `insert into public.questions (id, chapter_id, type, stem, options, answer, explanation) values (${sqlString(question.id)}::uuid, ${sqlString(chapter.id)}::uuid, ${sqlString(question.type)}, ${sqlString(question.stem)}, ${sqlJson(question.options)}, ${sqlJson(question.answer)}, ${sqlString(question.explanation)})`,
        'on conflict (id) do update set chapter_id = excluded.chapter_id, type = excluded.type, stem = excluded.stem, options = excluded.options, answer = excluded.answer, explanation = excluded.explanation;',
      )
    }
  }

  lines.push('', 'commit;', '')
  return lines.join('\n')
}

function buildVerificationSql(coursePackage) {
  return [
    '-- Read-only verification after import.',
    `select id, title, order_index from public.courses where id = ${sqlString(coursePackage.course.id)}::uuid;`,
    `select count(*) as chapter_count from public.chapters where course_id = ${sqlString(coursePackage.course.id)}::uuid;`,
    `select c.order_index, c.title, count(q.id) as question_count`,
    'from public.chapters c left join public.questions q on q.chapter_id = c.id',
    `where c.course_id = ${sqlString(coursePackage.course.id)}::uuid`,
    'group by c.id, c.order_index, c.title order by c.order_index;',
    `select q.type, count(*) as question_count from public.questions q join public.chapters c on c.id = q.chapter_id where c.course_id = ${sqlString(coursePackage.course.id)}::uuid group by q.type order by q.type;`,
    `select count(*) as review_count from public.chapter_review_notes where course_id = ${sqlString(coursePackage.course.id)}::uuid;`,
    '',
  ].join('\n')
}

function buildBriefSql(coursePackage) {
  return [
    '-- Use this small patch only when the browser import reports that course_brief insert is blocked by RLS.',
    'begin;',
    `insert into public.course_brief (course_id, exam_date, exam_structure, assignments, study_tips) values (${sqlString(coursePackage.course.id)}::uuid, ${sqlString(coursePackage.brief.exam_date)}::date, ${sqlString(coursePackage.brief.exam_structure)}, ${sqlString(coursePackage.brief.assignments)}, ${sqlString(coursePackage.brief.study_tips)})`,
    'on conflict (course_id) do update set exam_date = excluded.exam_date, exam_structure = excluded.exam_structure, assignments = excluded.assignments, study_tips = excluded.study_tips;',
    'commit;',
    '',
  ].join('\n')
}

function buildProtectedContentSql(coursePackage) {
  const lines=[
    `-- Protected content for ${coursePackage.course.title}.`,
    `insert into public.course_brief (course_id, exam_date, exam_structure, assignments, study_tips) values (${sqlString(coursePackage.course.id)}::uuid, ${sqlString(coursePackage.brief.exam_date)}::date, ${sqlString(coursePackage.brief.exam_structure)}, ${sqlString(coursePackage.brief.assignments)}, ${sqlString(coursePackage.brief.study_tips)})`,
    'on conflict (course_id) do update set exam_date = excluded.exam_date, exam_structure = excluded.exam_structure, assignments = excluded.assignments, study_tips = excluded.study_tips;',
    '',
  ]
  for(const chapter of coursePackage.chapters){
    lines.push(
      `update public.chapter_review_notes set content = ${sqlString(chapter.review_content)} where course_id = ${sqlString(coursePackage.course.id)}::uuid and chapter_id = ${sqlString(chapter.id)}::uuid;`,
      `insert into public.chapter_review_notes (course_id, chapter_id, content) select ${sqlString(coursePackage.course.id)}::uuid, ${sqlString(chapter.id)}::uuid, ${sqlString(chapter.review_content)} where not exists (select 1 from public.chapter_review_notes where course_id = ${sqlString(coursePackage.course.id)}::uuid and chapter_id = ${sqlString(chapter.id)}::uuid);`,
    )
  }
  return lines.join('\n')
}

function buildReadme(coursePackage, stats) {
  return `# ${coursePackage.course.title}\n\n` +
    `- 课程 ID：${coursePackage.course.id}\n` +
    `- 章节：${stats.chapters}\n` +
    `- 题目：${stats.questions}\n` +
    `- 题型：${Object.entries(stats.types).map(([type, count]) => `${type} ${count}`).join('、')}\n` +
    `- 核心章节题量：${stats.coreQuestions}\n` +
    `- 考试日期：${coursePackage.brief.exam_date}\n\n` +
    `## 导入方式\n\n` +
    `推荐在 MAPer 管理后台使用 \`course-package.json\` 完整导入。也可以在 Supabase SQL Editor 中执行 \`import.sql\`。\n\n` +
    `分章题目位于 \`questions/\`，每个文件都是现有章节后台可识别的 JSON 数组。\n\n` +
    `导入后执行 \`verify.sql\` 检查章节、资料和题量。所有 ID 固定，重复执行不会生成重复课程或重复题目。\n`
}

async function writePackage(course) {
  const coursePackage = buildCoursePackage(course)
  const errors = validateCoursePackage(coursePackage)
  if (errors.length) throw new Error(`${course.title} 校验失败：\n${errors.join('\n')}`)

  const stats = packageStats(coursePackage)
  const directory = path.join(outputRoot, course.slug)
  await rm(directory, { recursive: true, force: true })
  await mkdir(path.join(directory, 'questions'), { recursive: true })
  await mkdir(path.join(directory, 'reviews'), { recursive: true })

  await writeFile(path.join(directory, 'course-package.json'), `${JSON.stringify(coursePackage, null, 2)}\n`, 'utf8')
  await writeFile(path.join(directory, 'import.sql'), buildSql(coursePackage), 'utf8')
  await writeFile(path.join(directory, 'brief-only.sql'), buildBriefSql(coursePackage), 'utf8')
  await writeFile(path.join(directory, 'verify.sql'), buildVerificationSql(coursePackage), 'utf8')
  await writeFile(path.join(directory, 'README.md'), buildReadme(coursePackage, stats), 'utf8')
  await writeFile(path.join(directory, 'validation-report.json'), `${JSON.stringify({ valid: true, errors: [], stats, source_policy: coursePackage.source_policy }, null, 2)}\n`, 'utf8')

  for (const chapter of coursePackage.chapters) {
    const prefix = String(chapter.order_index).padStart(2, '0')
    await writeFile(path.join(directory, 'questions', `${prefix}.json`), `${JSON.stringify(chapter.questions, null, 2)}\n`, 'utf8')
    await writeFile(path.join(directory, 'reviews', `${prefix}.md`), `${chapter.review_content}\n`, 'utf8')
  }
  return { course: course.title, directory, stats, coursePackage }
}

await mkdir(outputRoot, { recursive: true })
const results = []
for (const course of [consultingCourse, assessmentCourse]) results.push(await writePackage(course))
await writeFile(path.join(outputRoot,'import-both.sql'),results.map(result=>buildSql(result.coursePackage)).join('\n\n'),'utf8')
await writeFile(path.join(outputRoot,'protected-content-only.sql'),`${['-- Run this after browser import to add the RLS-protected briefs and review notes.','begin;',...results.map(result=>buildProtectedContentSql(result.coursePackage)),'commit;'].join('\n\n')}\n`,'utf8')
await writeFile(path.join(outputRoot,'verify-both.sql'),results.map(result=>buildVerificationSql(result.coursePackage)).join('\n\n'),'utf8')
await writeFile(path.join(outputRoot,'IMPORT-GUIDE.md'),`# 两门课程导入说明\n\n后台课程包检查和题目导入完成后，只需在 Supabase SQL Editor 执行 \`protected-content-only.sql\`，补齐课程简介与28章复习资料。\n\n如果需要从空数据库完整重建两门课，执行 \`import-both.sql\`。两个脚本都使用固定 ID、事务和更新或插入逻辑，重复执行不会生成重复课程或题目。\n\n执行后运行 \`verify-both.sql\`，应得到：心理咨询过程与方法16章、288题、16章资料；心理测量与评估12章、270题、12章资料。\n`,'utf8')
console.log(JSON.stringify(results.map(({course,directory,stats})=>({course,directory,stats})),null,2))
