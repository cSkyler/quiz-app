'use client'

import CoursePackageImporter from '@/components/CoursePackageImporter'

export default function AdminCourseImportPage(){
  return <main className="workspace-page admin-workspace"><div className="workspace-heading"><div><span className="page-eyebrow">安全导入</span><h1>课程包导入</h1><p>一次检查并导入课程资料、章节、复习内容和题库。</p></div></div><CoursePackageImporter/></main>
}
