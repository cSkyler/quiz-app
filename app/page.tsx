'use client'

import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [msg, setMsg] = useState('checking...')

  useEffect(() => {
    async function run() {
      const { data, error } = await supabase.from('chapters').select('*').limit(1)
      if (error) setMsg(`ERROR: ${error.message}`)
      else setMsg(`OK: connected. sample=${JSON.stringify(data)}`)
    }
    run()
  }, [])

  return (
    <main style={{ padding: 24 }}>
      <h1>Supabase Connection Test</h1>
      <pre>{msg}</pre>
    </main>
  )
}
