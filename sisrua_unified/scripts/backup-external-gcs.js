/**
 * backup-external-gcs.js — Exporta snapshots lógicos para o Google Cloud Storage.
 * 
 * Este script implementa a redundância geográfica P0 exigida pela conformidade SaaS.
 * Fluxo:
 *   1. Busca os últimos snapshots 'ok' do banco.
 *   2. Gera arquivos JSON/NDJSON para cada tabela.
 *   3. Upload para bucket GCS definido em GCS_BACKUP_BUCKET.
 */

import { Storage } from '@google-cloud/storage';
import { getDbClient } from '../server/repositories/dbClient.js';
import { logger } from './logger-adapter.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const BUCKET_NAME = process.env.GCS_BACKUP_BUCKET;
const PROJECT_ID = process.env.GCP_PROJECT_ID;

async function runExternalBackup() {
  if (!BUCKET_NAME) {
    logger.error('GCS_BACKUP_BUCKET não configurada. Abortando backup externo.');
    process.exit(1);
  }

  logger.info(`🚀 Iniciando exportação de backup externo para gs://${BUCKET_NAME}...`);

  const db = getDbClient(true);
  if (!db) {
    logger.error('Falha ao conectar ao banco de dados.');
    process.exit(1);
  }

  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);

  try {
    // 1. Obter últimos manifestos OK
    const manifests = await db.unsafe(`
      WITH ranked_manifests AS (
        SELECT id, table_name, backup_at,
               ROW_NUMBER() OVER(PARTITION BY table_name ORDER BY backup_at DESC) as rn
        FROM backup.backup_manifest
        WHERE status = 'ok'
      )
      SELECT id, table_name, backup_at
      FROM ranked_manifests
      WHERE rn = 1
    `);

    if (manifests.length === 0) {
      logger.warn('Nenhum snapshot encontrado para exportação.');
      return;
    }

    for (const m of manifests) {
      const manifestId = m.id;
      const tableName = m.table_name;
      const timestamp = new Date(m.backup_at).toISOString().replace(/[:.]/g, '-');
      const fileName = `backup-${tableName}-${timestamp}.json`;
      const gcsPath = `backups/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;

      logger.info(`📦 Exportando tabela ${tableName} (ID: ${manifestId})...`);

      let snapshotTable = '';
      if (tableName === 'constants_catalog') snapshotTable = 'constants_catalog_snapshot';
      else if (tableName === 'user_roles') snapshotTable = 'user_roles_snapshot';
      else snapshotTable = 'bt_export_history_snapshot';

      const rows = await db.unsafe(
        `SELECT * FROM backup.${snapshotTable} WHERE _backup_id = $1`,
        [manifestId]
      );

      const content = JSON.stringify(rows, null, 2);
      
      // Upload direto para o GCS
      const file = bucket.file(gcsPath);
      await file.save(content, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            manifestId: manifestId,
            tableName: tableName,
            backupAt: m.backup_at
          }
        }
      });

      logger.info(`✅ Upload concluído: gs://${BUCKET_NAME}/${gcsPath} (${rows.length} linhas)`);
    }

    logger.info('🎉 Backup externo geográfico finalizado com sucesso.');
  } catch (error) {
    logger.error('❌ Erro durante o backup externo:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runExternalBackup();
