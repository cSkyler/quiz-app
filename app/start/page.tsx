'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StartPage() {
  const router = useRouter()
  useEffect(() => {
    const completed = localStorage.getItem('maper-onboarding-complete') === '1'
    router.replace(completed ? '/dashboard' : '/onboarding')
  }, [router])
  return <main className="route-loader"><span className="loader" /><p>正在准备你的学习空间…</p></main>
}
