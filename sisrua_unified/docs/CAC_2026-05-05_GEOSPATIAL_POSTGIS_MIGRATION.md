# CAC – 2026-05-05 – Migração para PostGIS e Indexação Espacial Nativa

## Contexto

Embora o sistema gerencie coordenadas geográficas (`lat`, `lng`), estas eram armazenadas como `DOUBLE PRECISION`. Esta abordagem limitava a performance de consultas espaciais (bounding-box para o mapa, cálculos de proximidade) e impossibilitava o uso de funções geométricas avançadas do Postgres.

## Solução Implementada (063_geospatial_postgis_migration.sql)

### 1. Habilitação do PostGIS

Ativamos a extensão `postgis` no schema `extensions` (padrão Supabase/IM3). Isso libera tipos como `GEOMETRY` e centenas de funções espaciais (`ST_Distance`, `ST_Intersects`, etc.).

### 2. Tipagem Nativa de Geometria

Adicionamos colunas do tipo `geometry(Point, 4326)` às tabelas principais de geoprocessamento:
- `public.canonical_poles`: Representação nativa do poste.
- `public.bt_export_history`: Localização do ponto crítico de exportação.

### 3. Indexação Espacial (GIST)

Implementamos índices `GIST` nas colunas `geom`. Diferente dos índices B-tree (que são lineares), os índices GIST organizam dados em estruturas de árvore R (R-tree), permitindo consultas de "janela de visualização" (map viewport) extremamente rápidas.

### 4. Sincronização Automática (Dual-Storage)

Para manter compatibilidade com o código legado que ainda escreve em `lat`/`lng`, implementamos um trigger `BEFORE INSERT OR UPDATE` (`trg_sync_canonical_poles_geom`). 

**Comportamento:**
- Qualquer alteração em `lat` ou `lng` recalcula automaticamente o campo `geom`.
- Garante que a "Source of Truth" geométrica esteja sempre atualizada sem mudanças no código da aplicação.

## Benefícios Imediatos

| Feature                         | Melhoria                               |
|---------------------------------|----------------------------------------|
| Renderização de Mapa            | Redução de latência em queries BBox    |
| Análise de Proximidade          | Cálculos de vizinhança O(log N)        |
| BI / Heatmaps                   | Suporte nativo a ferramentas de GIS    |
| Integridade                     | Validação de coordenadas via SRID 4326 |

## Próximos Passos Recomendados

- **Refatoração do Repositório**: Atualizar `canonicalTopologyRepository.ts` para opcionalmente utilizar `ST_AsGeoJSON(geom)` para transferências de dados mais leves.
- **Cálculos de Rede**: Utilizar `ST_DistanceSphere` para validação de comprimentos de vãos diretamente no banco.
