/**
 * AjudaPage.tsx — Central de ajuda, documentação e suporte do sisTOPOGRAFIA.
 *
 * Seções: FAQ técnico · Documentação · Runbooks · Contato/Suporte · SLA de referência.
 * Roadmap Item 113 [T1] Service Desk L1/L2/L3, Item 112 [T1] Runbooks Operacionais.
 */
import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/PageShell';

// ─── Dados ────────────────────────────────────────────────────────────────

const FAQ_TECNICO = [
  {
    categoria: 'Extração de Dados',
    items: [
      {
        q: 'Por que a extração demora muito para áreas grandes?',
        a: 'Áreas superiores a 5 km² requerem múltiplas requisições à API do OpenStreetMap. Para grandes projetos, utilize a seleção por polígono e divida a área em trechos de até 3 km².',
      },
      {
        q: 'O OSM não tem dados suficientes na minha região. O que fazer?',
        a: 'Você pode contribuir com dados ao OSM via iD editor ou JOSM. Para projetos urgentes, entre em contato para análise de fontes alternativas como IBGE/MundoGEO.',
      },
      {
        q: 'Como garantir a precisão planimétrica do DXF gerado?',
        a: 'O sistema usa projeção SIRGAS 2000 com conversão UTM automática. A precisão planimétrica depende da qualidade do mapeamento OSM local. O DXF inclui metadados de proveniência para rastreabilidade.',
      },
    ],
  },
  {
    categoria: 'Exportação DXF',
    items: [
      {
        q: 'Quais versões do AutoCAD são suportadas?',
        a: 'O DXF gerado é compatível com AutoCAD 2010 e superior (formato DXF R14 e AC1021). Testado em AutoCAD LT, Civil 3D e BricsCAD.',
      },
      {
        q: 'As camadas do DXF seguem o padrão da Light S.A.?',
        a: 'Sim. O mapeamento de camadas segue as especificações CQT Light com configuração adaptável via painel de constantes no Admin.',
      },
      {
        q: 'Como exportar no formato BDGD para a ANEEL?',
        a: 'Disponível no plano Pro e Enterprise. Acesse Projeto → Exportar → BDGD ANEEL. O sistema valida automaticamente contra as normas vigentes e gera o dossiê de proveniência.',
      },
    ],
  },
  {
    categoria: 'Conta e Faturamento',
    items: [
      {
        q: 'Como alterar o plano de assinatura?',
        a: 'Acesse Admin → Configurações → Plano. Mudanças têm efeito imediato; o faturamento é proporcional ao período restante.',
      },
      {
        q: 'O que acontece quando excedo a quota de jobs?',
        a: 'Jobs excedentes são enfileirados e processados no próximo ciclo, ou você pode solicitar expansão temporária via suporte. Notificações são enviadas ao atingir 80% e 100% da quota.',
      },
    ],
  },
];

const DOCS = [
  { titulo: 'Início Rápido — Primeiros passos', icone: Zap, href: '#', tag: 'Básico' },
  { titulo: 'Guia de Extração de Áreas Complexas', icone: BookOpen, href: '#', tag: 'Avançado' },
  { titulo: 'Configuração de Camadas DXF por Tenant', icone: FileText, href: '#', tag: 'Avançado' },
  {
    titulo: 'Exportação BDGD — Conformidade ANEEL',
    icone: ShieldCheck,
    href: '#',
    tag: 'Regulatório',
  },
  {
    titulo: 'API REST — Referência completa (Swagger)',
    icone: Terminal,
    href: '/api/docs',
    tag: 'API',
  },
  {
    titulo: 'Runbooks SRE — Incidentes e Recuperação',
    icone: AlertTriangle,
    href: '#',
    tag: 'SRE',
  },
];

const RUNBOOKS = [
  {
    id: 'RB-01',
    titulo: 'Perda de Conexão com APIs Externas',
    descricao:
      'Procedimento de fallback e diagnóstico para falhas na API do OSM ou serviços de elevação.',
    tempo: '< 15min',
    prioridade: 'Alta',
  },
  {
    id: 'RB-02',
    titulo: 'Worker Python — OOM / Travamento',
    descricao:
      'Auto-healing automático configurado. Este runbook cobre casos onde o auto-healing falha.',
    tempo: '< 5min',
    prioridade: 'Alta',
  },
  {
    id: 'RB-03',
    titulo: 'Degradação de Performance no Export DXF',
    descricao:
      'Diagnóstico de gargalos: fila de jobs, memória do worker, tamanho da área selecionada.',
    tempo: '< 30min',
    prioridade: 'Média',
  },
  {
    id: 'RB-04',
    titulo: 'Falha de Autenticação / Token Expirado',
    descricao: 'Procedimento de renovação de sessão e limpeza de cache de autenticação.',
    tempo: '< 5min',
    prioridade: 'Média',
  },
];

// ─── Componentes ──────────────────────────────────────────────────────────

function FaqCategoria({ cat, isDark }: { cat: (typeof FAQ_TECNICO)[0]; isDark: boolean }) {
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  }

  return (
    <div>
      <h3
        className={`mb-3 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
      >
        {cat.categoria}
      </h3>
      <div className="flex flex-col gap-2">
        {cat.items.map((item, i) => (
          <div
            key={i}
            className={`rounded-xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}
          >
            <button
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
              onClick={() => toggle(i)}
            >
              {item.q}
              {expandidos.has(i) ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-indigo-400" />
              ) : (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                />
              )}
            </button>
            {expandidos.has(i) && (
              <div
                className={`border-t px-4 pb-4 pt-3 text-sm leading-relaxed ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-100 text-slate-600'}`}
              >
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function AjudaPage() {
  const [isDark, setIsDark] = useState(true);
  const [busca, setBusca] = useState('');

  const faqFiltrado = FAQ_TECNICO.map(cat => ({
    ...cat,
    items: busca
      ? cat.items.filter(
          item =>
            item.q.toLowerCase().includes(busca.toLowerCase()) ||
            item.a.toLowerCase().includes(busca.toLowerCase())
        )
      : cat.items,
  })).filter(cat => cat.items.length > 0);

  return (
    <PageShell isDark={isDark} onToggleTheme={() => setIsDark(v => !v)}>
      {/* ── Cabeçalho ── */}
      <div className="mb-10 text-center">
        <div className="mb-3 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15">
            <HelpCircle className="h-6 w-6 text-indigo-400" />
          </span>
        </div>
        <h1 className={`text-3xl font-black ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
          Central de Ajuda
        </h1>
        <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Documentação técnica, FAQ e suporte para o sisTOPOGRAFIA.
        </p>
        {/* Busca */}
        <div className="mx-auto mt-6 max-w-lg">
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${isDark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white'}`}
          >
            <Search
              className={`h-4 w-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            />
            <input
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar no FAQ técnico…"
              className={`flex-1 bg-transparent text-sm outline-none ${isDark ? 'text-slate-100 placeholder:text-slate-600' : 'text-slate-900 placeholder:text-slate-400'}`}
              aria-label="Buscar no FAQ"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* ── Coluna principal (FAQ + Runbooks) ── */}
        <div className="lg:col-span-2 flex flex-col gap-10">
          {/* FAQ Técnico */}
          <section aria-labelledby="faq-title">
            <h2
              id="faq-title"
              className={`mb-6 text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
            >
              FAQ Técnico
            </h2>
            {faqFiltrado.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Nenhum resultado para "{busca}".
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {faqFiltrado.map(cat => (
                  <FaqCategoria key={cat.categoria} cat={cat} isDark={isDark} />
                ))}
              </div>
            )}
          </section>

          {/* Runbooks */}
          <section aria-labelledby="runbooks-title">
            <h2
              id="runbooks-title"
              className={`mb-4 text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
            >
              Runbooks Operacionais
            </h2>
            <div className="flex flex-col gap-3">
              {RUNBOOKS.map(rb => (
                <div
                  key={rb.id}
                  className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 rounded-lg px-2 py-1 font-mono text-xs font-bold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {rb.id}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
                      >
                        {rb.titulo}
                      </p>
                      <p
                        className={`mt-0.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                      >
                        {rb.descricao}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        rb.prioridade === 'Alta'
                          ? 'bg-rose-500/15 text-rose-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {rb.prioridade}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    >
                      <Clock className="h-3 w-3" />
                      {rb.tempo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Sidebar (Docs + Contato) ── */}
        <aside className="flex flex-col gap-6">
          {/* Documentação */}
          <div
            className={`rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}
          >
            <h3
              className={`mb-4 flex items-center gap-2 text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
            >
              <BookOpen className="h-4 w-4 text-indigo-400" />
              Documentação
            </h3>
            <div className="flex flex-col gap-2">
              {DOCS.map(doc => (
                <a
                  key={doc.titulo}
                  href={doc.href}
                  className={`group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    isDark
                      ? 'border-white/5 hover:border-white/20 hover:bg-white/10'
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <doc.icone
                      className={`h-4 w-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
                    />
                    <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {doc.titulo}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {doc.tag}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Contato suporte */}
          <div
            className={`rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}
          >
            <h3
              className={`mb-4 flex items-center gap-2 text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}
            >
              <LifeBuoy className="h-4 w-4 text-indigo-400" />
              Suporte
            </h3>
            <div className="flex flex-col gap-3">
              <a
                href="mailto:suporte@sistopografia.com.br"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <Mail className="h-4 w-4 text-indigo-400" />
                suporte@sistopografia.com.br
              </a>
              <a
                href="#"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              >
                <MessageSquare className="h-4 w-4 text-indigo-400" />
                Chat em tempo real (horário comercial)
              </a>
            </div>
          </div>

          {/* SLA referência */}
          <div
            className={`rounded-2xl border p-5 ${isDark ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50'}`}
          >
            <h3
              className={`mb-3 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
            >
              SLA de Referência
            </h3>
            {[
              { label: 'Tempo de resposta L1', valor: '≤ 4h (horário comercial)' },
              { label: 'Tempo de resposta L2', valor: '≤ 8h' },
              { label: 'Resolução crítica', valor: '≤ 24h' },
              { label: 'Disponibilidade', valor: '99,5% mensal (Pro)' },
            ].map(item => (
              <div
                key={item.label}
                className={`flex justify-between border-b py-2 text-xs last:border-b-0 ${isDark ? 'border-white/10' : 'border-indigo-100'}`}
              >
                <span className={isDark ? 'text-slate-400' : 'text-indigo-700'}>{item.label}</span>
                <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-indigo-900'}`}>
                  {item.valor}
                </span>
              </div>
            ))}
            <div className="mt-3">
              <Link
                to="/admin"
                className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
              >
                Configurar SLO por serviço <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
