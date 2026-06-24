/**
 * Resolves the user's theme choice (dark/light/system) into a concrete theme,
 * tracks OS changes when set to "system", and applies the `dark` class plus the
 * window opacity to the document root. Smooth CSS transitions are defined in
 * index.css.
 */

import { useEffect } from 'react'
import { useSettingsStore } from '@store/settingsStore'
import { useWidgetStore } from '@store/widgetStore'

export function useTheme(): void {
  const theme = useSettingsStore((s) => s.settings.appearance.theme)
  const opacity = useSettingsStore((s) => s.settings.appearance.opacity)
  const scale = useSettingsStore((s) => s.settings.appearance.widgetScale)
  const setResolvedTheme = useWidgetStore((s) => s.setResolvedTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = (): void => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      const root = document.documentElement
      root.classList.toggle('dark', resolved === 'dark')
      root.style.setProperty('--app-opacity', String(opacity))
      root.style.setProperty('--app-scale', String(scale))
      setResolvedTheme(resolved)
    }

    apply()
    if (theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
  }, [theme, opacity, scale, setResolvedTheme])
}
