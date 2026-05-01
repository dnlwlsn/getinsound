'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { InsoundLogo } from '@/app/components/ui/InsoundLogo'
import { SocialAuthButtons, AuthDivider } from '@/app/components/ui/SocialAuthButtons'
import { createClient } from '@/lib/supabase/client'

export default function AuthClient({ defaultMode = 'signin' }: { defaultMode?: 'signin' | 'signup' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const modeParam = searchParams.get('mode')
  const initialMode = modeParam === 'signup' ? 'signup' : defaultMode
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [signupSent, setSignupSent] = useState(false)

  const intent = searchParams.get('intent')
  const nextParam = searchParams.get('next')
  const redirectTo = intent === 'artist'
    ? '/become-an-artist'
    : (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//'))
      ? nextParam
      : '/'

  useEffect(() => {
    if (searchParams.get('error') === 'auth') {
      setError('Something went wrong during sign-in. Please try again.')
    }
  }, [searchParams])

  function switchMode() {
    setMode(m => m === 'signin' ? 'signup' : 'signin')
    setError('')
    setResetSent(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setError('')
    setBusy(true)

    try {
      if (mode === 'signup') {
        if (!ageConfirmed) {
          setError('Please confirm you are at least 18 years old.')
          setBusy(false)
          return
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters.')
          setBusy(false)
          return
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          setBusy(false)
          return
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          },
        })

        if (signUpError) {
          if (signUpError.message?.includes('already registered')) {
            throw new Error('This email is already registered. Try signing in instead.')
          }
          throw signUpError
        }

        setBusy(false)
        setSignupSent(true)
        return
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        })
        if (error) throw error
        setBusy(false)
        router.push(redirectTo)
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  const isSignup = mode === 'signup'

  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)', backgroundSize: '48px 48px' }}>
      <nav className="sticky top-0 w-full z-50 flex justify-between items-center px-6 md:px-14 py-5 border-b border-zinc-900/80" style={{ background: 'rgba(9,9,11,0.88)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <Link href="/"><InsoundLogo size="lg" /></Link>
        <button
          onClick={switchMode}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
        >
          {isSignup ? 'Sign In' : 'Create Account'}
        </button>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,109,0,0.05),transparent_60%)]" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <InsoundLogo size="xl" />
            <p className="text-zinc-500 mt-2 font-medium text-sm">
              {isSignup ? 'Independent music, directly supported.' : 'Welcome back.'}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl" style={{ boxShadow: '0 0 60px rgba(245,109,0,0.08)' }}>
            {signupSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="currentColor" className="text-orange-600" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">Check your email</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a confirmation link to <span className="text-white font-semibold">{email.trim()}</span>. Click the link to activate your account.
                </p>
                <button
                  onClick={() => { setSignupSent(false); setMode('signin') }}
                  className="text-orange-600 hover:text-orange-400 text-sm font-bold mt-4"
                >
                  ← Back to sign in
                </button>
              </div>
            ) : resetSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-orange-600/15 border border-orange-600/40 flex items-center justify-center">
                  <svg width="24" height="24" fill="none" stroke="currentColor" className="text-orange-600" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h3 className="text-lg font-black text-white mb-2 font-display">Check your inbox</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We sent a password reset link to <span className="text-white font-semibold">{email.trim()}</span>.
                </p>
                <button
                  onClick={() => setResetSent(false)}
                  className="text-orange-600 hover:text-orange-400 text-sm font-bold mt-4"
                >
                  ← Back to sign in
                </button>
              </div>
            ) : (
              <>
                {isSignup && (
                  <>
                    <h2 className="font-display text-xl font-bold text-center mb-2">Join Insound</h2>
                    <p className="text-zinc-500 text-sm text-center mb-6">Create your free account.</p>
                  </>
                )}

                <SocialAuthButtons redirectTo={redirectTo} />
                <AuthDivider />

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Email Address</label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm placeholder-zinc-700 focus:border-orange-600"
                    />
                  </div>

                  <div className="relative">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                      required
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm pr-12 focus:border-orange-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-[38px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        {showPassword ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>

                  {isSignup && (
                    <>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Confirm Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          required
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3.5 px-4 outline-none transition-colors text-white text-sm focus:border-orange-600"
                        />
                      </div>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ageConfirmed}
                          onChange={e => setAgeConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-orange-600 cursor-pointer"
                        />
                        <span className="text-xs text-zinc-500 leading-snug">
                          I confirm I am at least 18 years old.
                          <br />
                          <span className="text-[11px] text-zinc-600">Required because we process payments through Stripe.</span>
                        </span>
                      </label>
                    </>
                  )}

                  {error && (
                    <div role="alert" className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={busy || (isSignup && (!ageConfirmed || !email.trim()))}
                    className="w-full bg-orange-600 text-black font-black py-4 rounded-xl hover:bg-orange-500 transition-colors text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busy
                      ? (isSignup ? 'Creating account...' : 'Signing in...')
                      : (isSignup ? 'Create Account' : 'Sign In')
                    }
                  </button>

                  {isSignup && !ageConfirmed && email.trim() && (
                    <p className="text-xs text-zinc-600 text-center">Please confirm your age above to continue.</p>
                  )}

                  {!isSignup && (
                    <button
                      type="button"
                      onClick={async () => {
                        const trimmed = email.trim()
                        if (!trimmed) { setError('Enter your email address first.'); return }
                        setError('')
                        setBusy(true)
                        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
                          redirectTo: `${window.location.origin}/auth/callback?next=/`,
                        })
                        setBusy(false)
                        if (error) { setError(error.message); return }
                        setResetSent(true)
                      }}
                      className="w-full text-center text-xs text-zinc-500 hover:text-orange-500 mt-3 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </form>
              </>
            )}

            <div className="mt-6 pt-5 border-t border-zinc-800 text-center">
              {isSignup ? (
                <>
                  <div className="flex justify-center gap-6 mb-4">
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                      Secure
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                      Private
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 font-bold">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                      Free
                    </span>
                  </div>
                  <p className="text-zinc-600 text-xs">
                    Already have an account? <button onClick={switchMode} className="text-orange-600 hover:text-orange-400 font-bold">Sign in</button>
                  </p>
                </>
              ) : (
                <p className="text-zinc-600 text-xs">
                  Don&apos;t have an account? <button onClick={switchMode} className="text-orange-600 hover:text-orange-400 font-bold">Sign up</button>
                </p>
              )}
            </div>
          </div>

          {isSignup && (
            <p className="text-zinc-500 text-xs text-center mt-6">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>,{' '}
              <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>, and{' '}
              <Link href="/ai-policy" className="hover:text-zinc-400 transition-colors">AI Policy</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
