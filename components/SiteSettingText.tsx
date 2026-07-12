'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabaseBrowser'

export default function SiteSettingText({ settingKey, fallback, className }: { settingKey: string; fallback: string; className?: string }) {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [text, setText] = useState(fallback)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('site_settings').select('value').eq('key', settingKey).maybeSingle()
      if (data?.value?.trim()) setText(data.value)
    })()
  }, [settingKey, supabase])
  return <p className={className}>{text}</p>
}
