import { supabase } from "../lib/supabaseClient";
import { GlobalState } from "../types";
import Logger from "../utils/logger";
const logger = Logger;

export interface ProjectMetadata {
  id: string;
  name: string;
  location: string;
  areaM2: number;
  status: "draft" | "finalized" | "audited";
  category: string;
  isArchived: boolean;
  updatedAt: string;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  label: string;
  state: GlobalState;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  projectName: string;
  projectId: string;
  userName: string;
  timestamp: string;
}

export class ProjectService {
  /**
   * Busca a lista de projetos do tenant atual.
   */
  static async listProjects(showArchived = false): Promise<ProjectMetadata[]> {
    if (!supabase) return [];

    let query = supabase
      .from("projects")
      .select("id, name, location, area_m2, status, category, is_archived, updated_at")
      .order("updated_at", { ascending: false });

    if (!showArchived) {
      query = query.eq("is_archived", false);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[ProjectService] Erro ao listar projetos", error);
      return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      name: p.name,
      location: p.location ?? "",
      areaM2: Number(p.area_m2 || 0),
      status: p.status as ProjectMetadata["status"],
      category: p.category || "Geral",
      isArchived: p.is_archived || false,
      updatedAt: p.updated_at
    }));
  }

  /**
   * Clona um projeto existente.
   */
  static async cloneProject(projetoId: string, newName?: string): Promise<string> {
    if (!supabase) throw new Error("Supabase indisponível");

    const { data: original, error: fetchErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projetoId)
      .single();

    if (fetchErr || !original) throw new Error("Projeto original não encontrado");

    const { data: cloned, error: insertErr } = await supabase
      .from("projects")
      .insert({
        ...original,
        id: undefined,
        name: newName || `${original.name} (Cópia)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;
    return cloned.id;
  }

  /**
   * Arquiva ou desarquiva um projeto.
   */
  static async setArchived(projetoId: string, isArchived: boolean): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from("projects")
      .update({ is_archived: isArchived })
      .eq("id", projetoId);

    if (error) throw error;
  }

  /**
   * Busca a atividade recente do tenant (via audit_logs).
   */
  static async getRecentActivity(): Promise<ActivityLog[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        changed_at,
        new_data,
        record_id
      `)
      .order("changed_at", { ascending: false })
      .limit(10);

    if (error) return [];

    return (data || []).map(log => {
      // Tentar extrair nome do projeto do new_data se for uma tabela de projetos
      const newDataObj = (log.new_data && typeof log.new_data === 'object' && !Array.isArray(log.new_data)) 
        ? log.new_data as Record<string, unknown> 
        : {};
      const projectName = (newDataObj.name as string) || "Ação de Sistema";
      const projectId = log.record_id || "";
      
      return {
        id: log.id,
        action: log.action === "UPDATE" ? "Edição Técnica" : log.action === "INSERT" ? "Criação" : log.action,
        projectName,
        projectId,
        userName: "Engenheiro", // Simplificado
        timestamp: log.changed_at || new Date().toISOString()
      };
    });
  }

  /**
   * Busca o estado completo de um projeto.
   */
  static async getProjectState(projetoId: string): Promise<GlobalState | null> {
    if (!supabase || !projetoId) return null;

    const { data, error } = await supabase
      .from("projects")
      .select("app_state")
      .eq("id", projetoId)
      .single();

    if (error) {
      logger.error(`[ProjectService] Erro ao carregar projeto ${projetoId}`, error);
      return null;
    }

    return data?.app_state as unknown as GlobalState;
  }

  /**
   * Salva o estado completo de um projeto.
   */
  static async saveProjectState(projetoId: string, state: GlobalState): Promise<void> {
    if (!supabase || !projetoId) return;

    const { error } = await supabase
      .from("projects")
      .update({ 
        app_state: state as unknown as import("../types/supabase").Json,
        updated_at: new Date().toISOString()
      })
      .eq("id", projetoId);

    if (error) {
      logger.error(`[ProjectService] Erro ao salvar projeto ${projetoId}`, error);
      throw error;
    }
  }

  /**
   * Cria um novo projeto (Recorte).
   */
  static async createProject(data: Partial<ProjectMetadata>, initialState: GlobalState): Promise<string> {
    if (!supabase) throw new Error("Supabase indisponível");

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        name: data.name || "Novo Projeto",
        location: data.location || "Localização não definida",
        area_m2: data.areaM2 || 0,
        status: "draft",
        app_state: initialState as unknown as import("../types/supabase").Json,
        category: data.category || "Geral"
      })
      .select("id")
      .single();

    if (error) throw error;
    return project.id;
  }

  /**
   * Cria um snapshot (Versão) do projeto.
   */
  static async createSnapshot(projetoId: string, label: string, state: GlobalState): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from("project_snapshots")
      .insert({
        project_id: projetoId,
        label,
        app_state: state as unknown as import("../types/supabase").Json
      });

    if (error) throw error;
  }

  /**
   * Lista snapshots de um projeto.
   */
  static async listSnapshots(projetoId: string): Promise<ProjectSnapshot[]> {
    if (!supabase || !projetoId) return [];

    const { data, error } = await supabase
      .from("project_snapshots")
      .select("id, project_id, label, app_state, created_at")
      .eq("project_id", projetoId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error(`[ProjectService] Erro ao listar snapshots de ${projetoId}`, error);
      return [];
    }

    return (data || []).map(s => ({
      id: s.id,
      projectId: s.project_id,
      label: s.label,
      state: s.app_state as unknown as import("../types").GlobalState,
      createdAt: s.created_at
    }));
  }

  /**
   * Busca projetos vizinhos para visualização de jurisdição (Neighborhood Awareness).
   * Utiliza RPC PostGIS para performance O(log n) via índices GIST.
   */
  static async listNeighboringProjects(
    bounds: { south: number; west: number; north: number; east: number },
    excludeProjectId?: string
  ): Promise<Array<{ id: string; name: string; polygon: Array<[number, number]> }>> {
    if (!supabase) return [];

    try {
      // Tentativa 1: Via RPC PostGIS (Performance Enterprise)
      const { data, error } = await supabase.rpc("get_neighboring_projects", {
        min_lat: bounds.south,
        max_lat: bounds.north,
        min_lng: bounds.west,
        max_lng: bounds.east,
        exclude_id: excludeProjectId && excludeProjectId !== "current-project" ? excludeProjectId : null
      });

      if (!error && data) {
        return data.map((p: any) => ({
          id: p.id,
          name: p.name,
          // Converter GeoJSON Geometry para Leaflet positions [lat, lng]
          // GeoJSON é [lng, lat], Leaflet é [lat, lng]
          polygon: p.boundary_json.coordinates[0].map((coord: any) => [coord[1], coord[0]])
        }));
      }
    } catch (e) {
      logger.warn("[ProjectService] Falha ao chamar RPC de vizinhos, tentando fallback cliente", e);
    }

    // Fallback: Filtro no cliente (Legado/Desenvolvimento)
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, app_state")
      .eq("is_archived", false)
      .neq("id", excludeProjectId || "none");

    if (error) return [];

    return (data || [])
      .filter(p => {
        const state = p.app_state as unknown as { polygon?: Array<{lat: number; lng: number}> } | null;
        return state?.polygon && state.polygon.length >= 3;
      })
      .map(p => ({
        id: p.id,
        name: p.name,
        polygon: ((p.app_state as unknown as { polygon?: Array<{lat: number; lng: number}> })?.polygon || []).map((pt: {lat: number; lng: number}) => [pt.lat, pt.lng]) as Array<[number, number]>
      }));
  }
}
