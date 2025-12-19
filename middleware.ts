import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // 只保护刷题相关路由：/courses（含 chapters、practice 等）
  const pathname = request.nextUrl.pathname

  // 仅放行：首页 + 登录/注册/重置（游客只能停留在首页）
  const publicPaths = ['/', '/login', '/signup', '/reset-password']

  // 公开前缀（如你有公开接口/健康检查等；没有也可留空）
  const publicPrefixes: string[] = []
  const publicFiles = ['/manifest.json', '/manifest.webmanifest']

  const isPublicFile = publicFiles.includes(pathname)


    const isPublic =
    publicPaths.includes(pathname) ||
    isPublicFile ||
    publicPrefixes.some((p) => pathname.startsWith(p))


  if (isPublic) return NextResponse.next()


  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
        response = NextResponse.redirect(url)
    return response

  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
}
