import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMaintenanceWindow,
  listMaintenanceWindows,
  getMaintenanceWindow,
  isInMaintenanceWindow,
  cancelMaintenanceWindow,
  createChangeRequest,
  getChangeRequest,
  listChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  completeChangeRequest,
  clearChangeManagementState,
} from '../services/changeManagementService';

const FUTURE_START = new Date(Date.now() + 3_600_000).toISOString();  // +1h
const FUTURE_END   = new Date(Date.now() + 7_200_000).toISOString();  // +2h
const PAST_START   = new Date(Date.now() - 7_200_000).toISOString();  // -2h
const PAST_END     = new Date(Date.now() - 3_600_000).toISOString();  // -1h
const NOW_START    = new Date(Date.now() - 600_000).toISOString();    // -10min
const NOW_END      = new Date(Date.now() + 600_000).toISOString();    // +10min

beforeEach(() => {
  clearChangeManagementState();
});

// ─── Janelas de Manutenção ────────────────────────────────────────────────

describe('createMaintenanceWindow', () => {
  it('cria janela com campos corretos', () => {
    const w = createMaintenanceWindow({
      name: 'Deploy v2.0',
      description: 'Atualização major',
      affectedSystems: ['api', 'worker'],
      startAt: FUTURE_START,
      endAt: FUTURE_END,
      createdBy: 'admin',
    });
    expect(w.id).toBeTruthy();
    expect(w.name).toBe('Deploy v2.0');
    expect(w.status).toBe('planned');
    expect(w.affectedSystems).toEqual(['api', 'worker']);
  });

  it('lança erro para nome vazio', () => {
    expect(() => createMaintenanceWindow({
      name: '',
      description: '',
      affectedSystems: [],
      startAt: FUTURE_START,
      endAt: FUTURE_END,
      createdBy: 'admin',
    })).toThrow('name é obrigatório');
  });

  it('lança erro se startAt >= endAt', () => {
    expect(() => createMaintenanceWindow({
      name: 'Janela inválida',
      description: '',
      affectedSystems: [],
      startAt: FUTURE_END,
      endAt: FUTURE_START,
      createdBy: 'admin',
    })).toThrow('startAt deve ser anterior a endAt');
  });

  it('lança erro quando startAt/endAt não são informados', () => {
    expect(() => createMaintenanceWindow({
      name: 'Sem datas',
      description: '',
      affectedSystems: [],
      startAt: '',
      endAt: '',
      createdBy: 'admin',
    })).toThrow('startAt e endAt são obrigatórios');
  });
});

describe('listMaintenanceWindows', () => {
  it('retorna lista vazia inicialmente', () => {
    expect(listMaintenanceWindows()).toEqual([]);
  });

  it('retorna janelas ordenadas por startAt', () => {
    createMaintenanceWindow({ name: 'B', description: '', affectedSystems: [], startAt: FUTURE_END, endAt: new Date(Date.now() + 10_800_000).toISOString(), createdBy: 'a' });
    createMaintenanceWindow({ name: 'A', description: '', affectedSystems: [], startAt: FUTURE_START, endAt: FUTURE_END, createdBy: 'a' });
    const list = listMaintenanceWindows();
    expect(list[0].name).toBe('A');
    expect(list[1].name).toBe('B');
  });
});

describe('getMaintenanceWindow', () => {
  it('retorna janela por id', () => {
    const w = createMaintenanceWindow({ name: 'W1', description: '', affectedSystems: [], startAt: FUTURE_START, endAt: FUTURE_END, createdBy: 'a' });
    expect(getMaintenanceWindow(w.id)).toEqual(w);
  });

  it('retorna null para id inexistente', () => {
    expect(getMaintenanceWindow('nonexistent')).toBeNull();
  });
});

describe('isInMaintenanceWindow', () => {
  it('retorna blocked=false quando não há janelas ativas', () => {
    expect(isInMaintenanceWindow()).toEqual({ blocked: false });
  });

  it('retorna blocked=false para janela futura', () => {
    createMaintenanceWindow({ name: 'Futura', description: '', affectedSystems: [], startAt: FUTURE_START, endAt: FUTURE_END, createdBy: 'a' });
    expect(isInMaintenanceWindow()).toEqual({ blocked: false });
  });

  it('retorna blocked=true para janela ativa agora', () => {
    const w = createMaintenanceWindow({ name: 'Ativa', description: '', affectedSystems: [], startAt: NOW_START, endAt: NOW_END, createdBy: 'a' });
    const result = isInMaintenanceWindow();
    expect(result.blocked).toBe(true);
    expect(result.window?.id).toBe(w.id);
  });

  it('retorna blocked=false para janela passada', () => {
    createMaintenanceWindow({ name: 'Passada', description: '', affectedSystems: [], startAt: PAST_START, endAt: PAST_END, createdBy: 'a' });
    expect(isInMaintenanceWindow()).toEqual({ blocked: false });
  });

  it('aceita atTime customizado', () => {
    createMaintenanceWindow({ name: 'Futura', description: '', affectedSystems: [], startAt: FUTURE_START, endAt: FUTURE_END, createdBy: 'a' });
    const result = isInMaintenanceWindow(new Date(Date.now() + 4_000_000).toISOString());
    expect(result.blocked).toBe(true);
  });
});

describe('cancelMaintenanceWindow', () => {
  it('cancela janela planejada', () => {
    const w = createMaintenanceWindow({ name: 'W', description: '', affectedSystems: [], startAt: FUTURE_START, endAt: FUTURE_END, createdBy: 'a' });
    expect(cancelMaintenanceWindow(w.id)).toBe(true);
    expect(getMaintenanceWindow(w.id)?.status).toBe('cancelled');
  });

  it('retorna false para id inexistente', () => {
    expect(cancelMaintenanceWindow('nope')).toBe(false);
  });

  it('retorna false para janela concluída', () => {
    const w = createMaintenanceWindow({ name: 'W2', description: '', affectedSystems: [], startAt: FUTURE_START, endAt: FUTURE_END, createdBy: 'a' });
    const ref = getMaintenanceWindow(w.id);
    expect(ref).not.toBeNull();
    (ref as any).status = 'completed';
    expect(cancelMaintenanceWindow(w.id)).toBe(false);
  });
});

// ─── Requisições de Mudança ────────────────────────────────────────────────

function makeChange(overrides: Partial<Parameters<typeof createChangeRequest>[0]> = {}) {
  return createChangeRequest({
    title: 'Deploy API v2',
    description: 'Atualização de dependências',
    type: 'planned',
    requestedBy: 'dev-user',
    justification: 'Correção de vulnerabilidades',
    rollbackPlan: 'git revert HEAD',
    ...overrides,
  });
}

describe('createChangeRequest', () => {
  it('cria requisição com status pending', () => {
    const c = makeChange();
    expect(c.id).toBeTruthy();
    expect(c.status).toBe('pending');
    expect(c.type).toBe('planned');
  });

  it('lança erro para título vazio', () => {
    expect(() => makeChange({ title: '' })).toThrow('title é obrigatório');
  });

  it('lança erro para justificativa vazia', () => {
    expect(() => makeChange({ justification: '' })).toThrow('justification é obrigatório');
  });

  it('lança erro para requestedBy vazio', () => {
    expect(() => makeChange({ requestedBy: '' })).toThrow('requestedBy é obrigatório');
  });

  it('lança erro para plano de rollback vazio', () => {
    expect(() => makeChange({ rollbackPlan: '' })).toThrow('rollbackPlan é obrigatório');
  });

  it('lança erro para maintenanceWindowId inválido', () => {
    expect(() => makeChange({ maintenanceWindowId: 'inexistente' })).toThrow('maintenanceWindowId inválido');
  });

  it('aceita maintenanceWindowId válido', () => {
    const w = createMaintenanceWindow({ name: 'W', description: '', affectedSystems: [], startAt: FUTURE_START, endAt: FUTURE_END, createdBy: 'a' });
    const c = makeChange({ maintenanceWindowId: w.id });
    expect(c.maintenanceWindowId).toBe(w.id);
  });
});

describe('getChangeRequest', () => {
  it('retorna requisição por id', () => {
    const c = makeChange();
    expect(getChangeRequest(c.id)).toEqual(c);
  });

  it('retorna null para id inexistente', () => {
    expect(getChangeRequest('nope')).toBeNull();
  });
});

describe('listChangeRequests', () => {
  it('retorna lista vazia inicialmente', () => {
    expect(listChangeRequests()).toEqual([]);
  });

  it('filtra por status', () => {
    const c1 = makeChange({ title: 'C1' });
    approveChangeRequest(c1.id, 'manager');
    makeChange({ title: 'C2' });
    expect(listChangeRequests('approved')).toHaveLength(1);
    expect(listChangeRequests('pending')).toHaveLength(1);
  });
});

describe('approveChangeRequest', () => {
  it('aprova requisição pendente', () => {
    const c = makeChange();
    const approved = approveChangeRequest(c.id, 'manager');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('manager');
  });

  it('lança erro para id inexistente', () => {
    expect(() => approveChangeRequest('nope', 'manager')).toThrow('não encontrada');
  });

  it('lança erro para requisição já aprovada', () => {
    const c = makeChange();
    approveChangeRequest(c.id, 'manager');
    expect(() => approveChangeRequest(c.id, 'manager')).toThrow('status');
  });

  it('lança erro para approvedBy vazio', () => {
    const c = makeChange();
    expect(() => approveChangeRequest(c.id, '   ')).toThrow('approvedBy é obrigatório');
  });
});

describe('rejectChangeRequest', () => {
  it('rejeita requisição pendente', () => {
    const c = makeChange();
    const rejected = rejectChangeRequest(c.id, 'manager');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectedBy).toBe('manager');
  });

  it('lança erro para requisição já rejeitada', () => {
    const c = makeChange();
    rejectChangeRequest(c.id, 'manager');
    expect(() => rejectChangeRequest(c.id, 'manager')).toThrow('status');
  });

  it('lança erro para rejectedBy vazio', () => {
    const c = makeChange();
    expect(() => rejectChangeRequest(c.id, '')).toThrow('rejectedBy é obrigatório');
  });
});

describe('completeChangeRequest', () => {
  it('conclui requisição aprovada', () => {
    const c = makeChange();
    approveChangeRequest(c.id, 'manager');
    const completed = completeChangeRequest(c.id);
    expect(completed.status).toBe('completed');
  });

  it('lança erro para requisição pendente', () => {
    const c = makeChange();
    expect(() => completeChangeRequest(c.id)).toThrow('aprovadas');
  });

  it('lança erro para requisição inexistente', () => {
    expect(() => completeChangeRequest('nao-existe')).toThrow('não encontrada');
  });
});
