import React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { API_BASE_URL } from "../config/api";
import { clearLegacyAuthStorage, setAuthSnapshot } from "./authSession";
import {
  allowedCorporateDomain,
  isSupabaseClientConfigured,
  supabase,
} from "../lib/supabaseClient";

type AuthMode = "idle" | "anonymous" | "authenticated";

interface AuthAccess {
  role: string;
  tenantId: string | null;
}

interface AuthState {
  mode: AuthMode;
  loading: boolean;
  configured: boolean;
  user: User | null;
  access: AuthAccess | null;
  message: string | null;
  error: string | null;
  awaitingEmailConfirmation: boolean;
}

interface AuthContextValue extends AuthState {
  signUpWithEmail: (input: {
    email: string;
    password: string;
    fullName?: string;
  }) => Promise<void>;
  signInWithEmail: (input: {
    email: string;
    password: string;
  }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAllowedEmailDomain(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized.endsWith(`@${allowedCorporateDomain}`);
}

async function fetchAuthJson(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    mode: "idle",
    loading: true,
    configured: isSupabaseClientConfigured(),
    user: null,
    access: null,
    message: null,
    error: null,
    awaitingEmailConfirmation: false,
  });

  const syncSession = React.useCallback(async (session: Session | null) => {
    if (!session?.access_token || !session.user) {
      setAuthSnapshot({ userId: null, token: null, email: null });
      setState((current) => ({
        ...current,
        mode: "anonymous",
        loading: false,
        user: null,
        access: null,
        error: null,
        awaitingEmailConfirmation: false,
      }));
      return;
    }

    setAuthSnapshot({
      userId: session.user.id,
      token: session.access_token,
      email: session.user.email ?? null,
    });

    const onboarding = await fetchAuthJson(
      session.access_token,
      "/auth/onboarding",
      {
        method: "POST",
      },
    );

    if (onboarding.response.status === 202) {
      setState((current) => ({
        ...current,
        mode: "authenticated",
        loading: false,
        user: session.user,
        access: null,
        error: null,
        awaitingEmailConfirmation: true,
        message:
          "Confirme o email corporativo na sua caixa de entrada antes de usar a plataforma.",
      }));
      return;
    }

    if (onboarding.response.status === 403) {
      setState((current) => ({
        ...current,
        mode: "authenticated",
        loading: false,
        user: session.user,
        access: null,
        awaitingEmailConfirmation: false,
        error: `Somente emails @${allowedCorporateDomain} têm autoatendimento liberado.`,
        message: null,
      }));
      return;
    }

    if (!onboarding.response.ok && onboarding.response.status !== 200) {
      setState((current) => ({
        ...current,
        mode: "authenticated",
        loading: false,
        user: session.user,
        access: null,
        awaitingEmailConfirmation: false,
        error:
          (onboarding.body as { reason?: string }).reason ||
          "Não foi possível concluir o onboarding agora.",
        message: null,
      }));
      return;
    }

    const me = await fetchAuthJson(session.access_token, "/auth/me");
    if (!me.response.ok) {
      setState((current) => ({
        ...current,
        mode: "authenticated",
        loading: false,
        user: session.user,
        access: null,
        awaitingEmailConfirmation: false,
        error: "Sessão criada, mas o perfil ainda não pôde ser carregado.",
        message: null,
      }));
      return;
    }

    const payload = me.body as {
      access?: AuthAccess;
      signupPolicy?: {
        allowedDomain?: string;
        requiredEmailConfirmation?: boolean;
      };
    };

    setState({
      mode: "authenticated",
      loading: false,
      configured: true,
      user: session.user,
      access: payload.access ?? null,
      awaitingEmailConfirmation: false,
      error: null,
      message:
        payload.signupPolicy?.requiredEmailConfirmation === true
          ? `Conta liberada para ${allowedCorporateDomain}. Email confirmado com sucesso.`
          : null,
    });
  }, []);

  React.useEffect(() => {
    if (!supabase) {
      setState((current) => ({
        ...current,
        configured: false,
        mode: "anonymous",
        loading: false,
        error: "Supabase não está configurado no frontend.",
      }));
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        void syncSession(data.session);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [syncSession]);

  const signUpWithEmail = React.useCallback(
    async ({
      email,
      password,
      fullName,
    }: {
      email: string;
      password: string;
      fullName?: string;
    }) => {
      if (!supabase) {
        throw new Error("Supabase não está configurado.");
      }

      const normalizedEmail = normalizeEmail(email);
      if (!isAllowedEmailDomain(normalizedEmail)) {
        throw new Error(
          `Use um email @${allowedCorporateDomain}. Aliases com + são aceitos.`,
        );
      }

      setState((current) => ({
        ...current,
        loading: true,
        error: null,
        message: null,
      }));

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName?.trim() || undefined,
          },
        },
      });

      if (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
        throw error;
      }

      setState((current) => ({
        ...current,
        loading: false,
        message:
          "Cadastro iniciado. Confirme o email enviado ao endereço corporativo para liberar o uso.",
        awaitingEmailConfirmation: true,
      }));
    },
    [],
  );

  const signInWithEmail = React.useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      if (!supabase) {
        throw new Error("Supabase não está configurado.");
      }

      setState((current) => ({
        ...current,
        loading: true,
        error: null,
        message: null,
      }));

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });

      if (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
        throw error;
      }
    },
    [],
  );

  const signOut = React.useCallback(async () => {
    clearLegacyAuthStorage();
    setAuthSnapshot({ userId: null, token: null, email: null });

    if (supabase) {
      await supabase.auth.signOut();
    }

    setState((current) => ({
      ...current,
      mode: "anonymous",
      loading: false,
      user: null,
      access: null,
      awaitingEmailConfirmation: false,
      error: null,
      message: null,
    }));
  }, []);

  const signInWithGoogle = React.useCallback(async () => {
    if (!supabase) {
      throw new Error("Supabase não está configurado.");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signInWithMicrosoft = React.useCallback(async () => {
    if (!supabase) {
      throw new Error("Supabase não está configurado.");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const refreshProfile = React.useCallback(async () => {
    if (!supabase) {
      return;
    }
    const { data } = await supabase.auth.getSession();
    await syncSession(data.session);
  }, [syncSession]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signUpWithEmail,
        signInWithEmail,
        signInWithGoogle,
        signInWithMicrosoft,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
