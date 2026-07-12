import Link from 'next/link'
import { BookOpen, FileInput, Library, Settings, Users } from 'lucide-react'

export default function AdminSubnav() {
  return (
    <div className="admin-subnav" aria-label="管理导航">
      <Link href="/admin"><Library size={16} />课程与章节</Link>
      <Link href="/admin/content"><BookOpen size={16} />内容工作台</Link>
      <Link href="/admin/import"><FileInput size={16} />课程包导入</Link>
      <Link href="/admin/users"><Users size={16} />用户管理</Link>
      <Link href="/admin/settings"><Settings size={16} />平台设置</Link>
    </div>
  )
}
