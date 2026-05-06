import type { Database, Json } from "./supabase.js";

export type DbJobRow = Database["public"]["Tables"]["jobs"]["Row"];
export type DbDxfTaskRow = Database["public"]["Tables"]["dxf_tasks"]["Row"];

export type DbJson = Json;

