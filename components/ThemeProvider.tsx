'use client'

import { useEffect, type ReactNode } from 'react'

export type ThemeKey = 'quiet-blue' | 'sage' | 'graphite' | 'clear-teal'

export const THEME_STORAGE_KEY = 'maper-theme'

export function applyTheme(theme: ThemeKey) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null
    document.documentElement.dataset.theme = saved ?? 'quiet-blue'
  }, [])

  return children
}
