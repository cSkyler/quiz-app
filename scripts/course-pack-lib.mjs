import { createHash } from 'node:crypto'

const OPTION_KEYS = ['A', 'B', 'C', 'D']

export function concept(term, definition, application, misconception, clientExplanation = '') {
  return { term, definition, application, misconception, clientExplanation: clientExplanation || definition }
}

export function stableUuid(scope, name) {
  const hex = createHash('sha256').update(`${scope}:${name}`, 'utf8').digest('hex').slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const raw = hex.join('')
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

function rotate(items, offset) {
  return items.map((_, index) => items[(index + offset) % items.length])
}

function withoutTerminalPunctuation(text) {
  return text.trim().replace(/[。！？!?]+$/u, '')
}

function optionsFromTerms(concepts, correctIndex, offset = 1) {
  const correct = concepts[correctIndex]
  const distractors = rotate(concepts.filter((_, index) => index !== correctIndex), offset).slice(0, 3)
  const correctPosition = correctIndex % 4
  const choices = [...distractors]
  choices.splice(correctPosition, 0, correct)
  return {
    options: choices.map((item, index) => ({ key: OPTION_KEYS[index], text: item.term })),
    correct: OPTION_KEYS[correctPosition],
  }
}

function questionId(courseSlug, chapterIndex, sequence) {
  return stableUuid(courseSlug, `chapter-${chapterIndex + 1}-question-${sequence + 1}`)
}

function makeSingle(courseSlug, chapterIndex, sequence, stem, concepts, correctIndex, explanation, offset = 1) {
  const choice = optionsFromTerms(concepts, correctIndex, offset)
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'single',
    stem,
    options: choice.options,
    answer: { correct: choice.correct },
    explanation,
  }
}

function makeMulti(courseSlug, chapterIndex, sequence, concepts, pairStart) {
  const first = concepts[pairStart % concepts.length]
  const second = concepts[(pairStart + 1) % concepts.length]
  const third = concepts[(pairStart + 2) % concepts.length]
  const fourth = concepts[(pairStart + 3) % concepts.length]
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'multi',
    stem: '关于本章核心概念，下列哪些表述正确？（多选）',
    options: [
      { key: 'A', text: `${first.term}：${first.definition}` },
      { key: 'B', text: `${second.term}：${second.definition}` },
      { key: 'C', text: `${third.term}：${third.misconception}` },
      { key: 'D', text: `${fourth.term}：${fourth.misconception}` },
    ],
    answer: { correct: ['A', 'B'] },
    explanation: `A、B分别准确描述了“${first.term}”和“${second.term}”。C、D是常见误区，不能作为规范理解或操作依据。`,
  }
}

function makeBlank(courseSlug, chapterIndex, sequence, item) {
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'blank',
    stem: `请填写概念：____是指${item.definition}`,
    options: null,
    answer: { correct: [item.term] },
    explanation: `答案是“${item.term}”。`,
  }
}

function makePitfallSingle(courseSlug, chapterIndex, sequence, item, correctPosition) {
  const safeChoices = [
    item.application,
    `依据概念进行判断：${item.definition}`,
    `向来访者说明：${item.clientExplanation}`,
  ]
  const choices = [...safeChoices]
  choices.splice(correctPosition, 0, item.misconception)
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'single',
    stem: `围绕“${item.term}”开展评估时，下列哪一种做法最需要避免？`,
    options: choices.map((text, index) => ({ key: OPTION_KEYS[index], text })),
    answer: { correct: OPTION_KEYS[correctPosition] },
    explanation: `应避免：${item.misconception}。规范依据是：${item.definition}`,
  }
}

function makeShort(courseSlug, chapterIndex, sequence, chapter, firstIndex, secondIndex) {
  const first = chapter.concepts[firstIndex]
  const second = chapter.concepts[secondIndex]
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'short',
    stem: `简答题：说明“${first.term}”与“${second.term}”各自的含义，并指出在${chapter.title.replace(/^第.+?章\s*/, '')}中的应用要点。`,
    options: null,
    answer: {
      reference: `参考要点：\n1）${first.term}：${first.definition}\n2）${second.term}：${second.definition}\n3）应用：${first.application}\n4）应用：${second.application}\n5）作答时应避免把两者混为一谈，并结合阶段目标说明使用时机。`,
    },
    explanation: null,
  }
}

function makeCase(courseSlug, chapterIndex, sequence, chapter) {
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'case',
    stem: `案例题：${chapter.casePrompt}`,
    options: null,
    answer: { reference: chapter.caseReference },
    explanation: null,
  }
}

function makeConsultingMulti(courseSlug, chapterIndex, sequence, concepts, pairStart) {
  const first = concepts[pairStart % concepts.length]
  const second = concepts[(pairStart + 1) % concepts.length]
  const third = concepts[(pairStart + 2) % concepts.length]
  const fourth = concepts[(pairStart + 3) % concepts.length]
  const stems = [
    '从技术操作是否规范的角度看，下列哪些做法恰当？（多选）',
    '从合作性和来访者体验的角度看，下列哪些做法恰当？（多选）',
    '从技术时机、边界与效果检验的角度看，下列哪些做法恰当？（多选）',
  ]
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'multi',
    stem: stems[Math.floor(pairStart / 2) % stems.length],
    options: [
      { key: 'A', text: first.application },
      { key: 'B', text: second.clientExplanation },
      { key: 'C', text: third.misconception },
      { key: 'D', text: fourth.misconception },
    ],
    answer: { correct: ['A', 'B'] },
    explanation: `A体现“${first.term}”的规范应用，B体现向来访者说明“${second.term}”时的合作性表达；C、D分别是“${third.term}”和“${fourth.term}”的常见误用。`,
  }
}

function makeWorkflowBlank(courseSlug, chapterIndex, sequence, chapter, blankIndex) {
  const steps = chapter.workflow.split('→').map((step) => withoutTerminalPunctuation(step)).filter(Boolean)
  const targetIndex = Math.min(steps.length - 1, 1 + blankIndex * 2)
  const answer = steps[targetIndex]
  const displayed = steps.map((step, index) => index === targetIndex ? '____' : step).join(' → ')
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'blank',
    stem: `请依据本章学习主线补全工作流程：${displayed}。`,
    options: null,
    answer: { correct: [answer] },
    explanation: `本章流程中该环节是“${answer}”。流程题考查的是技术使用顺序与阶段任务，不是概念定义的重复记忆。`,
  }
}

function makeSystemShort(courseSlug, chapterIndex, sequence, chapter) {
  const terms = chapter.concepts.map((item) => item.term)
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'short',
    stem: `简答题：${chapter.title.replace(/^第.+?章\s*/, '')}包含哪些主要技术或核心要点？请列举并说明这些内容如何共同服务本章目标。`,
    options: null,
    answer: {
      reference: `参考要点：\n1）主要技术或核心要点包括：${terms.join('、')}。\n2）本章目标：${chapter.summary}\n3）作答不能只罗列名称，还应依据“${chapter.workflow}”说明各项技术在工作流程中的位置、目的与衔接关系。`,
    },
    explanation: null,
  }
}

function makeClientExplanationShort(courseSlug, chapterIndex, sequence, chapter, firstIndex, secondIndex) {
  const first = chapter.concepts[firstIndex]
  const second = chapter.concepts[secondIndex]
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'short',
    stem: `简答题：如果来访者询问“为什么要使用${first.term}和${second.term}”，咨询师应如何用易懂、合作且不过度承诺的方式说明？`,
    options: null,
    answer: {
      reference: `参考要点：\n1）${first.term}：${first.clientExplanation}\n2）${second.term}：${second.clientExplanation}\n3）说明技术目的和选择理由，并邀请来访者表达是否符合其需要。\n4）避免专业权威式断言，也不承诺技术一定产生某种结果。`,
    },
    explanation: null,
  }
}

function makeCorrectionCase(courseSlug, chapterIndex, sequence, chapter, conceptIndex) {
  const item = chapter.concepts[conceptIndex]
  return {
    id: questionId(courseSlug, chapterIndex, sequence),
    type: 'case',
    stem: `案例题：咨询师在使用“${item.term}”时采用了以下做法：“${withoutTerminalPunctuation(item.misconception)}。”请指出问题，改写为更规范的处理，并说明如何检查来访者的反应。`,
    options: null,
    answer: {
      reference: `参考要点：该做法把“${item.term}”使用成了常见误区。规范依据是：${withoutTerminalPunctuation(item.definition)}。可改为：${withoutTerminalPunctuation(item.application)}；向来访者说明时可表达为：“${withoutTerminalPunctuation(item.clientExplanation)}。”随后应邀请来访者反馈贴合度、情绪反应和是否愿意继续，并根据反馈调整。`,
    },
    explanation: null,
  }
}

function makeConsultingQuestions(courseSlug, chapter, chapterIndex) {
  const questions = []
  for (let conceptIndex = 0; conceptIndex < 2; conceptIndex += 1) {
    const item = chapter.concepts[conceptIndex]
    questions.push(makeSingle(
      courseSlug,
      chapterIndex,
      questions.length,
      `下列哪一概念最符合这一描述：“${item.definition}”？`,
      chapter.concepts,
      conceptIndex,
      `该描述对应“${item.term}”。应用提示：${item.application}`,
      conceptIndex + 1,
    ))
  }
  for (let conceptIndex = 2; conceptIndex < 5; conceptIndex += 1) {
    const item = chapter.concepts[conceptIndex]
    questions.push(makeSingle(
      courseSlug,
      chapterIndex,
      questions.length,
      `会谈情境：${withoutTerminalPunctuation(item.application)}。这一处理最能体现下列哪一项技术或原则？`,
      chapter.concepts,
      conceptIndex,
      `该情境体现“${item.term}”。判断依据是其操作目的与使用方式，而不是只记忆定义。`,
      conceptIndex + 2,
    ))
  }
  const explanationItem = chapter.concepts[5]
  questions.push(makeSingle(
    courseSlug,
    chapterIndex,
    questions.length,
    `咨询师向来访者说明：“${explanationItem.clientExplanation}”这段说明主要对应哪一项技术或原则？`,
    chapter.concepts,
    5,
    `这段面向来访者的说明对应“${explanationItem.term}”，重点是能否以合作、易懂的方式解释技术意图。`,
    1,
  ))
  questions.push(makePitfallSingle(courseSlug, chapterIndex, questions.length, chapter.concepts[6], chapterIndex % 4))
  for (let i = 0; i < 3; i += 1) questions.push(makeConsultingMulti(courseSlug, chapterIndex, questions.length, chapter.concepts, i * 2))
  for (let i = 0; i < 3; i += 1) questions.push(makeWorkflowBlank(courseSlug, chapterIndex, questions.length, chapter, i))
  questions.push(makeSystemShort(courseSlug, chapterIndex, questions.length, chapter))
  questions.push(makeShort(courseSlug, chapterIndex, questions.length, chapter, 0, 3))
  questions.push(makeClientExplanationShort(courseSlug, chapterIndex, questions.length, chapter, 4, 5))
  questions.push(makeCase(courseSlug, chapterIndex, questions.length, chapter))
  questions.push(makeCorrectionCase(courseSlug, chapterIndex, questions.length, chapter, 6))
  return questions
}

function makeAssessmentQuestions(courseSlug, chapter, chapterIndex) {
  const questions = []
  chapter.concepts.forEach((item, conceptIndex) => {
    questions.push(makeSingle(
      courseSlug,
      chapterIndex,
      questions.length,
      `下列哪一概念最符合这一描述：“${item.definition}”？`,
      chapter.concepts,
      conceptIndex,
      `正确概念是“${item.term}”。${item.application}`,
      conceptIndex + 1,
    ))
  })
  for (let i = 0; i < 6; i += 1) {
    const item = chapter.concepts[i]
    questions.push(makeSingle(
      courseSlug,
      chapterIndex,
      questions.length,
      `应用情境：${withoutTerminalPunctuation(item.application)}。此时最需要优先依据哪一概念？`,
      chapter.concepts,
      i,
      `该情境考查“${item.term}”：${item.definition}`,
      i + 2,
    ))
  }
  for (let i = 0; i < 3; i += 1) questions.push(makeMulti(courseSlug, chapterIndex, questions.length, chapter.concepts, i * 2))
  questions.push(makeBlank(courseSlug, chapterIndex, questions.length, chapter.concepts[0]))
  questions.push(makeShort(courseSlug, chapterIndex, questions.length, chapter, 0, 1))
  questions.push(makeCase(courseSlug, chapterIndex, questions.length, chapter))

  if (chapter.priority === 'core') {
    for (let i = 0; i < 6; i += 1) {
      const item = chapter.concepts[i]
      questions.push(makePitfallSingle(courseSlug, chapterIndex, questions.length, item, i % 4))
    }
  }
  return questions
}

function makeReview(chapter) {
  const intro = [
    `# 【${chapter.title}】`,
    '## 🎯 本章目标',
    chapter.summary,
    '## 🧭 学习主线',
    chapter.workflow,
  ].join('\n')
  const conceptPages = chapter.concepts.map((item) => [
    `# 【${item.term}】`,
    '## 🧠 考试定义',
    item.definition,
    '## 💬 如何向来访者解释',
    item.clientExplanation,
    '## 🧩 应用情境',
    item.application,
    '## ⚠️ 易错点',
    item.misconception,
  ].join('\n'))
  const finalPage = [
    '# 【本章整合】',
    '## ✅ 作答检查',
    '先判断当前阶段和任务，再选择概念或技术；说明使用理由、边界与下一步；涉及风险时优先安全、伦理和转介。',
    '## 🧪 综合案例',
    chapter.casePrompt,
    '## 📌 参考思路',
    chapter.caseReference,
  ].join('\n')
  return [intro, ...conceptPages, finalPage].join('\n---PAGE---\n')
}

export function buildCoursePackage(course) {
  const courseId = stableUuid(course.slug, 'course')
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    source_policy: course.sourcePolicy,
    course: { id: courseId, title: course.title, description: course.description, order_index: course.orderIndex },
    brief: course.brief,
    chapters: course.chapters.map((chapter, chapterIndex) => {
      const id = stableUuid(course.slug, `chapter-${chapterIndex + 1}`)
      const questions = course.mode === 'consulting'
        ? makeConsultingQuestions(course.slug, chapter, chapterIndex)
        : makeAssessmentQuestions(course.slug, chapter, chapterIndex)
      return {
        id,
        course_id: courseId,
        title: chapter.title,
        order_index: chapterIndex + 1,
        provided_by: course.teacher,
        priority: chapter.priority ?? 'normal',
        review_content: makeReview(chapter),
        questions: questions.map((question) => ({ ...question, chapter_id: id })),
      }
    }),
  }
}

function validateQuestion(question, context, errors) {
  if (!question.id || !question.type || !question.stem?.trim()) errors.push(`${context}: 缺少 id/type/stem`)
  if (!['tf', 'single', 'multi', 'blank', 'short', 'case', 'order'].includes(question.type)) errors.push(`${context}: 不支持的题型`)
  if (question.type === 'single' || question.type === 'multi') {
    if (!Array.isArray(question.options) || question.options.length !== 4) errors.push(`${context}: 选择题必须有4个选项`)
    const keys = question.options?.map((option) => option.key)
    if (JSON.stringify(keys) !== JSON.stringify(OPTION_KEYS)) errors.push(`${context}: 选项键必须是A-D`)
    if (new Set(question.options?.map((option) => option.text.trim())).size !== 4) errors.push(`${context}: 选项文本重复`)
  }
  if (question.type === 'single' && !OPTION_KEYS.includes(question.answer?.correct)) errors.push(`${context}: 单选答案无效`)
  if (question.type === 'multi') {
    const answer = question.answer?.correct
    if (!Array.isArray(answer) || answer.length < 2 || !answer.every((key) => OPTION_KEYS.includes(key))) errors.push(`${context}: 多选答案无效`)
  }
  if (question.type === 'blank' && (!Array.isArray(question.answer?.correct) || question.answer.correct.length === 0)) errors.push(`${context}: 填空答案无效`)
  if ((question.type === 'short' || question.type === 'case') && !question.answer?.reference?.trim()) errors.push(`${context}: 主观题缺少参考答案`)
  if ((question.type === 'single' || question.type === 'multi' || question.type === 'blank') && !question.explanation?.trim()) errors.push(`${context}: 客观题缺少解析`)
}

export function validateCoursePackage(coursePackage) {
  const errors = []
  const ids = new Set()
  const stems = new Set()
  if (coursePackage.version !== 1) errors.push('课程包 version 必须为1')
  if (!coursePackage.course?.id || !coursePackage.course?.title) errors.push('缺少课程信息')
  if (coursePackage.brief?.exam_date !== '2026-07-19') errors.push('考试日期必须为2026-07-19')
  if (!Array.isArray(coursePackage.chapters) || coursePackage.chapters.length === 0) errors.push('缺少章节')
  coursePackage.chapters.forEach((chapter, chapterIndex) => {
    if (!chapter.review_content?.trim()) errors.push(`第${chapterIndex + 1}章缺少复习资料`)
    if (chapter.order_index !== chapterIndex + 1) errors.push(`第${chapterIndex + 1}章排序错误`)
    if (!Array.isArray(chapter.questions) || chapter.questions.length === 0) errors.push(`第${chapterIndex + 1}章缺少题目`)
    chapter.questions.forEach((question, questionIndex) => {
      const context = `第${chapterIndex + 1}章第${questionIndex + 1}题`
      validateQuestion(question, context, errors)
      if (ids.has(question.id)) errors.push(`${context}: 题目ID重复`)
      ids.add(question.id)
      const duplicateSignature = JSON.stringify({
        stem: question.stem.replace(/\s+/g, ''),
        options: question.options?.map((option) => option.text.replace(/\s+/g, '')) ?? null,
      })
      if (stems.has(duplicateSignature)) errors.push(`${context}: 题干与选项组合重复`)
      stems.add(duplicateSignature)
    })
  })
  return errors
}

export function packageStats(coursePackage) {
  const stats = { chapters: coursePackage.chapters.length, questions: 0, types: {}, coreQuestions: 0 }
  for (const chapter of coursePackage.chapters) {
    stats.questions += chapter.questions.length
    if (chapter.priority === 'core') stats.coreQuestions += chapter.questions.length
    for (const question of chapter.questions) stats.types[question.type] = (stats.types[question.type] ?? 0) + 1
  }
  return stats
}
