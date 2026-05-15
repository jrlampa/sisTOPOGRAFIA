# Melhores Práticas para Testes E2E (Playwright)

Para garantir que os testes sejam estáveis, resilientes a mudanças de UI e fáceis de manter, siga estas diretrizes.

## 1. Seletores Estáveis

**Prioridade Máxima:** Use `data-testid`.
Evite seletores baseados em classes CSS (ex: `.bg-indigo-500`), pois estas mudam frequentemente durante refatorações de design.

```typescript
// RUIM (Frágil)
await page.locator('.btn-primary').click();

// BOM (Estável)
await page.getByTestId('login-submit').click();
```

## 2. Asserções Funcionais vs. URLs

Evite acoplamento a URLs exatas a menos que a rota seja um requisito de negócio estrito. Prefira validar que o usuário "chegou" ao destino verificando elementos visuais da página de destino.

```typescript
// FRÁGIL
await expect(page).toHaveURL('http://localhost:3000/portal/dashboard');

// ROBUSTO
await expect(page.getByRole('navigation')).toBeVisible();
await expect(page).toHaveURL(/.*dashboard/);
```

## 3. Mensagens de Erro Flexíveis

Use expressões regulares (regex) para validar mensagens de erro. Isso permite pequenas alterações no texto (ex: plural, pontuação) sem quebrar os testes.

```typescript
// RÍGIDO
await expect(errorBox).toHaveText('Somente emails @im3brasil.com.br têm autoatendimento liberado.');

// FLEXÍVEL
await expect(errorBox).toContainText(/emails? @.* liberado/i);
```

## 4. Timeouts e Delays

Componentes com animações ou delays intencionais (ex: redirecionamento após 1.5s) exigem timeouts maiores.

```typescript
// Aumente o timeout para operações conhecidamente lentas
await expect(successMsg).toBeVisible({ timeout: 10000 });
```

## 5. Limpeza de Estado

Sempre que possível, use factories ou scripts de seed para garantir um estado limpo antes de cada teste. Evite depender de dados criados por testes anteriores.
