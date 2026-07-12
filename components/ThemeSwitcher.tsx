'use client'

import { Check, Palette } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { applyTheme, THEME_STORAGE_KEY, type ThemeKey } from './ThemeProvider'

const themes: Array<{ key: ThemeKey; name: string; color: string }> = [
  { key: 'quiet-blue', name: '静谧蓝', color: '#315c87' },
  { key: 'sage', name: '鼠尾草绿', color: '#496b5c' },
  { key: 'graphite', name: '石墨红', color: '#a54b4b' },
  { key: 'clear-teal', name: '清透青', color: '#176b74' },
]

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<ThemeKey>(() =>
    typeof window === 'undefined'
      ? 'quiet-blue'
      : ((localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null) ?? 'quiet-blue')
  )
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function choose(theme: ThemeKey) {
    setCurrent(theme)
    applyTheme(theme)
    setOpen(false)
  }

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button className="icon-button" type="button" title="切换外观" aria-label="切换外观" onClick={() => setOpen((v) => !v)}>
        <Palette size={18} />
      </button>
      {open ? (
        <div className="theme-menu" role="menu">
          <div className="theme-menu__title">外观配色</div>
          {themes.map((theme) => (
            <button key={theme.key} className="theme-option" type="button" onClick={() => choose(theme.key)}>
              <span className="theme-swatch" style={{ background: theme.color }} />
              <span>{theme.name}</span>
              {current === theme.key ? <Check size={16} /> : <span className="theme-option__spacer" />}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
