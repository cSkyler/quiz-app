import { createBrowserClient } from '@supabase/ssr'

function getCookie(name: string) {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : undefined
}

function setCookie(name: string, value: string, options: any = {}) {
  if (typeof document === 'undefined') return
  const opts = {
    path: '/',
    sameSite: 'lax',
    ...options,
  }
  let cookie = `${name}=${encodeURIComponent(value)}`
  if (opts.maxAge !== undefined) cookie += `; Max-Age=${opts.maxAge}`
  if (opts.expires) cookie += `; Expires=${(opts.expires as Date).toUTCString()}`
  if (opts.path) cookie += `; Path=${opts.path}`
  if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`
  if (opts.secure) cookie += `; Secure`
  document.cookie = cookie
}

function removeCookie(name: string, options: any = {}) {
  setCookie(name, '', { ...options, maxAge: 0 })
}

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: getCookie,
        set: setCookie,
        remove: removeCookie,
      },
    }
  )
}
