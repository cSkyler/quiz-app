import { Suspense } from 'react'
import LoginClient from './LoginClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="ui-container"><div className="ui-status">Loading...</div></div>}>
      <LoginClient />
    </Suspense>
  )
}
