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
          component: string | null
          created_at: string
          credential: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          middle_initial: string | null
          notes: string | null
          rank: string | null
          rejection_reason: string | null
          request_type: Database["public"]["Enums"]["request_type"] | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          status_check_token: string
          uic: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          component?: string | null
          created_at?: string
          credential?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          middle_initial?: string | null
          notes?: string | null
          rank?: string | null
          rejection_reason?: string | null
          request_type?: Database["public"]["Enums"]["request_type"] | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          status_check_token?: string
          uic: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          component?: string | null
          created_at?: string
          credential?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          middle_initial?: string | null
          notes?: string | null
          rank?: string | null
          rejection_reason?: string | null
          request_type?: Database["public"]["Enums"]["request_type"] | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          status_check_token?: string
          uic?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clinics: {
        Row: {
          additional_user_ids: string[]
          child_clinic_ids: string[]
          created_at: string
          id: string
          location: string | null
          name: string
          uics: string[]
          updated_at: string
        }
        Insert: {
          additional_user_ids?: string[]
          child_clinic_ids?: string[]
          created_at?: string
          id?: string
          location?: string | null
          name: string
          uics?: string[]
          updated_at?: string
        }
        Update: {
          additional_user_ids?: string[]
          child_clinic_ids?: string[]
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          uics?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          comments: string | null
          created_at: string
          desired_feature: string | null
          display_name: string | null
          id: string
          most_useful_feature: string | null
          needs_improvement: string | null
          rating: number
          user_id: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          desired_feature?: string | null
          display_name?: string | null
          id?: string
          most_useful_feature?: string | null
          needs_improvement?: string | null
          rating: number
          user_id?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          desired_feature?: string | null
          display_name?: string | null
          id?: string
          most_useful_feature?: string | null
          needs_improvement?: string | null
          rating?: number
          user_id?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          algorithm_reference: string | null
          clinic_id: string | null
          clinic_name: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          disposition_text: string | null
          disposition_type: string | null
          hpi_encoded: string | null
          id: string
          is_imported: boolean
          originating_clinic_id: string | null
          preview_text: string | null
          rank: string | null
          source_device: string | null
          symptom_icon: string | null
          symptom_text: string | null
          timestamp: string
          uic: string | null
          updated_at: string
          user_id: string
          visible_clinic_ids: string[]
        }
        Insert: {
          algorithm_reference?: string | null
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          disposition_text?: string | null
          disposition_type?: string | null
          hpi_encoded?: string | null
          id?: string
          is_imported?: boolean
          originating_clinic_id?: string | null
          preview_text?: string | null
          rank?: string | null
          source_device?: string | null
          symptom_icon?: string | null
          symptom_text?: string | null
          timestamp?: string
          uic?: string | null
          updated_at?: string
          user_id: string
          visible_clinic_ids?: string[]
        }
        Update: {
          algorithm_reference?: string | null
          clinic_id?: string | null
          clinic_name?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          disposition_text?: string | null
          disposition_type?: string | null
          hpi_encoded?: string | null
          id?: string
          is_imported?: boolean
          originating_clinic_id?: string | null
          preview_text?: string | null
          rank?: string | null
          source_device?: string | null
          symptom_icon?: string | null
          symptom_text?: string | null
          timestamp?: string
          uic?: string | null
          updated_at?: string
          user_id?: string
          visible_clinic_ids?: string[]
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
          note_include_hpi: boolean | null
          note_include_pe: boolean | null
          notifications_enabled: boolean
          notify_clinic_notes: boolean | null
          notify_dev_alerts: boolean | null
          pe_depth: string | null
          pin_hash: string | null
          pin_salt: string | null
          rank: string | null
          roles: Database["public"]["Enums"]["user_role"][] | null
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
          note_include_hpi?: boolean | null
          note_include_pe?: boolean | null
          notifications_enabled?: boolean
          notify_clinic_notes?: boolean | null
          notify_dev_alerts?: boolean | null
          pe_depth?: string | null
          pin_hash?: string | null
          pin_salt?: string | null
          rank?: string | null
          roles?: Database["public"]["Enums"]["user_role"][] | null
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
          note_include_hpi?: boolean | null
          note_include_pe?: boolean | null
          notifications_enabled?: boolean
          notify_clinic_notes?: boolean | null
          notify_dev_alerts?: boolean | null
          pe_depth?: string | null
          pin_hash?: string | null
          pin_salt?: string | null
          rank?: string | null
          roles?: Database["public"]["Enums"]["user_role"][] | null
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
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          completion_type: string
          created_at: string
          id: string
          result: string
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
          completion_type?: string
          created_at?: string
          id?: string
          result?: string
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
          completion_type?: string
          created_at?: string
          id?: string
          result?: string
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
      admin_create_user: {
        Args: {
          p_component?: string
          p_credential?: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_middle_initial?: string
          p_rank?: string
          p_roles?: Database["public"]["Enums"]["user_role"][]
          p_temp_password: string
          p_uic?: string
        }
        Returns: Json
      }
      admin_delete_user: { Args: { p_target_user_id: string }; Returns: Json }
      admin_list_users: { Args: never; Returns: Json }
      admin_reset_password: {
        Args: { p_new_password: string; p_target_user_id: string }
        Returns: Json
      }
      admin_set_clinic: {
        Args: { p_clinic_id: string; p_target_user_id: string }
        Returns: Json
      }
      admin_update_profile:
        | {
            Args: {
              p_component?: string
              p_credential?: string
              p_first_name?: string
              p_last_name?: string
              p_middle_initial?: string
              p_rank?: string
              p_target_user_id: string
              p_uic?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_component?: string
              p_credential?: string
              p_first_name?: string
              p_last_name?: string
              p_middle_initial?: string
              p_note_include_hpi?: boolean
              p_note_include_pe?: boolean
              p_pe_depth?: string
              p_rank?: string
              p_target_user_id: string
              p_uic?: string
            }
            Returns: Json
          }
      approve_account_request: {
        Args: {
          admin_user_id: string
          request_id: string
          temp_password: string
        }
        Returns: Json
      }
      assign_clinic_by_uic: {
        Args: { p_uic: string; p_user_id: string }
        Returns: undefined
      }
      check_request_status: {
        Args: { p_email: string; p_token: string }
        Returns: Json
      }
      clear_own_pin: { Args: never; Returns: undefined }
      get_clinic_by_uic: {
        Args: { lookup_uic: string }
        Returns: {
          id: string
          location: string
          name: string
          uics: string[]
        }[]
      }
      get_clinic_notes_by_hierarchy: {
        Args: { p_exclude_user_id?: string }
        Returns: Database["public"]["Tables"]["notes"]["Row"][]
      }
      get_my_clinic_id: { Args: never; Returns: string }
      get_my_roles: { Args: never; Returns: string[] }
      get_visible_clinic_ids: { Args: Record<string, never>; Returns: string[] }
      get_note_author_display: { Args: { p_user_id: string }; Returns: string }
      reject_account_request: {
        Args: { admin_user_id: string; reason: string; request_id: string }
        Returns: undefined
      }
      remove_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      save_push_subscription: {
        Args: { p_auth_key: string; p_endpoint: string; p_p256dh_key: string }
        Returns: undefined
      }
      set_user_roles: {
        Args: {
          new_roles: Database["public"]["Enums"]["user_role"][]
          target_user_id: string
        }
        Returns: Json
      }
      submit_account_request: {
        Args: {
          p_component?: string
          p_credential?: string
          p_email: string
          p_first_name: string
          p_last_name: string
          p_middle_initial?: string
          p_notes?: string
          p_rank?: string
          p_request_type?: string
          p_uic?: string
        }
        Returns: Json
      }
      update_own_security_settings: {
        Args: {
          p_notifications_enabled?: boolean
          p_pin_hash?: string
          p_pin_salt?: string
        }
        Returns: undefined
      }
      validate_uics: { Args: { arr: string[] }; Returns: boolean }
    }
    Enums: {
      request_type: "new_account" | "profile_change"
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
      request_type: ["new_account", "profile_change"],
      sync_action: ["create", "update", "delete"],
      sync_status: ["pending", "synced", "failed"],
      user_role: ["medic", "supervisor", "dev"],
    },
  },
} as const
