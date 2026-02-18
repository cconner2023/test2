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

export type AccountRequestStatus = 'pending' | 'approved' | 'rejected'
export type AccountRequestType = 'new_account' | 'profile_change'

export type CompletionType = 'read' | 'test'
export type CompletionResult = 'GO' | 'NO_GO'

export interface Database {
  public: {
    Tables: {
      account_requests: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          middle_initial: string | null
          credential: string | null
          rank: string | null
          component: string | null
          uic: string
          status: AccountRequestStatus
          request_type: AccountRequestType
          status_check_token: string
          user_id: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          rejection_reason: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          email: string
          first_name: string
          last_name: string
          middle_initial?: string | null
          credential?: string | null
          rank?: string | null
          component?: string | null
          uic: string
          status?: AccountRequestStatus
          request_type?: AccountRequestType
          status_check_token?: string
          user_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rejection_reason?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          middle_initial?: string | null
          credential?: string | null
          rank?: string | null
          component?: string | null
          uic?: string
          status?: AccountRequestStatus
          request_type?: AccountRequestType
          status_check_token?: string
          user_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rejection_reason?: string | null
          notes?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          display_name: string | null
          first_name: string | null
          last_name: string | null
          middle_initial: string | null
          credential: string | null
          component: string | null
          rank: string | null
          uic: string | null
          roles: string[]
          clinic_id: string | null
          avatar_id: string | null
          pin_hash: string | null
          pin_salt: string | null
          notifications_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          middle_initial?: string | null
          credential?: string | null
          component?: string | null
          rank?: string | null
          uic?: string | null
          roles?: string[]
          clinic_id?: string | null
          avatar_id?: string | null
          pin_hash?: string | null
          pin_salt?: string | null
          notifications_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          middle_initial?: string | null
          credential?: string | null
          component?: string | null
          rank?: string | null
          uic?: string | null
          roles?: string[]
          clinic_id?: string | null
          avatar_id?: string | null
          pin_hash?: string | null
          pin_salt?: string | null
          notifications_enabled?: boolean
          updated_at?: string
        }
      }
      clinics: {
        Row: {
          id: string
          name: string
          uics: string[]
          additional_user_ids: string[]
          location: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          uics?: string[]
          additional_user_ids?: string[]
          location?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          uics?: string[]
          additional_user_ids?: string[]
          location?: string | null
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
          completion_type: CompletionType
          result: CompletionResult
          supervisor_id: string | null
          step_results: Json | null
          supervisor_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          training_item_id: string
          completed?: boolean
          completed_at?: string | null
          completion_type?: CompletionType
          result?: CompletionResult
          supervisor_id?: string | null
          step_results?: Json | null
          supervisor_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          training_item_id?: string
          completed?: boolean
          completed_at?: string | null
          completion_type?: CompletionType
          result?: CompletionResult
          supervisor_id?: string | null
          step_results?: Json | null
          supervisor_notes?: string | null
          updated_at?: string
        }
      }
      feedback: {
        Row: {
          id: string
          user_id: string | null
          display_name: string | null
          rating: number
          comments: string | null
          most_useful_feature: string | null
          desired_feature: string | null
          needs_improvement: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          display_name?: string | null
          rating: number
          comments?: string | null
          most_useful_feature?: string | null
          desired_feature?: string | null
          needs_improvement?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          display_name?: string | null
          rating?: number
          comments?: string | null
          most_useful_feature?: string | null
          desired_feature?: string | null
          needs_improvement?: string | null
          created_at?: string
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
    Functions: {
      approve_account_request: {
        Args: { request_id: string; admin_user_id: string; temp_password: string }
        Returns: { user_id: string; email: string; message: string }
      }
      reject_account_request: {
        Args: { request_id: string; admin_user_id: string; reason: string }
        Returns: void
      }
      submit_account_request: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_middle_initial?: string
          p_credential?: string
          p_rank?: string
          p_component?: string
          p_uic?: string
          p_notes?: string
          p_request_type?: string
        }
        Returns: { id: string; status_check_token: string; message: string }
      }
      check_request_status: {
        Args: { p_email: string; p_token: string }
        Returns: {
          found: boolean
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          status?: AccountRequestStatus
          request_type?: AccountRequestType
          requested_at?: string
          reviewed_at?: string | null
          rejection_reason?: string | null
          message?: string
        }
      }
      set_user_roles: {
        Args: { target_user_id: string; new_roles: UserRole[] }
        Returns: { user_id: string; old_roles: UserRole[]; new_roles: UserRole[]; updated_by: string }
      }
      get_clinic_by_uic: {
        Args: { lookup_uic: string }
        Returns: {
          id: string
          name: string
          uics: string[]
          location: string | null
        }[]
      }
      admin_create_user: {
        Args: {
          p_email: string
          p_temp_password: string
          p_first_name: string
          p_last_name: string
          p_middle_initial?: string
          p_credential?: string
          p_component?: string
          p_rank?: string
          p_uic?: string
          p_roles?: UserRole[]
        }
        Returns: { user_id: string; email: string; message: string }
      }
      admin_reset_password: {
        Args: { p_target_user_id: string; p_new_password: string }
        Returns: { success: boolean; user_id: string; message: string }
      }
      admin_update_profile: {
        Args: {
          p_target_user_id: string
          p_first_name?: string
          p_last_name?: string
          p_middle_initial?: string
          p_credential?: string
          p_component?: string
          p_rank?: string
          p_uic?: string
        }
        Returns: Json
      }
      admin_list_users: {
        Args: Record<string, never>
        Returns: Json
      }
      admin_delete_user: {
        Args: { p_target_user_id: string }
        Returns: { success: boolean; user_id: string; email: string; message: string }
      }
      admin_set_clinic: {
        Args: { p_target_user_id: string; p_clinic_id: string | null }
        Returns: {
          success: boolean
          user_id: string
          clinic_id: string | null
          clinic_name: string | null
          message: string
        }
      }
      get_note_author_display: {
        Args: { p_user_id: string }
        Returns: string
      }
      update_own_security_settings: {
        Args: {
          p_pin_hash?: string
          p_pin_salt?: string
          p_notifications_enabled?: boolean
        }
        Returns: void
      }
      clear_own_pin: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {
      user_role: UserRole
      sync_action: SyncAction
      sync_status: SyncStatus
    }
  }
}
