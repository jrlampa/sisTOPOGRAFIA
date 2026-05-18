# Guia de Contribuição — sisTOPOGRAFIA

Bem-vindo ao projeto sisTOPOGRAFIA! Como um sistema de grau enterprise para geoprocessamento elétrico, seguimos padrões rigorosos de qualidade e segurança.

## 🛠️ Stack Tecnológica

- **Frontend:** React 19 (TypeScript), Tailwind CSS 4, Vite, Leaflet, Recharts.
- **Backend:** Node.js (Express), PostgreSQL (Supabase), Redis, Stripe.
- **Engine:** Python 3.12 (OSMnx, GeoPandas, ezdxf).

## 📏 Regras Não Negociáveis

1.  **Branch `dev`:** Todo trabalho deve ser validado e commitado na branch `dev`.
2.  **Lógica Pesada no Backend:** O frontend deve ser "fino", delegando cálculos complexos ao servidor ou motor Python.
3.  **2.5D:** Não utilizamos 3D; todas as representações espaciais são 2.5D.
4.  **Cobertura de Testes:** Mínimo global de **80%**. Críticos exigem **100%**.
5.  **Segurança First:** Sanitização de todos os inputs, validação de assinaturas Stripe e RLS ativo no Supabase.
6.  **Modularidade:** Siga o princípio de responsabilidade única. Arquivos > 500 linhas devem ser modularizados.
7.  **Idioma:** Interface e documentação técnica em **pt-BR**.

## 🚀 Fluxo de Trabalho

1.  **Instalação:** `npm install --legacy-peer-deps` e `pip install -r py_engine/requirements.txt`.
2.  **Desenvolvimento:** `npm run dev`.
3.  **Qualidade:** Antes de qualquer commit:
    -   `npm run lint`
    -   `npm run typecheck:frontend`
    -   `npm run typecheck:backend`
    -   `npm run test:unit`
4.  **Commits:** Bloqueados por Husky se o lint ou testes falharem.

## 🛡️ Segurança e Dependências

-   Sempre use `npm run security:audit` para verificar vulnerabilidades Node.
-   Use `npm run security:pip:audit` para vulnerabilidades Python.
-   Mantenha `requirements.in` atualizado e compile via `npm run security:pip:compile`.

## 📚 Documentação

-   `MEMORY.md`: Contexto atual do projeto e decisões técnicas.
-   `CAC.md`: Configuração avançada de cache e performance.
-   `RUNBOOK.md`: Procedimentos operacionais e resposta a incidentes.
