import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import SiteSettingText from '@/components/SiteSettingText'

const features = [
  { icon: BookOpen, title: '结构化复习资料', text: '按课程与章节整理重点，在阅读后自然进入对应练习。' },
  { icon: ClipboardCheck, title: '完整题型练习', text: '覆盖客观题、主观题、案例题与排序题，提交后立即复盘。' },
  { icon: RotateCcw, title: '错题持续复习', text: '保留错误轨迹，以待复习、复习中、已掌握管理薄弱题目。' },
  { icon: BarChart3, title: '真实学习进度', text: '查看课程完成度、章节正确率和掌握状态，不只统计刷题数量。' },
]

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link href="/" className="landing-brand"><span><BookOpen size={20} /></span><strong>MAPer</strong><small>学习平台</small></Link>
        <nav aria-label="官网导航"><a href="#features">功能</a><a href="#courses">课程</a><a href="#workflow">使用流程</a></nav>
        <div className="landing-nav__actions"><Link className="button button--ghost" href="/login">登录</Link><Link className="button button--primary" href="/signup">免费注册 <ArrowRight size={16} /></Link></div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <div className="eyebrow"><Sparkles size={15} /> 为心理学课程复习而设计</div>
          <h1>MAPer 学习平台</h1>
          <SiteSettingText settingKey="landing_intro" fallback="把课程资料、章节练习、错题复盘与学习进度放在同一个清晰的工作台里。平时持续积累，考前集中冲刺。" />
          <div className="landing-hero__actions"><Link className="button button--primary button--large" href="/signup">创建学习账户 <ArrowRight size={18} /></Link><Link className="button button--secondary button--large" href="/login">已有账户，登录</Link></div>
          <div className="landing-trust"><span><CheckCircle2 size={16} /> 开放注册</span><span><CheckCircle2 size={16} /> 多设备同步</span><span><CheckCircle2 size={16} /> 免费使用</span></div>
        </div>

        <div className="product-scene" aria-label="MAPer 学习工作台预览">
          <div className="product-scene__sidebar">
            <div className="product-scene__logo"><BookOpen size={15} /> MAPer</div>
            <span className="is-active"><Layers3 size={14} /> 学习首页</span>
            <span><BookOpen size={14} /> 我的课程</span>
            <span><ClipboardCheck size={14} /> 复习资料</span>
            <span><RotateCcw size={14} /> 错题本</span>
            <span><BarChart3 size={14} /> 学习进度</span>
            <div className="product-scene__countdown"><small>考试倒计时</small><strong>8 天</strong><small>2026年7月19日</small></div>
          </div>
          <div className="product-scene__main">
            <div className="product-scene__top"><span>长期学习 · 考前冲刺</span><span className="preview-avatar">M</span></div>
            <div className="product-scene__welcome"><div><small>上午好，学习从清晰的下一步开始</small><strong>继续你的复习计划</strong></div><button>继续学习</button></div>
            <div className="product-scene__stats"><div><small>今日答题</small><strong>24</strong></div><div><small>最近正确率</small><strong>82%</strong></div><div><small>待复习错题</small><strong>13</strong></div></div>
            <div className="preview-course"><span className="preview-course__icon"><BrainCircuit size={18} /></span><div><strong>心理测量与评估</strong><small>6 / 10 章节 · 正确率 78%</small><i><b style={{ width: '62%' }} /></i></div><button>继续</button></div>
            <div className="preview-course"><span className="preview-course__icon is-green"><BookOpen size={18} /></span><div><strong>心理咨询过程与方法</strong><small>3 / 8 章节 · 正确率 71%</small><i><b style={{ width: '38%' }} /></i></div><button>开始</button></div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="features"><div className="section-heading"><span>核心功能</span><h2>把复习过程连成一条完整路径</h2><p>每个页面都明确告诉你当前状态，以及最值得做的下一步。</p></div><div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={20} /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section className="landing-band" id="courses"><div><span className="section-kicker">当前备考课程</span><h2>围绕 2026年7月19日，有节奏地完成复习</h2><p>课程介绍、考试结构、学习建议和作业内容会持续完善，题目与资料按章节统一组织。</p></div><div className="landing-course-list"><article><span>01</span><div><h3>心理测量与评估</h3><p>测量理论、信效度、常用测验及评估应用</p></div><BrainCircuit size={22} /></article><article><span>02</span><div><h3>心理咨询过程与方法</h3><p>咨询阶段、关系建立、核心技术与案例应用</p></div><BookOpen size={22} /></article></div></section>

      <section className="landing-section workflow-section" id="workflow"><div className="section-heading"><span>使用流程</span><h2>从课程内容到真正掌握</h2></div><div className="workflow-line">{['选择课程','阅读资料','章节练习','查看解析','复习错题','检查进度'].map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong>{index < 5 ? <ArrowRight size={17} /> : null}</div>)}</div></section>

      <section className="landing-cta"><div><h2>开始建立你的复习节奏</h2><p>注册后保存学习进度、错题和掌握度，并在不同设备继续学习。</p></div><Link className="button button--primary button--large" href="/signup">免费注册 <ArrowRight size={18} /></Link></section>
      <footer className="landing-footer"><div className="landing-brand"><span><BookOpen size={18} /></span><strong>MAPer</strong></div><SiteSettingText settingKey="disclaimer" fallback="学习辅助工具。题目与解析如与课堂标准答案冲突，请以课堂内容为准。" /><span>持续迭代中</span></footer>
    </main>
  )
}
