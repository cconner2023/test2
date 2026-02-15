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
      clinics: {
        Row: {
          created_at: string
          id: string
          name: string
          uic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          uic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          uic?: string
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
          clinic_id: string | null
          created_at: string
          display_name: string | null
          id: string
          rank: string | null
          role: Database["public"]["Enums"]["user_role"]
          uic: string | null
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          rank?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          uic?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          rank?: string | null
          role?: Database["public"]["Enums"]["user_role"]
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
          created_at: string
          id: string
          training_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          training_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
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
      [_ in never]: never
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
