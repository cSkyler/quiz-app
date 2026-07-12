'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, Check, Palette, Sparkles } from 'lucide-react'
import { applyTheme, type ThemeKey } from '@/components/ThemeProvider'

const steps = [
  { icon: Sparkles, eyebrow: '欢迎使用 MAPer', title: '让每次学习都有明确的下一步', text: 'MAPer 会把课程资料、章节练习、错题和进度放在同一条学习路径中。', points: ['从学习首页继续上次进度','临近考试时突出冲刺任务','所有学习记录自动同步'] },
  { icon: BookOpen, eyebrow: '课程与资料', title: '先理解，再通过练习巩固', text: '进入课程后，可以按章节阅读复习资料，并直接开始对应练习。', points: ['课程概览集中展示考试信息','资料与题目按章节对应','随时回到上次学习位置'] },
]

const themes: Array<{ key: ThemeKey; name: string; color: string }> = [
  { key: 'quiet-blue', name: '静谧蓝', color: '#315c87' },
  { key: 'sage', name: '鼠尾草绿', color: '#496b5c' },
  { key: 'graphite', name: '石墨红', color: '#a54b4b' },
  { key: 'clear-teal', name: '清透青', color: '#176b74' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [theme, setTheme] = useState<ThemeKey>('quiet-blue')
  const router = useRouter()
  const isThemeStep = step === steps.length
  const current = steps[Math.min(step, steps.length - 1)]
  const Icon = isThemeStep ? Palette : current.icon

  function finish() {
    localStorage.setItem('maper-onboarding-complete', '1')
    applyTheme(theme)
    router.replace('/dashboard')
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-header"><div className="landing-brand"><span><BookOpen size={19} /></span><strong>MAPer</strong></div><button type="button" onClick={finish}>跳过教程</button></div>
      <div className="onboarding-card">
        <div className="onboarding-visual"><div className="onboarding-visual__icon"><Icon size={38} /></div><div className="onboarding-visual__rings" /><small>{step + 1} / {steps.length + 1}</small></div>
        <div className="onboarding-content">
          <span className="onboarding-eyebrow">{isThemeStep ? '选择外观' : current.eyebrow}</span>
          <h1>{isThemeStep ? '选择一套适合长期阅读的配色' : current.title}</h1>
          <p>{isThemeStep ? '外观只改变颜色，不会改变页面结构。以后可以随时在顶部工具栏切换。' : current.text}</p>
          {isThemeStep ? <div className="onboarding-themes">{themes.map((item) => <button key={item.key} className={theme === item.key ? 'is-selected' : ''} onClick={() => { setTheme(item.key); applyTheme(item.key) }}><i style={{ background: item.color }} />{item.name}{theme === item.key ? <Check size={16} /> : null}</button>)}</div> : <ul>{current.points.map((point) => <li key={point}><Check size={16} />{point}</li>)}</ul>}
          <div className="onboarding-actions"><button className="button button--secondary" type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft size={17} />上一步</button><button className="button button--primary" type="button" onClick={() => isThemeStep ? finish() : setStep((s) => s + 1)}>{isThemeStep ? '进入学习平台' : '下一步'}<ArrowRight size={17} /></button></div>
        </div>
      </div>
      <div className="onboarding-progress">{Array.from({ length: steps.length + 1 }).map((_, index) => <span key={index} className={index <= step ? 'is-active' : ''} />)}</div>
    </main>
  )
}
