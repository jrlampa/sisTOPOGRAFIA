import { getDbClient } from '../repositories/dbClient.js';
import { logger } from '../utils/logger.js';
import { sendWebhookAlert } from '../utils/webhookNotifier.js';

async function notifyBackupAlert(title: string, payload: Record<string, unknown>): Promise<void> {
  await sendWebhookAlert({
    sloId: `backup:${String(payload.status ?? 'alert').toLowerCase()}`,
    sloName: title,
    currentCompliance: 0,
    alertThreshold: 1,
    errorBudgetRemaining: 0,
    message: `${title} | ${JSON.stringify(payload)}`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * BackupService — Orquestração de Backup, Restore Drills e Integridade.
 * Conecta a lógica de negócio do backend às funções Postgres no schema 'backup' e 'private'.
 */
export class BackupService {
  /**
   * Executa uma verificação de integridade dos backups e notifica em caso de falha.
   */
  static async verifyIntegrity(): Promise<boolean> {
    const db = getDbClient(true);
    if (!db) {
      logger.error('[BackupService] Falha ao obter cliente DB para verificação de integridade');
      return false;
    }

    try {
      const results = await db.unsafe(`SELECT * FROM private.verify_backup_integrity()`);

      const failures = results.filter(
        (r: any) => r.status === 'CRITICAL' || r.status === 'WARNING'
      );

      if (failures.length > 0) {
        logger.warn('[BackupService] Problemas detectados na integridade dos backups', {
          failures,
        });

        // Notificar via Webhook (Slack/Teams)
        await notifyBackupAlert('Integridade de Backup', {
          status: 'ALERTA',
          mensagem: 'Problemas detectados na verificação de integridade de backup.',
          detalhes: failures,
          ts: new Date().toISOString(),
        });

        return false;
      }

      logger.info('[BackupService] Integridade de backup verificada com sucesso');
      return true;
    } catch (error) {
      logger.error('[BackupService] Erro ao executar verify_backup_integrity', error);
      return false;
    }
  }

  /**
   * Executa o Drill de Restore automatizado (P0).
   */
  static async runRestoreDrill(tableName?: string): Promise<any> {
    const db = getDbClient(true);
    if (!db) throw new Error('DB indisponível');

    try {
      logger.info(
        `[BackupService] Iniciando Restore Drill para ${tableName || 'tabela aleatória'}...`
      );

      const [drillId] = await db.unsafe(`SELECT private.run_backup_restore_drill($1) as id`, [
        tableName,
      ]);

      const [drillResult] = await db.unsafe(`SELECT * FROM backup.drill_history WHERE id = $1`, [
        (drillId as any).id,
      ]);

      if (drillResult.status === 'failed') {
        logger.error('[BackupService] Restore Drill FALHOU', { drillResult });
        await notifyBackupAlert('Disaster Recovery Drill', {
          status: 'FALHA',
          tabela: drillResult.target_table,
          erro: drillResult.error_message,
          ts: new Date().toISOString(),
        });
      } else {
        logger.info('[BackupService] Restore Drill concluído com SUCESSO', { drillResult });
      }

      return drillResult;
    } catch (error) {
      logger.error('[BackupService] Erro catastrófico no Restore Drill', error);
      throw error;
    }
  }

  /**
   * Exporta snapshots lógicos para JSON (preparação para Backup Externo).
   */
  static async exportSnapshot(manifestId: string): Promise<string> {
    const db = getDbClient(true);
    if (!db) throw new Error('DB indisponível');

    try {
      const [manifest] = await db.unsafe(
        `SELECT table_name FROM backup.backup_manifest WHERE id = $1`,
        [manifestId]
      );
      if (!manifest) throw new Error('Manifesto não encontrado');

      const tableName = (manifest as any).table_name;
      let snapshotTable = '';

      if (tableName === 'constants_catalog') snapshotTable = 'constants_catalog_snapshot';
      else if (tableName === 'user_roles') snapshotTable = 'user_roles_snapshot';
      else snapshotTable = 'bt_export_history_snapshot';

      const data = await db.unsafe(`SELECT * FROM backup.${snapshotTable} WHERE _backup_id = $1`, [
        manifestId,
      ]);

      return JSON.stringify(data);
    } catch (error) {
      logger.error('[BackupService] Erro ao exportar snapshot', error);
      throw error;
    }
  }
}
