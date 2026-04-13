# Padronização de Comentários (Item 26)

## Objetivo
Garantir consistência linguística em toda a base de código. Usar **português brasileiro (pt-BR)** para todos os comentários, documentação e strings de erro.

## Regras

### 1. Língua Padrão: Português Brasileiro (pt-BR)
- ✅ Usar pt-BR em comentários, docstrings, mensagens de erro
- ❌ Evitar misturar inglês e português
- ❌ Não usar anglicismos desnecessários

### 2. Comentários Simples
```typescript
// ✅ BOM: Claro e em pt-BR
const maxRadius = 50000; // Raio máximo em metros

// ❌ RUIM: Mistura português e inglês
const maxRadius = 50000; // max radius in meters

// ❌ RUIM: Sem contexto
const maxRadius = 50000; // 50000
```

### 3. Documentação (JSDoc)
```typescript
/**
 * ✅ BOM: Descrição em pt-BR, parâmetros documentados
 * Calcular distância entre dois pontos usando a fórmula de Haversine.
 * 
 * @param from - Ponto de origem com latitude e longitude
 * @param to - Ponto de destino com latitude e longitude
 * @returns Distância em metros
 * 
 * @example
 * const dist = calculateDistance(
 *   { lat: -22.9, lng: -43.1 },
 *   { lat: -23.0, lng: -43.2 }
 * );
 */
export function calculateDistance(from: Coordinates, to: Coordinates): number {
  // ...
}

/**
 * ❌ RUIM: Mistura de idiomas
 * Calculate the haversine distance between two points
 * Retorna distância em metros
 */
```

### 4. Mensagens de Erro e Toast
```typescript
// ✅ BOM: Mensagem clara em pt-BR
toast.error('Não foi possível carregar o arquivo DXF. Verifique o formato.');

// ❌ RUIM: Inglês ou sem contexto
toast.error('DXF loading failed');
toast.error('Erro');
```

### 5. Constantes e Enums
```typescript
// ✅ BOM: Nomes significativos em pt-BR
enum ProjectType {
  RAMAL = 'ramal',
  CLANDESTINO = 'clandestino',
}

const RAIO_MAXIMO_METROS = 50000;
const ERRO_VALIDACAO_COORDENADA = 'Coordenada fora do intervalo válido';

// ❌ RUIM: Nomes genéricos ou inglês
enum ProjectType {
  TYPE_A = 'a',
  TYPE_B = 'b',
}
```

### 6. Comentários Inline
```typescript
// ✅ BOM: Explicação concisa depois da lógica
const result = items.filter(item => item.active); // Filtrar apenas itens ativos

if (distance > MAX_RADIUS) {
  // Ponto fora da área de interesse
  return null;
}

// ❌ RUIM: Comentário sem valor
const result = items.filter(item => item.active); // Filter active items

// ❌ RUIM: Muito verboso
if (distance > MAX_RADIUS) {
  // Verificar se a distância do ponto até ao centro do raio
  // é maior que o raio máximo permitido para evitar problemas
  // de performance ao processar muitos pontos fora da zona
  return null;
}
```

### 7. TODO / FIXME / NOTE
```typescript
// ✅ BOM: Marcadores localizados
// TODO: Implementar cache de distâncias para melhor performance
// FIXME: Isso falha quando coordenadas são inválidas
// NOTE: Esta função assume que os inputs estão validados

// ❌ RUIM: Sem contexto
// TODO
// FIXME this crashes
```

### 8. Comentários de Seção
```typescript
// ✅ BOM: Seção clara com separadores
// ────────────────────────────────────────────────────────────────
// Utilitários de validação
// ────────────────────────────────────────────────────────────────

// ❌ RUIM: Confuso
// ===== VALIDATION =====
// Validation utilities
```

### 9. Strings de UI
```typescript
// ✅ BOM: Mensagens amigáveis em pt-BR
<Button>Salvar Topologia</Button>
<Tooltip>Exportar em formato DXF</Tooltip>
<Alert>Alterações não salvas. Deseja continuar?</Alert>

// ❌ RUIM: Genérico ou inglês
<Button>Save</Button>
<Alert>Unsaved changes. Continue?</Alert>
```

### 10. Migração de Código Existente
Para código antigo com comentários em inglês:
1. Quando editar a função → traduzir comentários para pt-BR
2. Não fazer tradução em massa em commit separado
3. Propagação gradual (ao refatorar/revisar)

**Prioridade de migração:**
- P0: Comentários em funções públicas (API)
- P1: Comentários em funções críticas (core logic)
- P2: Comentários em helpers
- P3: Comentários em testes

## Verificação

```bash
# Script para verificar comentários em inglês (requer shell)
# grep -r "TODO\|FIXME\|NOTE\|HACK" src/ | grep -E " [A-Z]" | head -20
```

## Exemplos de Conversão

| Antes (English) | Depois (pt-BR) |
|-----------------|----------------|
| `// Get user location` | `// Obter localização do usuário` |
| `// Handle error case` | `// Tratar caso de erro` |
| `@returns The distance in meters` | `@returns Distância em metros` |
| `Invalid input` | `Entrada inválida` |
| `Loading failed` | `Falha ao carregar` |

## Referências
- RFC 5646: Language tags em pt-BR
- Portuguese Wikipedia: Português brasileiro (Orthographic Standard)
- Consistent terminology for GIS concepts
