/**
 * Database types for Supabase PostgreSQL schema.
 * These types correspond to the tables defined in app_spec.txt.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'medic' | 'supervisor' | 'dev'
export type SyncAction = 'create' | 'update' | 'delete'
export type SyncStatus = 'pending' | 'synced' | 'failed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          rank: string | null
          uic: string | null
          role: UserRole
          clinic_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          rank?: string | null
          uic?: string | null
          role?: UserRole
          clinic_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          rank?: string | null
          uic?: string | null
          role?: UserRole
          clinic_id?: string | null
          updated_at?: string
        }
      }
      clinics: {
        Row: {
          id: string
          name: string
          uic: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          uic: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          uic?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          user_id: string
          clinic_id: string | null
          timestamp: string
          display_name: string | null
          rank: string | null
          uic: string | null
          algorithm_reference: string | null
          hpi_encoded: string | null
          symptom_icon: string | null
          symptom_text: string | null
          disposition_type: string | null
          disposition_text: string | null
          preview_text: string | null
          is_imported: boolean
          source_device: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          clinic_id?: string | null
          timestamp?: string
          display_name?: string | null
          rank?: string | null
          uic?: string | null
          algorithm_reference?: string | null
          hpi_encoded?: string | null
          symptom_icon?: string | null
          symptom_text?: string | null
          disposition_type?: string | null
          disposition_text?: string | null
          preview_text?: string | null
          is_imported?: boolean
          source_device?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          user_id?: string
          clinic_id?: string | null
          timestamp?: string
          display_name?: string | null
          rank?: string | null
          uic?: string | null
          algorithm_reference?: string | null
          hpi_encoded?: string | null
          symptom_icon?: string | null
          symptom_text?: string | null
          disposition_type?: string | null
          disposition_text?: string | null
          preview_text?: string | null
          is_imported?: boolean
          source_device?: string | null
          updated_at?: string
          deleted_at?: string | null
        }
      }
      training_completions: {
        Row: {
          id: string
          user_id: string
          training_item_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          training_item_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          training_item_id?: string
          completed?: boolean
          completed_at?: string | null
          updated_at?: string
        }
      }
      sync_queue: {
        Row: {
          id: string
          user_id: string
          action: SyncAction
          table_name: string
          record_id: string
          payload: Json
          created_at: string
          synced_at: string | null
          status: SyncStatus
        }
        Insert: {
          id?: string
          user_id: string
          action: SyncAction
          table_name: string
          record_id: string
          payload: Json
          created_at?: string
          synced_at?: string | null
          status?: SyncStatus
        }
        Update: {
          action?: SyncAction
          table_name?: string
          record_id?: string
          payload?: Json
          synced_at?: string | null
          status?: SyncStatus
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      sync_action: SyncAction
      sync_status: SyncStatus
    }
  }
}
