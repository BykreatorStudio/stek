import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuthLogoSection } from '@/components/ui/AuthLogo'
import ResetPasswordForm from './ResetPasswordForm'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/forgot-password')
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(200,255,49,0.28) 0%, #ffffff 65%)',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px 32px' }}>
        <AuthLogoSection />
      </div>
      <div style={{
        background: '#ffffff',
        borderRadius: '28px 28px 0 0',
        padding: '28px 24px',
        paddingBottom: 'calc(28px + var(--safe-bottom))',
        boxShadow: '0 -1px 0 rgba(0,0,0,0.06)',
      }}>
        <ResetPasswordForm />
      </div>
    </div>
  )
}
