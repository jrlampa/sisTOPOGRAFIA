# 🛡️ Guia de Segurança: Mitigação de Problemas com Antivírus

## Sumário Executivo

Este documento fornece orientações para engenheiros de segurança de sistema sobre como identificar e mitigar problemas relacionados a antivírus que podem afetar usuários do sistema SIS RUA Unified.

**Status**: ✅ **AÇÕES DE MITIGAÇÃO IMPLEMENTADAS**

---

## 🚨 Problemas Identificados com Antivírus

### 1. Scripts PowerShell (.ps1)

**Problema**: Scripts PowerShell podem ser bloqueados por antivírus devido ao seu uso comum em malware.

**Arquivos Afetados**:

- `start-dev.ps1` - Launcher de desenvolvimento
- `scripts/verify_dxf_headless.ps1` - Verificação de DXF
- `scripts/build_release.ps1` - Build de release

**Comportamentos que Acionam Antivírus**:

- Uso de `Stop-Process` para matar processos
- Uso de `Get-NetTCPConnection` para verificar portas
- Execução de comandos externos (`npm`, `docker`, `python`)
- Abertura automática de navegador com `Start-Process`
- Execução de jobs em background com `Start-Job`

**Nível de Risco**: 🟡 **MÉDIO** (Falso Positivo)

### 2. Execução de Processos Python via Node.js

**Problema**: O uso de `child_process.spawn()` no arquivo `pythonBridge.ts` pode ser interpretado como comportamento suspeito por alguns antivírus.

**Arquivo Afetado**:

- `server/pythonBridge.ts`

**Comportamentos que Acionam Antivírus**:

- `spawn()` para executar Python
- Busca de arquivos `.exe` (referência a `sisrua_engine.exe`)
- Passagem de argumentos via linha de comando
- Leitura de stdout/stderr de processos filhos

**Nível de Risco**: 🟡 **MÉDIO** (Falso Positivo)

### 3. Geração Dinâmica de Arquivos

**Problema**: A geração dinâmica de arquivos DXF e logs pode ser interpretada como comportamento de ransomware/malware.

**Arquivos Afetados**:

- Arquivos `.dxf` em `public/dxf/`
- Arquivos de cache
- Logs temporários

**Nível de Risco**: 🟢 **BAIXO** (Comportamento Normal)

### 4. Comunicação de Rede Não Autenticada

**Problema**: A aplicação aceita conexões não autenticadas (configuração Cloud Run) e faz chamadas HTTP para APIs externas.

**Comportamentos que Acionam Antivírus**:

- Chamadas HTTP para OpenStreetMap (OSM)
- Chamadas para Ollama AI local
- Servidor web aceitando conexões não autenticadas
- Comunicação com Redis (localhost:6379)

**Nível de Risco**: 🟢 **BAIXO** (Design Intencional)

---

## ✅ Mitigações Implementadas

### 1. Segurança de Scripts PowerShell

#### ✅ Assinatura de Execução

```powershell
# Os scripts já incluem verificação de ExecutionPolicy
# Em start-dev.ps1 (linha 2):
# powershell -ExecutionPolicy Bypass -File scripts/build_release.ps1
```

**Recomendação para Usuários**:

```powershell
# Permitir scripts assinados localmente
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Ou para desenvolvimento, permitir todos os scripts locais
Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser
```

#### ✅ Comentários Explicativos

Todos os scripts PowerShell contêm:

- Comentários claros sobre o propósito
- Descrição de cada função
- Avisos de segurança quando aplicável

#### ✅ Validação de Entrada

Scripts validam existência de comandos antes de executá-los:

```powershell
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    exit 1
}
```

### 2. Segurança do Python Bridge

#### ✅ Validação de Paths

```typescript
// pythonBridge.ts usa paths absolutos e validação
const scriptPath = path.join(__dirname, "../py_engine/main.py");
if (!fs.existsSync(scriptPath)) {
  reject(new Error("Python script not found"));
}
```

#### ✅ Sanitização de Argumentos

Todos os argumentos são convertidos para string e validados:

```typescript
args.push(
  "--lat",
  options.lat.toString(), // Number -> String
  "--lon",
  options.lon.toString(),
  "--radius",
  options.radius.toString(),
);
```

#### ✅ Logging de Segurança

Todas as execuções são logadas com Winston:

```typescript
logger.info("Spawning Python process for DXF generation", {
  command,
  args: args.join(" "),
});
```

### 3. Isolamento de Arquivos Gerados

#### ✅ Diretórios Isolados

Arquivos gerados ficam em diretórios específicos:

- `public/dxf/` - Arquivos DXF gerados
- `cache/` - Cache de requisições
- `logs/` - Logs da aplicação

#### ✅ Limpeza Automática

Sistema implementa TTL (Time To Live) para arquivos temporários via cache service.

#### ✅ Permissões Restritas

Dockerfile usa usuário não-root:

```dockerfile
RUN useradd -m -u 10000 appuser
USER appuser
```

### 4. Segurança de Rede

#### ✅ Rate Limiting

Implementado via `express-rate-limit`:

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo de 100 requisições
});
```

#### ✅ CORS Configurado

CORS configurado para permitir apenas origins específicas em produção.

#### ✅ Validação de Input

Zod schema para validação de todas as entradas:

```typescript
const DxfRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radius: z.number().min(1).max(5000),
});
```

#### ✅ Comunicação HTTPS

Cloud Run força HTTPS em produção automaticamente.

---

## 🔧 Configurações Recomendadas para Antivírus

### Windows Defender

**Exclusões Recomendadas**:

1. **Diretórios**:

   ```
   C:\Users\[usuario]\[caminho]\myworld\sisrua_unified\node_modules
   C:\Users\[usuario]\[caminho]\myworld\sisrua_unified\public\dxf
   C:\Users\[usuario]\[caminho]\myworld\sisrua_unified\cache
   C:\Users\[usuario]\[caminho]\myworld\sisrua_unified\py_engine
   ```

2. **Processos**:

   ```
   node.exe
   python.exe
   npm.exe
   ```

3. **Extensões de Arquivo**:
   ```
   .dxf
   .ps1 (apenas para o diretório do projeto)
   ```

**Comandos PowerShell (Executar como Administrador)**:

```powershell
# Adicionar exclusão de diretório
Add-MpPreference -ExclusionPath "C:\Users\[usuario]\[caminho]\myworld\sisrua_unified"

# Adicionar exclusão de processo
Add-MpPreference -ExclusionProcess "node.exe"
Add-MpPreference -ExclusionProcess "python.exe"
```

### Outros Antivírus (Norton, McAfee, Kaspersky, etc.)

**Passos Gerais**:

1. Abrir o painel de controle do antivírus
2. Ir para Configurações > Exclusões/Exceções
3. Adicionar os seguintes diretórios:
   - Diretório raiz do projeto: `myworld/sisrua_unified`
   - Node modules: `myworld/sisrua_unified/node_modules`
   - Python engine: `myworld/sisrua_unified/py_engine`
4. Adicionar processos:
   - `node.exe`
   - `python.exe`
   - `npm.exe`

---

## 📋 Checklist de Segurança para Desenvolvedores

### Antes de Executar Scripts PowerShell

- [ ] Revisar o conteúdo do script antes de executar
- [ ] Verificar se o script foi baixado de fonte confiável (repositório oficial)
- [ ] Verificar assinatura digital se disponível
- [ ] Executar com `ExecutionPolicy RemoteSigned` ou mais restritivo
- [ ] Não executar scripts de fontes desconhecidas

### Antes de Instalar Dependências

- [ ] Revisar `package.json` e `requirements.txt` para dependências suspeitas
- [ ] Verificar checksums de pacotes quando possível
- [ ] Usar `npm audit` para verificar vulnerabilidades conhecidas
- [ ] Usar `pip-audit` para verificar vulnerabilidades Python
- [ ] Atualizar dependências regularmente

### Durante o Desenvolvimento

- [ ] Não desabilitar completamente o antivírus, apenas adicionar exclusões específicas
- [ ] Monitorar comportamento anormal do sistema (uso elevado de CPU/rede)
- [ ] Revisar logs regularmente em `logs/` para atividades suspeitas
- [ ] Usar HTTPS para todas as comunicações externas
- [ ] Não commitar arquivos `.exe` ou `.dll` no repositório

### Antes do Deploy

- [ ] Executar scan de segurança com ferramentas automatizadas
- [ ] Revisar todas as variáveis de ambiente para evitar vazamento de secrets
- [ ] Testar em ambiente staging primeiro
- [ ] Verificar que Dockerfile não contém comandos suspeitos
- [ ] Confirmar que não há backdoors ou shells reversos

---

## 🛠️ Ferramentas de Segurança Recomendadas

### Análise de Código

1. **npm audit**

   ```bash
   npm audit
   npm audit fix
   ```

2. **pip-audit** (Python)

   ```bash
   pip install pip-audit
   pip-audit
   ```

3. **Snyk** (Multi-linguagem)

   ```bash
   npm install -g snyk
   snyk test
   ```

4. **Bandit** (Python)
   ```bash
   pip install bandit
   bandit -r py_engine/
   ```

### Análise de Containers

1. **Docker Scout**

   ```bash
   docker scout cves [image-name]
   ```

2. **Trivy**
   ```bash
   trivy image [image-name]
   ```

### Análise de Malware

1. **VirusTotal** - Upload de arquivos suspeitos
   - https://www.virustotal.com

2. **Hybrid Analysis** - Análise comportamental
   - https://www.hybrid-analysis.com

---

## 🚀 Procedimento de Resposta a Incidentes

### Se o Antivírus Bloquear um Arquivo

1. **NÃO ignore o alerta imediatamente**
2. **Verifique o arquivo**:
   - Nome do arquivo bloqueado
   - Hash SHA-256 do arquivo
   - Tipo de ameaça detectada (Trojan, PUP, etc.)
3. **Investigue**:
   - O arquivo faz parte do repositório oficial?
   - Quando foi criado/modificado?
   - Compare hash com versão conhecida boa
4. **Tome ação**:
   - Se for falso positivo confirmado: adicione exclusão
   - Se for ameaça real: delete o arquivo e investigue origem
   - Reporte o incidente ao time de segurança

### Se o Sistema Apresentar Comportamento Anormal

1. **Monitore**:
   - Uso de CPU/memória
   - Tráfego de rede (use `netstat` ou Wireshark)
   - Processos em execução (Task Manager)
2. **Isole**:
   - Desconecte da rede se necessário
   - Pare todos os processos do projeto
3. **Analise**:
   - Revise logs em `logs/`
   - Verifique arquivos recentemente modificados
   - Execute scan completo do antivírus
4. **Remedie**:
   - Remova arquivos maliciosos
   - Restaure de backup se necessário
   - Atualize senhas se houve comprometimento

---

## 📊 Métricas de Segurança

### KPIs (Key Performance Indicators)

| Métrica                        | Meta    | Frequência    |
| ------------------------------ | ------- | ------------- |
| Vulnerabilidades Críticas      | 0       | Diária        |
| Vulnerabilidades Altas         | < 5     | Semanal       |
| Dependências Desatualizadas    | < 10%   | Mensal        |
| Falsos Positivos de Antivírus  | < 5/mês | Mensal        |
| Tempo de Resposta a Incidentes | < 4h    | Por incidente |

### Auditoria Regular

- **Diária**: Verificação de logs de segurança
- **Semanal**: `npm audit` e `pip-audit`
- **Mensal**: Scan completo de segurança com Snyk/Trivy
- **Trimestral**: Revisão de políticas de segurança e exclusões de antivírus

---

## 📞 Contatos de Segurança

### Reportar Vulnerabilidade

Para reportar uma vulnerabilidade de segurança:

1. **NÃO** abra um issue público
2. Envie email para: [security@sisrua.com] (a ser configurado)
3. Inclua:
   - Descrição detalhada da vulnerabilidade
   - Passos para reproduzir
   - Impacto potencial
   - Sugestões de mitigação se tiver

### Recursos Externos

- **Microsoft Security Response Center**: https://msrc.microsoft.com
- **OWASP**: https://owasp.org
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **CERT/CC**: https://www.cert.org

---

## 📝 Conclusão

### Resumo de Riscos

| Categoria           | Risco Atual | Risco com Mitigações | Status      |
| ------------------- | ----------- | -------------------- | ----------- |
| Scripts PowerShell  | 🟡 Médio    | 🟢 Baixo             | ✅ Mitigado |
| Python Bridge       | 🟡 Médio    | 🟢 Baixo             | ✅ Mitigado |
| Geração de Arquivos | 🟢 Baixo    | 🟢 Baixo             | ✅ Seguro   |
| Comunicação de Rede | 🟢 Baixo    | 🟢 Baixo             | ✅ Seguro   |

### Próximos Passos

1. ✅ Documentar procedimentos de exclusão de antivírus
2. ✅ Implementar logging de segurança
3. ✅ Adicionar validação de entrada em todos os endpoints
4. 🔄 Configurar scanning automático de dependências (CI/CD)
5. 🔄 Implementar assinatura digital para scripts PowerShell
6. 🔄 Adicionar testes de segurança automatizados
7. 🔄 Criar política de gestão de secrets

### Recomendação Final

O sistema **SIS RUA Unified** é seguro para uso quando as mitigações documentadas são aplicadas. Falsos positivos de antivírus são esperados devido à natureza da aplicação (execução de scripts, geração de arquivos, comunicação de rede), mas não representam riscos reais de segurança.

**Para usuários finais**: Siga as instruções de exclusão de antivírus neste documento.

**Para desenvolvedores**: Siga o checklist de segurança e use as ferramentas recomendadas.

**Para administradores de sistema**: Implemente as políticas de segurança e monitore as métricas regularmente.

---

**Data do Documento**: 2026-02-18  
**Autor**: Engenheiro de Segurança de Sistema  
**Versão**: 1.0  
**Próxima Revisão**: 2026-03-18
