import React from "react";
import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  Map as MapIcon, 
  FileDown, 
  Zap, 
  Layers, 
  CheckCircle2, 
  ChevronRight,
  ShieldCheck,
  Code2
} from "lucide-react";

/**
 * LandingDraftPage.tsx — Versão de rascunho da Landing Page.
 * Saneado para remover importações não utilizadas (Clean Code).
 */
export default function LandingDraftPage() {
  const [email, setEmail] = React.useState("");

  const features = [
    {
      title: "Exportação DXF",
      desc: "Gere arquivos AutoCAD prontos para o padrão Light/ANEEL.",
      icon: <FileDown className="h-6 w-6" />,
    },
    {
      title: "Topografia 2.5D",
      desc: "Modelagem precisa com dados de elevação reais do terreno.",
      icon: <MapIcon className="h-6 w-6" />,
    },
    {
      title: "Design Generativo",
      desc: "Otimização automática de vãos e queda de tensão.",
      icon: <Zap className="h-6 w-6" />,
    },
    {
      title: "BIM Metadata",
      desc: "Dados técnicos estruturados em cada componente da rede.",
      icon: <Layers className="h-6 w-6" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(56,189,248,0.15),rgba(0,0,0,0))]" />
        
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between p-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sky-500 flex items-center justify-center">
              <span className="font-black text-slate-950">T</span>
            </div>
            <span className="text-xl font-bold tracking-tight">sisTOPOGRAFIA</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-sky-400 transition-colors">Funcionalidades</a>
            <a href="#docs" className="hover:text-sky-400 transition-colors">Documentação</a>
            <Link to="/portal" className="rounded-full bg-slate-100 px-5 py-2 text-slate-950 hover:bg-white transition-all font-bold">
              Entrar
            </Link>
          </div>
        </nav>

        <main className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-32 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold leading-6 text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Versão 0.9.0 Disponível
            </div>
            <h1 className="mt-8 text-5xl font-black tracking-tight text-white sm:text-7xl">
              Engenharia Elétrica <br />
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
                Movida a Dados Reais.
              </span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-400">
              Acelere seu fluxo de projeto do OSM ao DXF. Modelagem topográfica 2.5D automática para rede de baixa e média tensão com compliance regulatório.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <input
                type="email"
                placeholder="Seu email corporativo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full sm:w-80 rounded-full border border-slate-800 bg-slate-900/50 px-6 py-3.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all"
              />
              <Link to="/portal" className="w-full sm:w-auto rounded-full bg-sky-500 px-8 py-4 text-sm font-bold text-slate-950 hover:bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all flex items-center justify-center gap-2">
                Começar agora <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </main>
      </div>

      {/* Features Grid */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-24">
          <div>
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              Tudo o que sua equipe precisa para escala industrial.
            </h2>
            <p className="mt-6 text-lg text-slate-400">
              O sisTOPOGRAFIA remove o gargalo da coleta de dados em campo, permitindo que engenheiros foquem na otimização da rede.
            </p>
            
            <div className="mt-10 space-y-6">
              {[
                { title: "Compliance ANEEL", icon: <ShieldCheck className="h-5 w-5 text-sky-400" /> },
                { title: "SLA de 99.9%", icon: <CheckCircle2 className="h-5 w-5 text-sky-400" /> },
                { title: "Exportação em Lote", icon: <Code2 className="h-5 w-5 text-sky-400" /> },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-3">
                  {item.icon}
                  <span className="font-semibold text-slate-200">{item.title}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 hover:border-slate-700 transition-colors group">
                <div className="mb-4 inline-block rounded-2xl bg-slate-800 p-3 group-hover:bg-sky-500/10 group-hover:text-sky-400 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/50 px-6 py-12">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-sm">© 2026 IM3 Brasil. Todos os direitos reservados.</span>
          </div>
          <div className="flex gap-4 text-xs text-slate-300">
            <a href="#" className="hover:text-slate-100">Privacidade</a>
            <a href="#" className="hover:text-slate-100">Termos</a>
            <a href="#" className="flex items-center gap-1 hover:text-slate-100">              Status <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
