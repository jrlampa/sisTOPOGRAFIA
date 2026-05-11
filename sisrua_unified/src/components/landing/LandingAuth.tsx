import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  Building2, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

/**
 * LandingAuth.tsx — Portal de autenticação corporativo da Landing Page.
 */
export function LandingAuth() {
  const { signInWithEmail, loading, error, user } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [tenantId, setTenantId] = React.useState("");
  const [isSuccess, setIsSuccess] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmail({ email, password });
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section id="acesso" className="relative py-24 px-6 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Content side */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={14} />
              Protocolo de Segurança Ativo
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase italic leading-[1.1]">
              Acesso à <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">
                Jurisdição Digital.
              </span>
            </h2>
            <p className="text-lg text-slate-400 max-w-lg leading-relaxed font-medium">
              Conecte-se com sua identidade corporativa para acessar projetos topográficos, análises de conformidade e o motor de design generativo.
            </p>
            
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <div className="text-2xl font-black text-white italic tracking-tighter">AES 256</div>
                <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Encriptação ponta-a-ponta</div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-black text-white italic tracking-tighter">SSO Ready</div>
                <div className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Integração Azure/Okta</div>
              </div>
            </div>
          </motion.div>

          {/* Form side */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-indigo-500/5 blur-3xl" />
            <div className="relative glass-premium border border-white/10 bg-[#020617]/40 p-8 sm:p-12 rounded-[2.5rem] shadow-2xl backdrop-blur-3xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600" />
              
              <AnimatePresence mode="wait">
                {isSuccess || user ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-12 text-center"
                  >
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-emerald-500/30">
                       <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 italic">Bem-vindo de volta</h3>
                    <p className="text-slate-400 text-sm font-medium mb-8">Redirecionando para o seu portal corporativo...</p>
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </motion.div>
                ) : (
                  <motion.form 
                    key="form"
                    onSubmit={handleLogin} 
                    className="space-y-6"
                  >
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">
                          Email Corporativo
                        </label>
                        <div className="relative group">
                          <input 
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="seu@empresa.com.br"
                            className="w-full h-14 rounded-2xl border-2 border-white/5 bg-slate-950/50 px-12 text-sm font-bold text-white shadow-inner transition-all focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none placeholder:text-slate-600"
                          />
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-400 transition-colors" size={18} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">
                          Chave de Acesso
                        </label>
                        <div className="relative group">
                          <input 
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full h-14 rounded-2xl border-2 border-white/5 bg-slate-950/50 px-12 text-sm font-bold text-white shadow-inner transition-all focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none placeholder:text-slate-600"
                          />
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-cyan-400 transition-colors" size={18} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">
                          ID da Organização (Opcional)
                        </label>
                        <div className="relative group">
                          <input 
                            type="text"
                            value={tenantId}
                            onChange={e => setTenantId(e.target.value)}
                            placeholder="Ex: IM3-RJ-01"
                            className="w-full h-14 rounded-2xl border-2 border-white/5 bg-slate-950/50 px-12 text-sm font-bold text-white shadow-inner transition-all focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none placeholder:text-slate-600 opacity-60 focus:opacity-100"
                          />
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        </div>
                      </div>
                    </div>

                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold"
                      >
                        <AlertCircle size={16} />
                        {error}
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-16 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-indigo-600/30 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          Autenticando
                        </>
                      ) : (
                        <>
                          Entrar na Plataforma
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-2 pt-2">
                       <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Esqueceu a chave?</span>
                       <a href="#" className="text-[10px] font-black text-indigo-400 hover:text-cyan-400 transition-colors uppercase tracking-widest">Recuperar</a>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
