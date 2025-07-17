export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false
  const token = localStorage.getItem('token')
  return !!(token && token !== 'undefined' && token !== 'null')
}

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export const getUser = (): any | null => {
  if (typeof window === 'undefined') return null
  const userData = localStorage.getItem('user')
  if (!userData || userData === 'undefined' || userData === 'null') return null
  try {
    return JSON.parse(userData)
  } catch (error) {
    console.error('Error parsing user data:', error)
    localStorage.removeItem('user')
    return null
  }
}

export const logout = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export const redirectToLogin = (): void => {
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
} 