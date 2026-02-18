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
          status: "pending" | "approved" | "rejected"
          request_type: "new_account" | "profile_change"
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
          status?: "pending" | "approved" | "rejected"
          request_type?: "new_account" | "profile_change"
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
          status?: "pending" | "approved" | "rejected"
          request_type?: "new_account" | "profile_change"
          status_check_token?: string
          user_id?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          rejection_reason?: string | null
          notes?: string | null
        }
        Relationships: []
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
          id?: string
          name?: string
          uics?: string[]
          additional_user_ids?: string[]
          location?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          algorithm_reference: string | null
          clinic_id: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          disposition_text: string | null
          disposition_type: string | null
          hpi_encoded: string | null
          id: string
          is_imported: boolean
          preview_text: string | null
          rank: string | null
          source_device: string | null
          symptom_icon: string | null
          symptom_text: string | null
          timestamp: string
          uic: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          algorithm_reference?: string | null
          clinic_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          disposition_text?: string | null
          disposition_type?: string | null
          hpi_encoded?: string | null
          id?: string
          is_imported?: boolean
          preview_text?: string | null
          rank?: string | null
          source_device?: string | null
          symptom_icon?: string | null
          symptom_text?: string | null
          timestamp?: string
          uic?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          algorithm_reference?: string | null
          clinic_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          disposition_text?: string | null
          disposition_type?: string | null
          hpi_encoded?: string | null
          id?: string
          is_imported?: boolean
          preview_text?: string | null
          rank?: string | null
          source_device?: string | null
          symptom_icon?: string | null
          symptom_text?: string | null
          timestamp?: string
          uic?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_id: string | null
          clinic_id: string | null
          component: string | null
          created_at: string
          credential: string | null
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          middle_initial: string | null
          notifications_enabled: boolean
          pin_hash: string | null
          pin_salt: string | null
          rank: string | null
          roles: string[]
          uic: string | null
          updated_at: string
        }
        Insert: {
          avatar_id?: string | null
          clinic_id?: string | null
          component?: string | null
          created_at?: string
          credential?: string | null
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          middle_initial?: string | null
          notifications_enabled?: boolean
          pin_hash?: string | null
          pin_salt?: string | null
          rank?: string | null
          roles?: string[]
          uic?: string | null
          updated_at?: string
        }
        Update: {
          avatar_id?: string | null
          clinic_id?: string | null
          component?: string | null
          created_at?: string
          credential?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          middle_initial?: string | null
          notifications_enabled?: boolean
          pin_hash?: string | null
          pin_salt?: string | null
          rank?: string | null
          roles?: string[]
          uic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          action: Database["public"]["Enums"]["sync_action"]
          created_at: string
          id: string
          payload: Json
          record_id: string
          status: Database["public"]["Enums"]["sync_status"]
          synced_at: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["sync_action"]
          created_at?: string
          id?: string
          payload: Json
          record_id: string
          status?: Database["public"]["Enums"]["sync_status"]
          synced_at?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["sync_action"]
          created_at?: string
          id?: string
          payload?: Json
          record_id?: string
          status?: Database["public"]["Enums"]["sync_status"]
          synced_at?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      training_completions: {
        Row: {
          completed: boolean
          completed_at: string | null
          completion_type: "read" | "test"
          created_at: string
          id: string
          result: "GO" | "NO_GO"
          step_results: Json | null
          supervisor_id: string | null
          supervisor_notes: string | null
          training_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completion_type?: "read" | "test"
          created_at?: string
          id?: string
          result?: "GO" | "NO_GO"
          step_results?: Json | null
          supervisor_id?: string | null
          supervisor_notes?: string | null
          training_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completion_type?: "read" | "test"
          created_at?: string
          id?: string
          result?: "GO" | "NO_GO"
          step_results?: Json | null
          supervisor_id?: string | null
          supervisor_notes?: string | null
          training_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_account_request: {
        Args: {
          request_id: string
          admin_user_id: string
          temp_password: string
        }
        Returns: {
          user_id: string
          email: string
          message: string
        }
      }
      reject_account_request: {
        Args: {
          request_id: string
          admin_user_id: string
          reason: string
        }
        Returns: void
      }
      submit_account_request: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_middle_initial?: string | null
          p_credential?: string | null
          p_rank?: string | null
          p_component?: string | null
          p_uic: string
          p_notes?: string | null
          p_request_type?: string
        }
        Returns: {
          id: string
          status_check_token: string
          message: string
        }
      }
      check_request_status: {
        Args: {
          p_email: string
          p_token: string
        }
        Returns: {
          found: boolean
          id: string
          email: string
          first_name: string
          last_name: string
          status: string
          request_type: string
          requested_at: string
          reviewed_at: string | null
          rejection_reason: string | null
          message: string
        }
      }
      set_user_roles: {
        Args: {
          target_user_id: string
          new_roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: {
          user_id: string
          old_roles: Database["public"]["Enums"]["user_role"][]
          new_roles: Database["public"]["Enums"]["user_role"][]
          updated_by: string
        }
      }
      get_clinic_by_uic: {
        Args: {
          lookup_uic: string
        }
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
          p_roles?: Database["public"]["Enums"]["user_role"][]
        }
        Returns: {
          user_id: string
          email: string
          message: string
        }
      }
      admin_reset_password: {
        Args: {
          p_target_user_id: string
          p_new_password: string
        }
        Returns: {
          success: boolean
          user_id: string
          message: string
        }
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
        Args: {
          p_target_user_id: string
        }
        Returns: {
          success: boolean
          user_id: string
          email: string
          message: string
        }
      }
      admin_set_clinic: {
        Args: {
          p_target_user_id: string
          p_clinic_id: string | null
        }
        Returns: Json
      }
      update_own_security_settings: {
        Args: {
          p_pin_hash?: string
          p_pin_salt?: string
          p_notifications_enabled?: boolean
        }
        Returns: undefined
      }
      clear_own_pin: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: {
      sync_action: "create" | "update" | "delete"
      sync_status: "pending" | "synced" | "failed"
      user_role: "medic" | "supervisor" | "dev"
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
      sync_action: ["create", "update", "delete"],
      sync_status: ["pending", "synced", "failed"],
      user_role: ["medic", "supervisor", "dev"],
    },
  },
} as const
