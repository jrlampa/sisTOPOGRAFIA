export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _migrations: {
        Row: {
          applied_at: string
          filename: string
        }
        Insert: {
          applied_at?: string
          filename: string
        }
        Update: {
          applied_at?: string
          filename?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          device_fingerprint: string | null
          geo_country: string | null
          geo_region: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          session_id: string | null
          table_name: string
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          device_fingerprint?: string | null
          geo_country?: string | null
          geo_region?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          session_id?: string | null
          table_name: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          device_fingerprint?: string | null
          geo_country?: string | null
          geo_region?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          session_id?: string | null
          table_name?: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      audit_logs_2025_05: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2025_06: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2025_07: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2025_08: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2025_09: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2025_10: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2025_11: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2025_12: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2026_01: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2026_02: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2026_03: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_2026_04: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_partitioned: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      bt_export_history: {
        Row: {
          bt_context_url: string
          cqt_dmdi: number | null
          cqt_k10_qt_mttr: number | null
          cqt_p31: number | null
          cqt_p32: number | null
          cqt_parity_failed: number | null
          cqt_parity_passed: number | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number
          critical_accumulated_demand_kva: number
          critical_pole_id: string
          deleted_at: string | null
          id: number
          metadata: Json
          project_type: string
          tenant_id: string | null
          total_edges: number | null
          total_poles: number | null
          total_transformers: number | null
          verified_edges: number | null
          verified_poles: number | null
          verified_transformers: number | null
        }
        Insert: {
          bt_context_url: string
          cqt_dmdi?: number | null
          cqt_k10_qt_mttr?: number | null
          cqt_p31?: number | null
          cqt_p32?: number | null
          cqt_parity_failed?: number | null
          cqt_parity_passed?: number | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients: number
          critical_accumulated_demand_kva: number
          critical_pole_id: string
          deleted_at?: string | null
          id?: number
          metadata?: Json
          project_type: string
          tenant_id?: string | null
          total_edges?: number | null
          total_poles?: number | null
          total_transformers?: number | null
          verified_edges?: number | null
          verified_poles?: number | null
          verified_transformers?: number | null
        }
        Update: {
          bt_context_url?: string
          cqt_dmdi?: number | null
          cqt_k10_qt_mttr?: number | null
          cqt_p31?: number | null
          cqt_p32?: number | null
          cqt_parity_failed?: number | null
          cqt_parity_passed?: number | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number
          critical_accumulated_demand_kva?: number
          critical_pole_id?: string
          deleted_at?: string | null
          id?: number
          metadata?: Json
          project_type?: string
          tenant_id?: string | null
          total_edges?: number | null
          total_poles?: number | null
          total_transformers?: number | null
          verified_edges?: number | null
          verified_poles?: number | null
          verified_transformers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bt_export_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bt_export_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      bt_export_history_2025_05: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2025_06: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2025_07: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2025_08: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2025_09: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2025_10: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2025_11: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2025_12: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2026_01: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2026_02: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2026_03: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_2026_04: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bt_export_history_partitioned: {
        Row: {
          bt_context_url: string | null
          cqt_parity_status: string | null
          cqt_scenario: string | null
          created_at: string
          critical_accumulated_clients: number | null
          critical_accumulated_demand_kva: number | null
          critical_pole_id: string
          critical_pole_name: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          project_type: string | null
          user_id: string | null
        }
        Insert: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Update: {
          bt_context_url?: string | null
          cqt_parity_status?: string | null
          cqt_scenario?: string | null
          created_at?: string
          critical_accumulated_clients?: number | null
          critical_accumulated_demand_kva?: number | null
          critical_pole_id?: string
          critical_pole_name?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          project_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bt_export_history_partitioned_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      canonical_edges: {
        Row: {
          bt_conductors: Json | null
          bt_replacement_conductors: Json | null
          cqt_length_meters: number | null
          created_at: string
          edge_change_flag: string | null
          from_pole_id: string
          id: string
          length_meters: number | null
          mt_conductors: Json | null
          pk: number
          remove_on_execution: boolean
          source: string
          to_pole_id: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          bt_conductors?: Json | null
          bt_replacement_conductors?: Json | null
          cqt_length_meters?: number | null
          created_at?: string
          edge_change_flag?: string | null
          from_pole_id: string
          id: string
          length_meters?: number | null
          mt_conductors?: Json | null
          pk?: number
          remove_on_execution?: boolean
          source?: string
          to_pole_id: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          bt_conductors?: Json | null
          bt_replacement_conductors?: Json | null
          cqt_length_meters?: number | null
          created_at?: string
          edge_change_flag?: string | null
          from_pole_id?: string
          id?: string
          length_meters?: number | null
          mt_conductors?: Json | null
          pk?: number
          remove_on_execution?: boolean
          source?: string
          to_pole_id?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      canonical_poles: {
        Row: {
          bt_structures: Json | null
          circuit_break_point: boolean
          condition_status: string | null
          created_at: string
          equipment_notes: string | null
          general_notes: string | null
          has_bt: boolean
          has_mt: boolean
          id: string
          lat: number
          lng: number
          mt_structures: Json | null
          node_change_flag: string | null
          pk: number
          pole_spec: Json | null
          ramais: Json | null
          source: string
          title: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          bt_structures?: Json | null
          circuit_break_point?: boolean
          condition_status?: string | null
          created_at?: string
          equipment_notes?: string | null
          general_notes?: string | null
          has_bt?: boolean
          has_mt?: boolean
          id: string
          lat: number
          lng: number
          mt_structures?: Json | null
          node_change_flag?: string | null
          pk?: number
          pole_spec?: Json | null
          ramais?: Json | null
          source?: string
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          bt_structures?: Json | null
          circuit_break_point?: boolean
          condition_status?: string | null
          created_at?: string
          equipment_notes?: string | null
          general_notes?: string | null
          has_bt?: boolean
          has_mt?: boolean
          id?: string
          lat?: number
          lng?: number
          mt_structures?: Json | null
          node_change_flag?: string | null
          pk?: number
          pole_spec?: Json | null
          ramais?: Json | null
          source?: string
          title?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      constants_catalog: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          environment: string
          id: number
          is_active: boolean
          key: string
          namespace: string
          updated_at: string
          value: Json
          version_hash: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          environment?: string
          id?: number
          is_active?: boolean
          key: string
          namespace: string
          updated_at?: string
          value: Json
          version_hash: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          environment?: string
          id?: number
          is_active?: boolean
          key?: string
          namespace?: string
          updated_at?: string
          value?: Json
          version_hash?: string
        }
        Relationships: []
      }
      constants_catalog_history: {
        Row: {
          catalog_id: number
          changed_at: string
          changed_by: string | null
          environment: string
          id: number
          key: string
          namespace: string
          value: Json
          version_hash: string
        }
        Insert: {
          catalog_id: number
          changed_at?: string
          changed_by?: string | null
          environment: string
          id?: number
          key: string
          namespace: string
          value: Json
          version_hash: string
        }
        Update: {
          catalog_id?: number
          changed_at?: string
          changed_by?: string | null
          environment?: string
          id?: number
          key?: string
          namespace?: string
          value?: Json
          version_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_history_catalog_id"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "constants_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_history_catalog_id"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "v_constants_catalog_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      constants_catalog_snapshots: {
        Row: {
          actor: string
          created_at: string
          data: Json
          deleted_at: string | null
          entry_count: number
          id: number
          label: string | null
          namespace: string
        }
        Insert: {
          actor?: string
          created_at?: string
          data: Json
          deleted_at?: string | null
          entry_count: number
          id?: number
          label?: string | null
          namespace: string
        }
        Update: {
          actor?: string
          created_at?: string
          data?: Json
          deleted_at?: string | null
          entry_count?: number
          id?: number
          label?: string | null
          namespace?: string
        }
        Relationships: []
      }
      constants_refresh_events: {
        Row: {
          actor: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          error_message: string | null
          http_status: number
          id: number
          namespaces: string[]
          success: boolean
        }
        Insert: {
          actor: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          http_status: number
          id?: number
          namespaces: string[]
          success: boolean
        }
        Update: {
          actor?: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number
          id?: number
          namespaces?: string[]
          success?: boolean
        }
        Relationships: []
      }
      dg_candidates: {
        Row: {
          candidate_id: string
          created_at: string
          geom_point: unknown
          position_latlon_json: Json
          position_utm_json: Json
          run_id: string
          source: string | null
          tenant_id: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          geom_point?: unknown
          position_latlon_json: Json
          position_utm_json: Json
          run_id: string
          source?: string | null
          tenant_id?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          geom_point?: unknown
          position_latlon_json?: Json
          position_utm_json?: Json
          run_id?: string
          source?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dg_candidates_run"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "dg_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      dg_constraints: {
        Row: {
          code: string
          created_at: string
          detail: string
          entity_id: string | null
          id: number
          ordinal: number
          run_id: string
          scenario_id: string
          tenant_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          detail: string
          entity_id?: string | null
          id?: number
          ordinal: number
          run_id: string
          scenario_id: string
          tenant_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          detail?: string
          entity_id?: string | null
          id?: number
          ordinal?: number
          run_id?: string
          scenario_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dg_constraints_scenario"
            columns: ["run_id", "scenario_id"]
            isOneToOne: false
            referencedRelation: "dg_run_ranking_v"
            referencedColumns: ["run_id", "scenario_id"]
          },
          {
            foreignKeyName: "fk_dg_constraints_scenario"
            columns: ["run_id", "scenario_id"]
            isOneToOne: false
            referencedRelation: "dg_scenarios"
            referencedColumns: ["run_id", "scenario_id"]
          },
        ]
      }
      dg_recommendations: {
        Row: {
          created_at: string
          id: number
          kind: string
          objective_score: number | null
          rank_order: number
          recommendation_json: Json
          run_id: string
          scenario_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          kind: string
          objective_score?: number | null
          rank_order: number
          recommendation_json: Json
          run_id: string
          scenario_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          kind?: string
          objective_score?: number | null
          rank_order?: number
          recommendation_json?: Json
          run_id?: string
          scenario_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dg_recommendations_run"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "dg_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      dg_runs: {
        Row: {
          computed_at: string
          created_at: string
          input_hash: string
          output_json: Json
          params_json: Json
          recommendation_json: Json | null
          run_id: string
          scenarios_json: Json
          tenant_id: string | null
          total_candidates_evaluated: number
          total_feasible: number
          updated_at: string
        }
        Insert: {
          computed_at: string
          created_at?: string
          input_hash: string
          output_json: Json
          params_json: Json
          recommendation_json?: Json | null
          run_id: string
          scenarios_json: Json
          tenant_id?: string | null
          total_candidates_evaluated: number
          total_feasible: number
          updated_at?: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          input_hash?: string
          output_json?: Json
          params_json?: Json
          recommendation_json?: Json | null
          run_id?: string
          scenarios_json?: Json
          tenant_id?: string | null
          total_candidates_evaluated?: number
          total_feasible?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dg_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dg_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      dg_scenarios: {
        Row: {
          candidate_id: string | null
          created_at: string
          electrical_json: Json
          feasible: boolean
          geom_trafo: unknown
          objective_score: number
          run_id: string
          scenario_id: string
          scenario_json: Json
          score_components_json: Json
          tenant_id: string | null
          violations_count: number
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          electrical_json: Json
          feasible: boolean
          geom_trafo?: unknown
          objective_score: number
          run_id: string
          scenario_id: string
          scenario_json: Json
          score_components_json: Json
          tenant_id?: string | null
          violations_count?: number
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          electrical_json?: Json
          feasible?: boolean
          geom_trafo?: unknown
          objective_score?: number
          run_id?: string
          scenario_id?: string
          scenario_json?: Json
          score_components_json?: Json
          tenant_id?: string | null
          violations_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_dg_scenarios_run"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "dg_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      dxf_tasks: {
        Row: {
          artifact_sha256: string | null
          attempts: number
          created_at: string
          deleted_at: string | null
          error: string | null
          finished_at: string | null
          id: number
          idempotency_key: string | null
          payload: Json
          started_at: string | null
          status: string
          task_id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          artifact_sha256?: string | null
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: number
          idempotency_key?: string | null
          payload: Json
          started_at?: string | null
          status?: string
          task_id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          artifact_sha256?: string | null
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: number
          idempotency_key?: string | null
          payload?: Json
          started_at?: string | null
          status?: string
          task_id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dxf_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dxf_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      dxf_tasks_2025_05: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2025_06: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2025_07: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2025_08: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2025_09: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2025_10: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2025_11: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2025_12: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2026_01: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2026_02: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2026_03: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_2026_04: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dxf_tasks_partitioned: {
        Row: {
          created_at: string
          deleted_at: string | null
          error_details: Json | null
          file_path: string | null
          id: string
          job_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          error_details?: Json | null
          file_path?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs: {
        Row: {
          artifact_sha256: string | null
          attempts: number
          created_at: string
          deleted_at: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          progress: number
          result: Json | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          artifact_sha256?: string | null
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          progress?: number
          result?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          artifact_sha256?: string | null
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          progress?: number
          result?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      jobs_2025_05: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2025_06: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2025_07: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2025_08: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2025_09: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2025_10: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2025_11: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2025_12: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2026_01: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2026_02: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2026_03: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_2026_04: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      jobs_partitioned: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          result: Json | null
          started_at: string | null
          status: string
          trigger_source: string | null
          trigger_value: Json | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_source?: string | null
          trigger_value?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lgpd_consent_records: {
        Row: {
          activity_name: string
          consent_version: string
          consented: boolean
          created_at: string
          id: string
          ip_address: string | null
          revocation_reason: string | null
          revoked_at: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          activity_name: string
          consent_version?: string
          consented: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          activity_name?: string
          consent_version?: string
          consented?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_consent_records_activity_name_fkey"
            columns: ["activity_name"]
            isOneToOne: false
            referencedRelation: "lgpd_processing_activities"
            referencedColumns: ["activity_name"]
          },
          {
            foreignKeyName: "lgpd_consent_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_consent_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      lgpd_data_lifecycle: {
        Row: {
          created_at: string
          data_category: string
          deleted_at: string | null
          deletion_policy: string
          id: string
          legal_basis: Database["public"]["Enums"]["lgpd_legal_basis"]
          notes: string | null
          responsible_team: string | null
          retention_period: string
          review_due_date: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_category: string
          deleted_at?: string | null
          deletion_policy: string
          id?: string
          legal_basis: Database["public"]["Enums"]["lgpd_legal_basis"]
          notes?: string | null
          responsible_team?: string | null
          retention_period: string
          review_due_date?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_category?: string
          deleted_at?: string | null
          deletion_policy?: string
          id?: string
          legal_basis?: Database["public"]["Enums"]["lgpd_legal_basis"]
          notes?: string | null
          responsible_team?: string | null
          retention_period?: string
          review_due_date?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_data_lifecycle_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_data_lifecycle_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      lgpd_processing_activities: {
        Row: {
          activity_name: string
          created_at: string
          data_types: string[]
          id: string
          is_active: boolean
          legal_basis: Database["public"]["Enums"]["lgpd_legal_basis"]
          purpose: string
          retention_days: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          activity_name: string
          created_at?: string
          data_types?: string[]
          id?: string
          is_active?: boolean
          legal_basis: Database["public"]["Enums"]["lgpd_legal_basis"]
          purpose: string
          retention_days?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_name?: string
          created_at?: string
          data_types?: string[]
          id?: string
          is_active?: boolean
          legal_basis?: Database["public"]["Enums"]["lgpd_legal_basis"]
          purpose?: string
          retention_days?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_processing_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_processing_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      lgpd_rights_requests: {
        Row: {
          created_at: string
          deadline_at: string
          description: string | null
          fulfilled_at: string | null
          handled_by: string | null
          id: string
          request_type: Database["public"]["Enums"]["lgpd_rights_request_type"]
          response_notes: string | null
          status: Database["public"]["Enums"]["lgpd_request_status"]
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline_at?: string
          description?: string | null
          fulfilled_at?: string | null
          handled_by?: string | null
          id?: string
          request_type: Database["public"]["Enums"]["lgpd_rights_request_type"]
          response_notes?: string | null
          status?: Database["public"]["Enums"]["lgpd_request_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline_at?: string
          description?: string | null
          fulfilled_at?: string | null
          handled_by?: string | null
          id?: string
          request_type?: Database["public"]["Enums"]["lgpd_rights_request_type"]
          response_notes?: string | null
          status?: Database["public"]["Enums"]["lgpd_request_status"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_rights_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_rights_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      lgpd_security_incidents: {
        Row: {
          affected_users_count: number | null
          anpd_notified_at: string | null
          anpd_protocol: string | null
          contained_at: string | null
          created_at: string
          data_types_affected: string[] | null
          description: string
          detected_at: string
          id: string
          remediation_steps: string | null
          reported_by: string | null
          severity: Database["public"]["Enums"]["lgpd_incident_severity"]
          tenant_id: string | null
          title: string
        }
        Insert: {
          affected_users_count?: number | null
          anpd_notified_at?: string | null
          anpd_protocol?: string | null
          contained_at?: string | null
          created_at?: string
          data_types_affected?: string[] | null
          description: string
          detected_at?: string
          id?: string
          remediation_steps?: string | null
          reported_by?: string | null
          severity: Database["public"]["Enums"]["lgpd_incident_severity"]
          tenant_id?: string | null
          title: string
        }
        Update: {
          affected_users_count?: number | null
          anpd_notified_at?: string | null
          anpd_protocol?: string | null
          contained_at?: string | null
          created_at?: string
          data_types_affected?: string[] | null
          description?: string
          detected_at?: string
          id?: string
          remediation_steps?: string | null
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["lgpd_incident_severity"]
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_security_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_security_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_service_profiles: {
        Row: {
          created_at: string
          escalation_policy: Json
          id: string
          is_active: boolean
          metadata: Json
          service_code: string
          service_name: string
          sla_availability_pct: number
          slo_latency_p95_ms: number
          support_channel: string
          support_hours: string
          tenant_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          escalation_policy?: Json
          id?: string
          is_active?: boolean
          metadata?: Json
          service_code: string
          service_name: string
          sla_availability_pct: number
          slo_latency_p95_ms: number
          support_channel: string
          support_hours: string
          tenant_id: string
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          escalation_policy?: Json
          id?: string
          is_active?: boolean
          metadata?: Json
          service_code?: string
          service_name?: string
          sla_availability_pct?: number
          slo_latency_p95_ms?: number
          support_channel?: string
          support_hours?: string
          tenant_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_service_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_service_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          plan: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          plan?: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          deleted_at: string | null
          last_updated: string
          reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          deleted_at?: string | null
          last_updated?: string
          reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          deleted_at?: string | null
          last_updated?: string
          reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      user_roles_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: number
          new_role: Database["public"]["Enums"]["user_role"]
          old_role: Database["public"]["Enums"]["user_role"] | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: number
          new_role: Database["public"]["Enums"]["user_role"]
          old_role?: Database["public"]["Enums"]["user_role"] | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: number
          new_role?: Database["public"]["Enums"]["user_role"]
          old_role?: Database["public"]["Enums"]["user_role"] | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      // ── Tabelas das migrações 065-068 (T3-134/T3-136) ────────────────────────
      // NOTA: Regenerar via `supabase gen types` após aplicar ao Supabase Cloud.
      collaboration_sessions: {
        Row: {
          id: string
          tenant_id: string | null
          projeto_id: string
          nome_projeto: string
          responsavel_id: string | null
          status: string
          versao_atual: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          projeto_id: string
          nome_projeto: string
          responsavel_id?: string | null
          status?: string
          versao_atual?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          projeto_id?: string
          nome_projeto?: string
          responsavel_id?: string | null
          status?: string
          versao_atual?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      collaboration_history: {
        Row: {
          id: string
          sessao_id: string
          usuario_id: string | null
          tipo_operacao: string
          payload: Json
          versao_base: number
          versao_resultante: number
          conflito: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sessao_id: string
          usuario_id?: string | null
          tipo_operacao: string
          payload: Json
          versao_base: number
          versao_resultante: number
          conflito?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sessao_id?: string
          usuario_id?: string | null
          tipo_operacao?: string
          payload?: Json
          versao_base?: number
          versao_resultante?: number
          conflito?: boolean
          created_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          location: string | null
          area_m2: number | null
          status: string
          category: string | null
          is_archived: boolean | null
          app_state: Json
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          location?: string | null
          area_m2?: number | null
          status?: string
          category?: string | null
          is_archived?: boolean | null
          app_state: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          location?: string | null
          area_m2?: number | null
          status?: string
          category?: string | null
          is_archived?: boolean | null
          app_state?: Json
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      project_snapshots: {
        Row: {
          id: string
          project_id: string
          label: string
          app_state: Json
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          label: string
          app_state: Json
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          label?: string
          app_state?: Json
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      dg_discard_rate_by_constraint_v: {
        Row: {
          code: string | null
          discard_rate_percent: number | null
          discarded_scenarios: number | null
          run_id: string | null
          tenant_id: string | null
          total_scenarios: number | null
        }
        Relationships: []
      }
      dg_run_ranking_v: {
        Row: {
          created_at: string | null
          feasible: boolean | null
          objective_score: number | null
          rank_in_run: number | null
          run_id: string | null
          scenario_id: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dg_scenarios_run"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "dg_runs"
            referencedColumns: ["run_id"]
          },
        ]
      }
      mv_audit_stats: {
        Row: {
          action: string | null
          event_count: number | null
          first_event: string | null
          last_event: string | null
          last_event_day: string | null
          table_name: string | null
          unique_users: number | null
        }
        Relationships: []
      }
      mv_bt_history_daily_summary: {
        Row: {
          avg_critical_clients: number | null
          avg_demand_kva: number | null
          day_local: string | null
          export_count: number | null
          max_critical_clients: number | null
          max_demand_kva: number | null
          parity_fail_count: number | null
          parity_pass_count: number | null
          project_type: string | null
        }
        Relationships: []
      }
      mv_constants_namespace_summary: {
        Row: {
          active_entries: number | null
          last_updated_at: string | null
          namespace: string | null
          soft_deleted: number | null
          total_entries: number | null
        }
        Relationships: []
      }
      v_audit_siem_export: {
        Row: {
          actor_device: string | null
          actor_geo_country: string | null
          actor_geo_region: string | null
          actor_ip: string | null
          actor_session_id: string | null
          actor_user_agent: string | null
          actor_user_id: string | null
          cef_message: string | null
          data_after: Json | null
          data_before: Json | null
          event_action: string | null
          event_id: string | null
          event_time: string | null
          resource_id: string | null
          resource_type: string | null
          tenant_id: string | null
          tenant_name: string | null
        }
        Relationships: []
      }
      v_audit_summary: {
        Row: {
          action: string | null
          audit_date: string | null
          event_count: number | null
          table_name: string | null
          unique_actors: number | null
        }
        Relationships: []
      }
      v_canonical_consistency_report: {
        Row: {
          canonical_bt_edges: number | null
          canonical_bt_poles: number | null
          canonical_merged_poles: number | null
          canonical_mt_edges: number | null
          canonical_mt_poles: number | null
          canonical_new_edges: number | null
          canonical_new_poles: number | null
          delta_bt_edges: number | null
          delta_bt_poles: number | null
          delta_mt_edges: number | null
          delta_mt_poles: number | null
          legacy_bt_edges_unique: number | null
          legacy_bt_poles_unique: number | null
          legacy_mt_edges_unique: number | null
          legacy_mt_poles_unique: number | null
          report_at: string | null
        }
        Relationships: []
      }
      v_constants_catalog_latest: {
        Row: {
          created_at: string | null
          description: string | null
          environment: string | null
          id: number | null
          is_active: boolean | null
          key: string | null
          namespace: string | null
          updated_at: string | null
          value: Json | null
          version_hash: string | null
        }
        Relationships: []
      }
      v_constants_refresh_ns_frequency: {
        Row: {
          ns: string | null
          refresh_count: number | null
        }
        Relationships: []
      }
      v_constants_refresh_stats: {
        Row: {
          avg_duration_ms: number | null
          failure_count: number | null
          first_refresh_at: string | null
          last_success_at: string | null
          max_duration_ms: number | null
          min_success_duration_ms: number | null
          success_count: number | null
          total_count: number | null
        }
        Relationships: []
      }
      v_constants_refresh_top_actors: {
        Row: {
          actor: string | null
          last_seen_at: string | null
          refresh_count: number | null
          success_count: number | null
        }
        Relationships: []
      }
      v_lgpd_compliance_dashboard: {
        Row: {
          description: string | null
          metric: string | null
          value: string | null
        }
        Relationships: []
      }
      v_lgpd_retention_due: {
        Row: {
          created_at: string | null
          data_category: string | null
          deletion_policy: string | null
          id: string | null
          legal_basis: Database["public"]["Enums"]["lgpd_legal_basis"] | null
          responsible_team: string | null
          retention_period: string | null
          review_due_date: string | null
          review_status: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_category?: string | null
          deletion_policy?: string | null
          id?: string | null
          legal_basis?: Database["public"]["Enums"]["lgpd_legal_basis"] | null
          responsible_team?: string | null
          retention_period?: string | null
          review_due_date?: string | null
          review_status?: never
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_category?: string | null
          deletion_policy?: string | null
          id?: string | null
          legal_basis?: Database["public"]["Enums"]["lgpd_legal_basis"] | null
          responsible_team?: string | null
          retention_period?: string | null
          review_due_date?: string | null
          review_status?: never
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_data_lifecycle_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_data_lifecycle_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_tenant_usage_summary"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_soft_deleted_summary: {
        Row: {
          deleted_count: number | null
          last_deleted_at: string | null
          table_name: string | null
        }
        Relationships: []
      }
      v_tenant_usage_summary: {
        Row: {
          active_jobs: number | null
          completed_jobs: number | null
          failed_jobs: number | null
          last_activity_at: string | null
          plan: string | null
          tenant_id: string | null
          tenant_name: string | null
          tenant_slug: string | null
          total_bt_exports: number | null
        }
        Relationships: []
      }
      v_user_roles_summary: {
        Row: {
          assigned_by_count: number | null
          earliest_assignment: string | null
          latest_update: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          user_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      find_or_claim_job: {
        Args: {
          p_idempotency_key: string
          p_job_id: string
          p_status?: string
          p_user_id?: string
        }
        Returns: {
          job_id: string
          was_created: boolean
        }[]
      }
      fn_backfill_canonical_edges_bt: { Args: never; Returns: number }
      fn_backfill_canonical_edges_mt: { Args: never; Returns: number }
      fn_backfill_canonical_poles_bt: { Args: never; Returns: number }
      fn_backfill_canonical_poles_mt: { Args: never; Returns: number }
      fn_validate_canonical_consistency: { Args: never; Returns: boolean }
      lgpd_schedule_data_deletion: {
        Args: { p_reason?: string; p_user_id: string }
        Returns: Json
      }
      verify_backup_integrity: {
        Args: { p_backup_id?: string }
        Returns: {
          check_name: string
          detail: string
          status: string
        }[]
      }
      get_neighboring_projects: {
        Args: {
          min_lat: number
          max_lat: number
          min_lng: number
          max_lng: number
          exclude_id?: string | null
        }
        Returns: {
          id: string
          name: string
          boundary_json: Json
        }[]
      }
    }
    Enums: {
      lgpd_incident_severity: "low" | "medium" | "high" | "critical"
      lgpd_legal_basis:
        | "consent"
        | "legal_obligation"
        | "legitimate_interest"
        | "contract_execution"
        | "vital_interests"
        | "public_policy"
      lgpd_request_status:
        | "received"
        | "under_review"
        | "fulfilled"
        | "rejected"
        | "partial"
      lgpd_rights_request_type:
        | "access"
        | "correction"
        | "anonymization"
        | "portability"
        | "deletion"
        | "opt_out"
        | "information"
      user_role: "admin" | "technician" | "viewer" | "guest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      lgpd_incident_severity: ["low", "medium", "high", "critical"],
      lgpd_legal_basis: [
        "consent",
        "legal_obligation",
        "legitimate_interest",
        "contract_execution",
        "vital_interests",
        "public_policy",
      ],
      lgpd_request_status: [
        "received",
        "under_review",
        "fulfilled",
        "rejected",
        "partial",
      ],
      lgpd_rights_request_type: [
        "access",
        "correction",
        "anonymization",
        "portability",
        "deletion",
        "opt_out",
        "information",
      ],
      user_role: ["admin", "technician", "viewer", "guest"],
    },
  },
} as const
