'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader } from 'lucide-react'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setStatus('error')
      setMessage('Токен верификации не найден')
      return
    }

    verifyEmail(token)
  }, [searchParams])

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('success')
        setMessage(data.message || 'Email успешно подтвержден')
      } else {
        setStatus('error')
        setMessage(data.detail || 'Ошибка при подтверждении email')
      }
    } catch (error) {
      setStatus('error')
      setMessage('Произошла ошибка при подтверждении email')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Подтверждение Email</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'loading' && (
            <div className="space-y-4">
              <Loader className="h-12 w-12 animate-spin mx-auto text-blue-600" />
              <p className="text-gray-600">Подтверждаем ваш email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
              <div>
                <h3 className="text-lg font-semibold text-green-600">Успешно!</h3>
                <p className="text-gray-600">{message}</p>
              </div>
              <div className="space-y-2">
                <Button 
                  onClick={() => router.push('/login')} 
                  className="w-full"
                >
                  Войти в аккаунт
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/')} 
                  className="w-full"
                >
                  На главную
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-red-600" />
              <div>
                <h3 className="text-lg font-semibold text-red-600">Ошибка</h3>
                <p className="text-gray-600">{message}</p>
              </div>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/login')} 
                  className="w-full"
                >
                  К странице входа
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/')} 
                  className="w-full"
                >
                  На главную
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}