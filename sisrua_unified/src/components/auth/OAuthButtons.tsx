import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

/**
 * OAuthButtons.tsx — Botões de login social (Google, Microsoft, GitHub).
 * Integrado com AuthProvider para fluxos OAuth via Supabase.
 */
export interface OAuthButtonsProps {
  /** Orientação dos botões: "horizontal" (padrão) ou "vertical" */
  direction?: 'horizontal' | 'vertical';
  /** Se deve mostrar rótulo de texto ao lado do ícone */
  showLabel?: boolean;
  /** Se deve mostrar divisor "OU" acima dos botões */
  showDivider?: boolean;
  /** Classe CSS customizada */
  className?: string;
}

export function OAuthButtons({
  direction = 'horizontal',
  showLabel = false,
  showDivider = false,
  className = '',
}: OAuthButtonsProps) {
  const { signInWithGoogle, signInWithMicrosoft, loading: authLoading } = useAuth();
  const [localLoading, setLocalLoading] = React.useState<'google' | 'microsoft' | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLocalLoading('google');
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign-in error:', err);
      setLocalLoading(null);
    }
  };

  const handleMicrosoftSignIn = async () => {
    try {
      setLocalLoading('microsoft');
      await signInWithMicrosoft();
    } catch (err) {
      console.error('Microsoft sign-in error:', err);
      setLocalLoading(null);
    }
  };

  const containerClass = direction === 'vertical' ? 'flex flex-col gap-3' : 'flex gap-3 flex-wrap';
  const isLoading = authLoading || localLoading !== null;

  return (
    <div className={`${containerClass} ${className}`}>
      {showDivider && (
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OU</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
      )}

      {/* Google Button */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        type="button"
        className={`
          group relative flex items-center justify-center gap-2
          px-4 sm:px-6 py-3 rounded-xl
          border border-white/10 bg-white/5 hover:bg-white/10
          transition-all duration-300
          disabled:opacity-50 disabled:cursor-not-allowed
          ${direction === 'vertical' ? 'w-full' : 'flex-1 min-w-fit'}
        `}
        title="Entrar com Google"
      >
        {localLoading === 'google' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {showLabel && !isLoading && (
          <span className="text-xs font-bold hidden sm:inline">Google</span>
        )}
        {localLoading === 'google' && <span className="text-xs font-bold">Autenticando...</span>}
      </button>

      {/* Microsoft Button */}
      <button
        onClick={handleMicrosoftSignIn}
        disabled={isLoading}
        type="button"
        className={`
          group relative flex items-center justify-center gap-2
          px-4 sm:px-6 py-3 rounded-xl
          border border-white/10 bg-white/5 hover:bg-white/10
          transition-all duration-300
          disabled:opacity-50 disabled:cursor-not-allowed
          ${direction === 'vertical' ? 'w-full' : 'flex-1 min-w-fit'}
        `}
        title="Entrar com Microsoft"
      >
        {localLoading === 'microsoft' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 23 23" fill="currentColor">
            <path d="M11.4 11.5H1v9.8h10.4v-9.8zm0-11H1v9.4h10.4V.5zm11.1 0H12.1v9.4h10.4V.5zm0 11h-10.4v9.8h10.4v-9.8z" />
          </svg>
        )}
        {showLabel && !isLoading && (
          <span className="text-xs font-bold hidden sm:inline">Microsoft</span>
        )}
        {localLoading === 'microsoft' && <span className="text-xs font-bold">Autenticando...</span>}
      </button>

      {/* GitHub Button (Futuro) */}
      <button
        disabled={true}
        type="button"
        className={`
          group relative flex items-center justify-center gap-2
          px-4 sm:px-6 py-3 rounded-xl
          border border-white/10 bg-white/5 hover:bg-white/10
          transition-all duration-300
          disabled:opacity-30 disabled:cursor-not-allowed
          ${direction === 'vertical' ? 'w-full' : 'flex-1 min-w-fit'}
        `}
        title="GitHub (Breve)"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5a12 12 0 0 0-3.8 23.38c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.33-1.77-1.33-1.77-1.1-.76.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.08 1.84 2.82 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.9 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.53.12-3.18 0 0 1.01-.33 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.56 3.3-1.23 3.3-1.23.65 1.65.24 2.88.12 3.18.77.84 1.23 1.9 1.23 3.22 0 4.58-2.81 5.6-5.49 5.9.43.38.82 1.1.82 2.22v3.29c0 .32.22.69.83.58A12 12 0 0 0 12 .5Z" />
        </svg>
        {showLabel && (
          <span className="text-xs font-bold hidden sm:inline text-slate-500">GitHub</span>
        )}
      </button>
    </div>
  );
}
