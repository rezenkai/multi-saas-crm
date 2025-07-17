'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Загружаем сохраненную тему из localStorage
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    const updateTheme = () => {
      let resolvedTheme: 'light' | 'dark'

      if (theme === 'system') {
        resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      } else {
        resolvedTheme = theme
      }

      setEffectiveTheme(resolvedTheme)

      // Обновляем HTML класс
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(resolvedTheme)

      // Обновляем CSS переменные
      if (resolvedTheme === 'dark') {
        root.style.setProperty('--background', '222.2% 84% 4.9%')
        root.style.setProperty('--foreground', '210% 40% 98%')
        root.style.setProperty('--card', '222.2% 84% 4.9%')
        root.style.setProperty('--card-foreground', '210% 40% 98%')
        root.style.setProperty('--popover', '222.2% 84% 4.9%')
        root.style.setProperty('--popover-foreground', '210% 40% 98%')
        root.style.setProperty('--primary', '210% 40% 98%')
        root.style.setProperty('--primary-foreground', '222.2% 84% 4.9%')
        root.style.setProperty('--secondary', '217.2% 32.6% 17.5%')
        root.style.setProperty('--secondary-foreground', '210% 40% 98%')
        root.style.setProperty('--muted', '217.2% 32.6% 17.5%')
        root.style.setProperty('--muted-foreground', '215% 20.2% 65.1%')
        root.style.setProperty('--accent', '217.2% 32.6% 17.5%')
        root.style.setProperty('--accent-foreground', '210% 40% 98%')
        root.style.setProperty('--destructive', '0 62.8% 30.6%')
        root.style.setProperty('--destructive-foreground', '210% 40% 98%')
        root.style.setProperty('--border', '217.2% 32.6% 17.5%')
        root.style.setProperty('--input', '217.2% 32.6% 17.5%')
        root.style.setProperty('--ring', '212.7% 26.8% 83.9%')
      } else {
        root.style.setProperty('--background', '0 0% 100%')
        root.style.setProperty('--foreground', '222.2% 84% 4.9%')
        root.style.setProperty('--card', '0 0% 100%')
        root.style.setProperty('--card-foreground', '222.2% 84% 4.9%')
        root.style.setProperty('--popover', '0 0% 100%')
        root.style.setProperty('--popover-foreground', '222.2% 84% 4.9%')
        root.style.setProperty('--primary', '222.2% 47.4% 11.2%')
        root.style.setProperty('--primary-foreground', '210% 40% 98%')
        root.style.setProperty('--secondary', '210% 40% 96%')
        root.style.setProperty('--secondary-foreground', '222.2% 84% 4.9%')
        root.style.setProperty('--muted', '210% 40% 96%')
        root.style.setProperty('--muted-foreground', '215.4% 16.3% 46.9%')
        root.style.setProperty('--accent', '210% 40% 96%')
        root.style.setProperty('--accent-foreground', '222.2% 84% 4.9%')
        root.style.setProperty('--destructive', '0 84.2% 60.2%')
        root.style.setProperty('--destructive-foreground', '210% 40% 98%')
        root.style.setProperty('--border', '214.3% 31.8% 91.4%')
        root.style.setProperty('--input', '214.3% 31.8% 91.4%')
        root.style.setProperty('--ring', '222.2% 84% 4.9%')
      }
    }

    updateTheme()

    // Слушаем изменения системной темы
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => updateTheme()
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}