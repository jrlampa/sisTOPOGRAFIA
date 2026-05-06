import { createHash } from "crypto";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type JmlEventType = "joiner" | "mover" | "leaver";
export type UserStatus = "ativo" | "inativo" | "suspenso";
export type ScimUserStatus = "active" | "inactive";

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  nomeCompleto: string;
  departamento: string;
  cargo: string;
  tenantId: string;
  status: UserStatus;
  roles: string[];
  externalId?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface JmlEvent {
  id: string;
  tipo: JmlEventType;
  userId: string;
  executor: string;
  tenantId: string;
  payload: Record<string, unknown>;
  ts: string;
}

export interface ScimUser {
  schemas: string[];
  id: string;
  userName: string;
  name: { formatted: string; givenName?: string; familyName?: string };
  emails: Array<{ value: string; primary: boolean }>;
  active: boolean;
  externalId?: string;
  meta: { resourceType: string; created: string; lastModified: string };
}

// ─── Constantes ────────────────────────────────────────────────────────────

const SCIM_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";

// ─── Estado em memória ─────────────────────────────────────────────────────

let users = new Map<string, ManagedUser>();
let events: JmlEvent[] = [];
let counter = 1;

function nextId(): string {
  return `iam-${counter++}`;
}

function eventId(): string {
  return `jml-evt-${counter++}`;
}

function now(): string {
  return new Date().toISOString();
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 8);
}

function toScimUser(u: ManagedUser): ScimUser {
  const [givenName, ...rest] = u.nomeCompleto.split(" ");
  return {
    schemas: [SCIM_SCHEMA],
    id: u.id,
    userName: u.username,
    name: { formatted: u.nomeCompleto, givenName, familyName: rest.join(" ") || undefined },
    emails: [{ value: u.email, primary: true }],
    active: u.status === "ativo",
    externalId: u.externalId,
    meta: { resourceType: "User", created: u.criadoEm, lastModified: u.atualizadoEm },
  };
}

// ─── Serviço ───────────────────────────────────────────────────────────────

export class IdentityLifecycleService {
  static joiner(params: {
    username: string;
    email: string;
    nomeCompleto: string;
    departamento: string;
    cargo: string;
    tenantId: string;
    roles?: string[];
    externalId?: string;
    executor: string;
  }): ManagedUser {
    const id = nextId();
    const ts = now();
    const user: ManagedUser = {
      id,
      username: params.username,
      email: params.email,
      nomeCompleto: params.nomeCompleto,
      departamento: params.departamento,
      cargo: params.cargo,
      tenantId: params.tenantId,
      status: "ativo",
      roles: params.roles ?? [],
      externalId: params.externalId,
      criadoEm: ts,
      atualizadoEm: ts,
    };
    users.set(id, user);
    events.push({
      id: eventId(),
      tipo: "joiner",
      userId: id,
      executor: params.executor,
      tenantId: params.tenantId,
      payload: { departamento: params.departamento, cargo: params.cargo },
      ts,
    });
    return user;
  }

  static mover(params: {
    userId: string;
    departamento?: string;
    cargo?: string;
    roles?: string[];
    executor: string;
  }): ManagedUser {
    const user = users.get(params.userId);
    if (!user) throw new Error(`Usuário não encontrado: ${params.userId}`);
    const ts = now();
    const antes = { departamento: user.departamento, cargo: user.cargo, roles: [...user.roles] };
    if (params.departamento !== undefined) user.departamento = params.departamento;
    if (params.cargo !== undefined) user.cargo = params.cargo;
    if (params.roles !== undefined) user.roles = params.roles;
    user.atualizadoEm = ts;
    events.push({
      id: eventId(),
      tipo: "mover",
      userId: params.userId,
      executor: params.executor,
      tenantId: user.tenantId,
      payload: { antes, depois: { departamento: user.departamento, cargo: user.cargo, roles: user.roles } },
      ts,
    });
    return user;
  }

  static leaver(params: { userId: string; executor: string }): ManagedUser {
    const user = users.get(params.userId);
    if (!user) throw new Error(`Usuário não encontrado: ${params.userId}`);
    const ts = now();
    user.status = "inativo";
    user.roles = [];
    user.atualizadoEm = ts;
    events.push({
      id: eventId(),
      tipo: "leaver",
      userId: params.userId,
      executor: params.executor,
      tenantId: user.tenantId,
      payload: { motivoDesligamento: "saída voluntária ou compulsória" },
      ts,
    });
    return user;
  }

  static getUser(id: string): ManagedUser | undefined {
    return users.get(id);
  }

  static listUsers(tenantId?: string): ManagedUser[] {
    const all = Array.from(users.values());
    return tenantId ? all.filter((u) => u.tenantId === tenantId) : all;
  }

  static getAudit(tenantId?: string): JmlEvent[] {
    return tenantId ? events.filter((e) => e.tenantId === tenantId) : [...events];
  }

  // ─── SCIM v2 ─────────────────────────────────────────────────────────────

  static scimCreateUser(payload: {
    userName: string;
    name?: { formatted?: string; givenName?: string; familyName?: string };
    emails?: Array<{ value: string; primary?: boolean }>;
    active?: boolean;
    externalId?: string;
    tenantId: string;
  }): ScimUser {
    const nomeCompleto =
      payload.name?.formatted ??
      ((`${payload.name?.givenName ?? ""} ${payload.name?.familyName ?? ""}`.trim()) || payload.userName);
    const email =
      payload.emails?.find((e) => e.primary)?.value ??
      payload.emails?.[0]?.value ??
      `${hashEmail(payload.userName)}@provisioned.local`;
    const user = IdentityLifecycleService.joiner({
      username: payload.userName,
      email,
      nomeCompleto,
      departamento: "SCIM Provisioned",
      cargo: "SCIM Provisioned",
      tenantId: payload.tenantId,
      externalId: payload.externalId,
      executor: "scim-provisioner",
    });
    if (payload.active === false) {
      user.status = "inativo";
      user.atualizadoEm = now();
    }
    return toScimUser(user);
  }

  static scimListUsers(tenantId?: string): {
    schemas: string[];
    totalResults: number;
    Resources: ScimUser[];
  } {
    const list = IdentityLifecycleService.listUsers(tenantId).map(toScimUser);
    return { schemas: [SCIM_LIST_SCHEMA], totalResults: list.length, Resources: list };
  }

  static scimGetUser(id: string): ScimUser | undefined {
    const u = users.get(id);
    return u ? toScimUser(u) : undefined;
  }

  static scimUpdateUser(
    id: string,
    payload: {
      active?: boolean;
      name?: { formatted?: string };
      emails?: Array<{ value: string; primary?: boolean }>;
      departments?: string;
    },
  ): ScimUser {
    const user = users.get(id);
    if (!user) throw new Error(`Usuário não encontrado: ${id}`);
    const ts = now();
    if (payload.active !== undefined)
      user.status = payload.active ? "ativo" : "inativo";
    if (payload.name?.formatted) user.nomeCompleto = payload.name.formatted;
    if (payload.emails) {
      const prim = payload.emails.find((e) => e.primary)?.value ?? payload.emails[0]?.value;
      if (prim) user.email = prim;
    }
    user.atualizadoEm = ts;
    return toScimUser(user);
  }

  static scimDeleteUser(id: string): boolean {
    const user = users.get(id);
    if (!user) return false;
    const ts = now();
    user.status = "inativo";
    user.roles = [];
    user.atualizadoEm = ts;
    events.push({
      id: eventId(),
      tipo: "leaver",
      userId: id,
      executor: "scim-provisioner",
      tenantId: user.tenantId,
      payload: { via: "SCIM DELETE" },
      ts,
    });
    return true;
  }

  static _reset(): void {
    users = new Map();
    events = [];
    counter = 1;
  }
}
