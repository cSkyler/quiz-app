'use client'

import { createClient } from '@supabase/supabase-js'
import { useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  async function signUp() {
    setMsg('Signing up...')
    const { error } = await supabase.auth.signUp({ email, password })
    setMsg(error ? `ERROR: ${error.message}` : 'OK: signUp success. You can try sign in now.')
  }

  async function signIn() {
    setMsg('Signing in...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMsg(error ? `ERROR: ${error.message}` : 'OK: signIn success.')
  }

  async function signOut() {
    await supabase.auth.signOut()
    setMsg('Signed out.')
  }

  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>

      <div style={{ display: 'grid', gap: 8 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10 }}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10 }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={signUp} style={{ padding: 10 }}>Sign Up</button>
          <button onClick={signIn} style={{ padding: 10 }}>Sign In</button>
          <button onClick={signOut} style={{ padding: 10 }}>Sign Out</button>
        </div>

        <pre style={{ whiteSpace: 'pre-wrap' }}>{msg}</pre>
      </div>
    </main>
  )
}
