import React, { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { allowedCorporateDomain } from "../../lib/supabaseClient";

export function LandingAuth() {
  const {
    configured,
    loading,
    mode,
    user,
    error,
    message,
    awaitingEmailConfirmation,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithMicrosoft,
  } = useAuth();

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    try {
      if (authMode === "signup") {
        await signUpWithEmail({ email, password, fullName });
      } else {
        await signInWithEmail({ email, password });
      }
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Falha ao autenticar.");
    }
  }

  async function handleSocialLogin(provider: "google" | "microsoft") {
    setFormError(null);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithMicrosoft();
      }
    } catch (socialError) {
      setFormError(socialError instanceof Error ? socialError.message : "Falha no login social.");
    }
  }

  return (
    <section id="acesso" className="border-t border-white/5 px-6 py-20">
      <div className="mx-auto grid max-w-screen-xl gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            <Mail className="h-3.5 w-3.5" />
            Autoatendimento IM3 liberado
          </span>
          <h2 className="font-display mt-4 text-3xl font-black tracking-tight text-slate-50">
            Usuários {`@${allowedCorporateDomain}`} entram só com cadastro e confirmação de email.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            O fluxo aceita alias como <span className="font-semibold text-slate-200">nome+obra@{allowedCorporateDomain}</span>. O acesso é liberado após a confirmação do email enviada pelo Supabase.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">Regra aplicada</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Cadastro livre para aliases do domínio IM3 com onboarding automático no backend.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-400">Garantia operacional</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Enquanto o email não for confirmado, o backend mantém o acesso pendente.</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#071524]/80 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
          <div className="mb-5 flex rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${authMode === "signup" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
            >
              Cadastro IM3
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${authMode === "login" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
            >
              Entrar
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleAuthSubmit}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading || !configured}
                onClick={() => void handleSocialLogin("google")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {/* Google Icon */}
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
              <button
                type="button"
                disabled={loading || !configured}
                onClick={() => void handleSocialLogin("microsoft")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {/* Microsoft Icon */}
                <svg viewBox="0 0 23 23" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <rect x="1" y="1" width="10" height="10" fill="#F35325" />
                  <rect x="12" y="1" width="10" height="10" fill="#81BC06" />
                  <rect x="1" y="12" width="10" height="10" fill="#05A6F0" />
                  <rect x="12" y="12" width="10" height="10" fill="#FFBA08" />
                </svg>
                Microsoft
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500">ou com email</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {authMode === "signup" && (
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Nome</span>
                <input
                  name="fullName" value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome completo" autoComplete="name"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Email corporativo</span>
              <input
                name="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`voce+alias@${allowedCorporateDomain}`} autoComplete="email"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">Senha</span>
              <input
                name="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={authMode === "signup" ? "Mínimo recomendado: 10 caracteres" : "Sua senha"}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400"
              />
            </label>

            <button
              type="submit" disabled={loading || !configured}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {loading ? "Processando..." : authMode === "signup" ? "Cadastrar e confirmar email" : "Entrar com email"}
            </button>
          </form>

          <div className="mt-4 space-y-3 text-sm">
            {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-emerald-200">{message}</div>}
            {(formError || error) && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-rose-200">{formError || error}</div>}
            {!configured && <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-amber-100">Configure as variáveis de ambiente Supabase.</div>}
            {mode === "authenticated" && user && !awaitingEmailConfirmation && (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-cyan-100">
                Sessão ativa para <span className="font-semibold">{user.email}</span>.
                <div className="mt-2">
                  <Link to="/app" className="font-semibold text-white underline underline-offset-4">Abrir plataforma</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
