/**
 * Barrel export for all repositories (Repository Pattern – Item 2).
 *
 * Usage:
 *   import { jobRepository, dxfTaskRepository, roleRepository } from "../repositories/index.js";
 */
export {
  initDbClient,
  closeDbClient,
  getDbClient,
  isDbAvailable,
  pingDb,
} from "./dbClient.js";

export type { SqlClient } from "./dbClient.js";

export { jobRepository, PostgresJobRepository } from "./jobRepository.js";
export type {
  IJobRepository,
  JobRow,
  JobStatus,
  JobResultPayload,
} from "./jobRepository.js";

export {
  dxfTaskRepository,
  PostgresDxfTaskRepository,
} from "./dxfTaskRepository.js";
export type {
  IDxfTaskRepository,
  DxfTaskRow,
  DxfTaskStatus,
  DxfTaskPayload,
} from "./dxfTaskRepository.js";

export { roleRepository, PostgresRoleRepository } from "./roleRepository.js";
export type {
  IRoleRepository,
  UserRoleRow,
  UserRole,
} from "./roleRepository.js";

export {
  btExportHistoryRepository,
  PostgresBtExportHistoryRepository,
} from "./btExportHistoryRepository.js";
export type {
  IBtExportHistoryRepository,
  BtExportHistoryRow,
  BtExportHistoryFilter,
} from "./btExportHistoryRepository.js";

export {
  maintenanceRepository,
  PostgresMaintenanceRepository,
} from "./maintenanceRepository.js";
export type { IMaintenanceRepository } from "./maintenanceRepository.js";

export {
  canonicalTopologyRepository,
  PostgresCanonicalTopologyRepository,
} from "./canonicalTopologyRepository.js";
export type {
  ICanonicalTopologyRepository,
  TopologyReadResult,
  TopologyReadSource,
} from "./canonicalTopologyRepository.js";
