'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
  useTheme as useNextTheme,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export function useTheme() {
  const { theme, resolvedTheme, setTheme, systemTheme } = useNextTheme()
  return {
    theme: (theme || 'light') as 'light' | 'dark' | 'system',
    resolvedTheme: (resolvedTheme || 'light') as 'light' | 'dark',
    setTheme,
    systemTheme,
  }
}
