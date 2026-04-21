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
          password_hash: string | null
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
          password_hash?: string | null
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
          password_hash?: string | null
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
      app_keys: {
        Row: {
          created_at: string | null
          id: string
          key_base64: string
        }
        Insert: {
          created_at?: string | null
          id: string
          key_base64: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_base64?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          cert_number: string | null
          created_at: string
          exp_date: string | null
          id: string
          is_primary: boolean
          issue_date: string | null
          title: string
          updated_at: string
          user_id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          cert_number?: string | null
          created_at?: string
          exp_date?: string | null
          id?: string
          is_primary?: boolean
          issue_date?: string | null
          title: string
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          cert_number?: string | null
          created_at?: string
          exp_date?: string | null
          id?: string
          is_primary?: boolean
          issue_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_association_log: {
        Row: {
          action: string
          approved_by: string | null
          clinic_a_id: string
          clinic_b_id: string
          created_at: string
          id: string
          initiated_by: string
          invite_id: string | null
          justification: string | null
        }
        Insert: {
          action: string
          approved_by?: string | null
          clinic_a_id: string
          clinic_b_id: string
          created_at?: string
          id?: string
          initiated_by: string
          invite_id?: string | null
          justification?: string | null
        }
        Update: {
          action?: string
          approved_by?: string | null
          clinic_a_id?: string
          clinic_b_id?: string
          created_at?: string
          id?: string
          initiated_by?: string
          invite_id?: string | null
          justification?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_association_log_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_association_log_clinic_a_id_fkey"
            columns: ["clinic_a_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_association_log_clinic_b_id_fkey"
            columns: ["clinic_b_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_association_log_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_association_log_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "clinic_invites"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_invites: {
        Row: {
          accepted_by: string | null
          clinic_fingerprint: string | null
          clinic_id: string
          code: string
          created_at: string
          created_by: string
          emergency_justification: string | null
          expires_at: string
          id: string
          is_emergency: boolean
          peer_clinic_id: string | null
          status: string
        }
        Insert: {
          accepted_by?: string | null
          clinic_fingerprint?: string | null
          clinic_id: string
          code: string
          created_at?: string
          created_by: string
          emergency_justification?: string | null
          expires_at?: string
          id?: string
          is_emergency?: boolean
          peer_clinic_id?: string | null
          status?: string
        }
        Update: {
          accepted_by?: string | null
          clinic_fingerprint?: string | null
          clinic_id?: string
          code?: string
          created_at?: string
          created_by?: string
          emergency_justification?: string | null
          expires_at?: string
          id?: string
          is_emergency?: boolean
          peer_clinic_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invites_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_invites_peer_clinic_id_fkey"
            columns: ["peer_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          additional_user_ids: string[]
          associated_clinic_ids: string[]
          child_clinic_ids: string[]
          created_at: string
          encryption_key: string
          id: string
          location: string | null
          name: string
          plan_instruction_tags: Json | null
          plan_order_sets: Json | null
          plan_order_tags: Json | null
          text_expanders: Json | null
          uics: string[]
          updated_at: string
          vault_chain_key: string | null
          vault_created_at: string | null
          vault_iteration: number
        }
        Insert: {
          additional_user_ids?: string[]
          associated_clinic_ids?: string[]
          child_clinic_ids?: string[]
          created_at?: string
          encryption_key?: string
          id?: string
          location?: string | null
          name: string
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          text_expanders?: Json | null
          uics?: string[]
          updated_at?: string
          vault_chain_key?: string | null
          vault_created_at?: string | null
          vault_iteration?: number
        }
        Update: {
          additional_user_ids?: string[]
          associated_clinic_ids?: string[]
          child_clinic_ids?: string[]
          created_at?: string
          encryption_key?: string
          id?: string
          location?: string | null
          name?: string
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          text_expanders?: Json | null
          uics?: string[]
          updated_at?: string
          vault_chain_key?: string | null
          vault_created_at?: string | null
          vault_iteration?: number
        }
        Relationships: []
      }
      custody_ledger: {
        Row: {
          action: Database["public"]["Enums"]["custody_action"]
          clinic_id: string
          condition_code: Database["public"]["Enums"]["property_condition"]
          from_holder_id: string | null
          id: string
          item_id: string
          notes: string | null
          recorded_at: string
          recorded_by: string
          quantity_delta: number
          sub_item_check: Json | null
          to_holder_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["custody_action"]
          clinic_id: string
          condition_code: Database["public"]["Enums"]["property_condition"]
          from_holder_id?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity_delta?: number
          recorded_at?: string
          recorded_by: string
          sub_item_check?: Json | null
          to_holder_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["custody_action"]
          clinic_id?: string
          condition_code?: Database["public"]["Enums"]["property_condition"]
          from_holder_id?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity_delta?: number | null
          recorded_at?: string
          recorded_by?: string
          sub_item_check?: Json | null
          to_holder_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custody_ledger_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_ledger_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "property_items"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancies: {
        Row: {
          created_at: string
          id: string
          item_id: string
          parent_item_id: string
          rectified_at: string | null
          rectified_by: string | null
          rectify_method: Database["public"]["Enums"]["rectify_method"] | null
          rectify_notes: string | null
          responsible_holder_id: string
          status: Database["public"]["Enums"]["discrepancy_status"]
          transfer_ledger_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          parent_item_id: string
          rectified_at?: string | null
          rectified_by?: string | null
          rectify_method?: Database["public"]["Enums"]["rectify_method"] | null
          rectify_notes?: string | null
          responsible_holder_id: string
          status?: Database["public"]["Enums"]["discrepancy_status"]
          transfer_ledger_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          parent_item_id?: string
          rectified_at?: string | null
          rectified_by?: string | null
          rectify_method?: Database["public"]["Enums"]["rectify_method"] | null
          rectify_notes?: string | null
          responsible_holder_id?: string
          status?: Database["public"]["Enums"]["discrepancy_status"]
          transfer_ledger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discrepancies_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "property_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "property_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_transfer_ledger_id_fkey"
            columns: ["transfer_ledger_id"]
            isOneToOne: false
            referencedRelation: "custody_ledger"
            referencedColumns: ["id"]
          },
        ]
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
      location_tags: {
        Row: {
          height: number | null
          id: string
          label: string
          location_id: string
          rects: Json | null
          target_id: string
          target_type: string
          width: number | null
          x: number
          y: number
        }
        Insert: {
          height?: number | null
          id?: string
          label?: string
          location_id: string
          rects?: Json | null
          target_id: string
          target_type: string
          width?: number | null
          x: number
          y: number
        }
        Update: {
          height?: number | null
          id?: string
          label?: string
          location_id?: string
          rects?: Json | null
          target_id?: string
          target_type?: string
          width?: number | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_tags_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "property_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "message_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      message_groups: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          id: string
          name: string
          system_type: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          system_type?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          system_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_groups_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      message_rate_limits: {
        Row: {
          message_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          message_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          message_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          clinic_id: string | null
          created_at: string
          hpi_encoded: string | null
          id: string
          is_imported: boolean
          originating_clinic_id: string | null
          source_device: string | null
          timestamp: string
          updated_at: string
          user_id: string
          visible_clinic_ids: string[]
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          hpi_encoded?: string | null
          id?: string
          is_imported?: boolean
          originating_clinic_id?: string | null
          source_device?: string | null
          timestamp?: string
          updated_at?: string
          user_id: string
          visible_clinic_ids?: string[]
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          hpi_encoded?: string | null
          id?: string
          is_imported?: boolean
          originating_clinic_id?: string | null
          source_device?: string | null
          timestamp?: string
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
          favorite_medications: string[] | null
          first_name: string | null
          id: string
          last_active_at: string | null
          last_name: string | null
          middle_initial: string | null
          needs_password_setup: boolean
          note_include_hpi: boolean | null
          note_include_plan: boolean | null
          notify_clinic_notes: boolean | null
          notify_dev_alerts: boolean | null
          pin_hash: string | null
          pin_salt: string | null
          plan_instruction_tags: Json | null
          plan_order_sets: Json | null
          plan_order_tags: Json | null
          provider_note_templates: Json | null
          rank: string | null
          roles: Database["public"]["Enums"]["user_role"][] | null
          text_expander_enabled: boolean | null
          text_expanders: Json | null
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
          favorite_medications?: string[] | null
          first_name?: string | null
          id: string
          last_active_at?: string | null
          last_name?: string | null
          middle_initial?: string | null
          needs_password_setup?: boolean
          note_include_hpi?: boolean | null
          note_include_plan?: boolean | null
          notify_clinic_notes?: boolean | null
          notify_dev_alerts?: boolean | null
          pin_hash?: string | null
          pin_salt?: string | null
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          provider_note_templates?: Json | null
          rank?: string | null
          roles?: Database["public"]["Enums"]["user_role"][] | null
          text_expander_enabled?: boolean | null
          text_expanders?: Json | null
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
          favorite_medications?: string[] | null
          first_name?: string | null
          id?: string
          last_active_at?: string | null
          last_name?: string | null
          middle_initial?: string | null
          needs_password_setup?: boolean
          note_include_hpi?: boolean | null
          note_include_plan?: boolean | null
          notify_clinic_notes?: boolean | null
          notify_dev_alerts?: boolean | null
          pin_hash?: string | null
          pin_salt?: string | null
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          provider_note_templates?: Json | null
          rank?: string | null
          roles?: Database["public"]["Enums"]["user_role"][] | null
          text_expander_enabled?: boolean | null
          text_expanders?: Json | null
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
      property_items: {
        Row: {
          clinic_id: string
          condition_code: Database["public"]["Enums"]["property_condition"]
          created_at: string
          current_holder_id: string | null
          id: string
          lin: string | null
          location_id: string | null
          location_tag_id: string | null
          name: string
          nomenclature: string | null
          notes: string | null
          nsn: string | null
          parent_item_id: string | null
          is_serialized: boolean
          photo_url: string | null
          serial_number: string | null
          updated_at: string
          visual_fingerprint: Json | null
        }
        Insert: {
          clinic_id: string
          condition_code?: Database["public"]["Enums"]["property_condition"]
          created_at?: string
          current_holder_id?: string | null
          id?: string
          lin?: string | null
          location_id?: string | null
          location_tag_id?: string | null
          name: string
          nomenclature?: string | null
          notes?: string | null
          nsn?: string | null
          parent_item_id?: string | null
          is_serialized?: boolean
          photo_url?: string | null
          serial_number?: string | null
          updated_at?: string
          visual_fingerprint?: Json | null
        }
        Update: {
          clinic_id?: string
          condition_code?: Database["public"]["Enums"]["property_condition"]
          created_at?: string
          current_holder_id?: string | null
          id?: string
          lin?: string | null
          location_id?: string | null
          location_tag_id?: string | null
          name?: string
          nomenclature?: string | null
          notes?: string | null
          nsn?: string | null
          is_serialized?: boolean | null
          parent_item_id?: string | null
          photo_url?: string | null
          serial_number?: string | null
          updated_at?: string
          visual_fingerprint?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "property_items_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "property_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_items_location_tag_id_fkey"
            columns: ["location_tag_id"]
            isOneToOne: false
            referencedRelation: "location_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "property_items"
            referencedColumns: ["id"]
          },
        ]
      }
      property_locations: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string
          holder_user_id: string | null
          id: string
          name: string
          parent_id: string | null
          photo_data: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by: string
          holder_user_id?: string | null
          id?: string
          name: string
          parent_id?: string | null
          photo_data?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string
          holder_user_id?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          photo_data?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_locations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "property_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          created_at: string
          encrypted_token: string | null
          endpoint: string | null
          id: string
          p256dh_key: string | null
          token_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key?: string | null
          created_at?: string
          encrypted_token?: string | null
          endpoint?: string | null
          id?: string
          p256dh_key?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string | null
          created_at?: string
          encrypted_token?: string | null
          endpoint?: string | null
          id?: string
          p256dh_key?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_backups: {
        Row: {
          backup_version: number
          ciphertext: string
          created_at: string
          message_count: number
          salt: string
          user_id: string
        }
        Insert: {
          backup_version?: number
          ciphertext: string
          created_at?: string
          message_count?: number
          salt: string
          user_id: string
        }
        Update: {
          backup_version?: number
          ciphertext?: string
          created_at?: string
          message_count?: number
          salt?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_key_bundles: {
        Row: {
          device_id: string
          identity_dh_key: string
          identity_signing_key: string
          one_time_pre_keys: Json
          signed_pre_key: string
          signed_pre_key_id: number
          signed_pre_key_sig: string
          updated_at: string
          user_id: string
        }
        Insert: {
          device_id: string
          identity_dh_key: string
          identity_signing_key: string
          one_time_pre_keys?: Json
          signed_pre_key: string
          signed_pre_key_id: number
          signed_pre_key_sig: string
          updated_at?: string
          user_id: string
        }
        Update: {
          device_id?: string
          identity_dh_key?: string
          identity_signing_key?: string
          one_time_pre_keys?: Json
          signed_pre_key?: string
          signed_pre_key_id?: number
          signed_pre_key_sig?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_messages: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          message_type: string
          origin_id: string
          payload: Json
          read_at: string | null
          recipient_device_id: string | null
          recipient_id: string | null
          sender_device_id: string | null
          sender_id: string | null
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          message_type: string
          origin_id?: string
          payload: Json
          read_at?: string | null
          recipient_device_id?: string | null
          recipient_id?: string | null
          sender_device_id?: string | null
          sender_id?: string | null
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          message_type?: string
          origin_id?: string
          payload?: Json
          read_at?: string | null
          recipient_device_id?: string | null
          recipient_id?: string | null
          sender_device_id?: string | null
          sender_id?: string | null
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
          calendar_origin_id: string | null
          completed: boolean
          completed_at: string | null
          completion_type: string
          created_at: string
          due_date: string | null
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
          calendar_origin_id?: string | null
          completed?: boolean
          completed_at?: string | null
          completion_type?: string
          created_at?: string
          due_date?: string | null
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
          calendar_origin_id?: string | null
          completed?: boolean
          completed_at?: string | null
          completion_type?: string
          created_at?: string
          due_date?: string | null
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
      user_devices: {
        Row: {
          created_at: string
          device_id: string
          device_label: string | null
          is_primary: boolean
          last_active_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_label?: string | null
          is_primary?: boolean
          last_active_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_label?: string | null
          is_primary?: boolean
          last_active_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_device_keys: {
        Row: {
          created_at: string
          encrypted_blob: string
          iv: string
          kdf_iterations: number
          salt: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          encrypted_blob: string
          iv: string
          kdf_iterations?: number
          salt: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          encrypted_blob?: string
          iv?: string
          kdf_iterations?: number
          salt?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
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
      admin_force_logout: { Args: { p_target_user_id: string }; Returns: Json }
      admin_list_users: { Args: never; Returns: Json }
      admin_reset_password: {
        Args: { p_new_password: string; p_target_user_id: string }
        Returns: Json
      }
      admin_set_clinic: {
        Args: { p_clinic_id: string; p_target_user_id: string }
        Returns: Json
      }
      approve_account_request: {
        Args: { admin_user_id: string; request_id: string }
        Returns: Json
      }
      approve_clinic_invite: { Args: { p_invite_id: string }; Returns: Json }
      assign_clinic_by_uic: {
        Args: { p_uic: string; p_user_id: string }
        Returns: undefined
      }
      check_email_availability: { Args: { p_email: string }; Returns: Json }
      check_request_status: {
        Args: { p_email: string; p_token: string }
        Returns: Json
      }
      check_users_messageable: {
        Args: { p_user_ids: string[] }
        Returns: {
          has_devices: boolean
          has_keys: boolean
          user_id: string
        }[]
      }
      cleanup_protocol_messages: { Args: never; Returns: Json }
      cleanup_stale_clinic_devices: {
        Args: { p_clinic_id: string; p_stale_minutes?: number }
        Returns: Json
      }
      cleanup_stale_linked_devices: {
        Args: { p_stale_minutes?: number }
        Returns: Json
      }
      clear_own_pin: { Args: never; Returns: undefined }
      consume_peer_bundle: { Args: { p_peer_id: string }; Returns: Json }
      consume_peer_bundle_for_device: {
        Args: { p_device_id: string; p_peer_id: string }
        Returns: Json
      }
      create_message_group: {
        Args: { p_member_ids: string[]; p_name: string }
        Returns: Json
      }
      disassociate_clinic: {
        Args: { p_clinic_id: string; p_peer_clinic_id: string }
        Returns: Json
      }
      emergency_associate_clinic: {
        Args: { p_justification: string; p_peer_clinic_id: string }
        Returns: Json
      }
      fetch_group_members: { Args: { p_group_id: string }; Returns: Json }
      fetch_my_groups: { Args: never; Returns: Json }
      fetch_peer_devices: { Args: { p_peer_id: string }; Returns: Json }
      generate_clinic_invite: {
        Args: { p_expires_hours?: number }
        Returns: Json
      }
      get_clinic_by_uic: {
        Args: { lookup_uic: string }
        Returns: {
          id: string
          location: string
          name: string
          uics: string[]
        }[]
      }
      get_clinic_invites: { Args: never; Returns: Json }
      get_current_user_clinic_id: { Args: never; Returns: string }
      get_location_medics: {
        Args: never
        Returns: {
          avatar_id: string
          clinic_id: string
          clinic_name: string
          credential: string
          first_name: string
          id: string
          last_name: string
          middle_initial: string
          rank: string
        }[]
      }
      get_my_clinic_id: { Args: never; Returns: string }
      get_my_roles: { Args: never; Returns: string[] }
      get_note_author_display: { Args: { p_user_id: string }; Returns: string }
      get_or_create_clinic_calendar_group: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      get_push_tokens: {
        Args: { p_user_ids: string[] }
        Returns: {
          fcm_token: string
          id: string
          user_id: string
        }[]
      }
      get_visible_clinic_ids: { Args: never; Returns: string[] }
      get_visible_uics: { Args: never; Returns: string[] }
      hard_delete_by_origin_id: {
        Args: { p_origin_ids: string[] }
        Returns: number
      }
      hard_delete_clinic_vault_messages: {
        Args: { p_clinic_id: string; p_origin_ids: string[] }
        Returns: number
      }
      leave_message_group: { Args: { p_group_id: string }; Returns: undefined }
      primary_logout_all: { Args: never; Returns: Json }
      redeem_clinic_invite: { Args: { p_code: string }; Returns: Json }
      register_device_with_role: {
        Args: {
          p_device_id: string
          p_device_label: string
          p_is_primary: boolean
        }
        Returns: Json
      }
      reject_account_request: {
        Args: { admin_user_id: string; reason: string; request_id: string }
        Returns: undefined
      }
      reject_clinic_invite: { Args: { p_invite_id: string }; Returns: Json }
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_push_subscription: {
        Args: { p_fcm_token: string }
        Returns: undefined
      }
      rename_message_group: {
        Args: { p_group_id: string; p_name: string }
        Returns: undefined
      }
      revoke_clinic_association: {
        Args: { p_invite_id: string }
        Returns: Json
      }
      save_push_subscription: {
        Args: { p_fcm_token: string }
        Returns: undefined
      }
      self_cleanup_clinic_device: {
        Args: { p_clinic_device_id: string }
        Returns: undefined
      }
      self_cleanup_device: { Args: { p_device_id: string }; Returns: undefined }
      send_signal_message: {
        Args: {
          p_group_id?: string
          p_id: string
          p_message_type: string
          p_origin_id?: string
          p_payload: Json
          p_recipient_device_id?: string
          p_recipient_id: string
          p_sender_device_id?: string
        }
        Returns: string
      }
      send_signal_messages_batch: {
        Args: { p_messages: Json }
        Returns: string[]
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
          p_password?: string
          p_rank?: string
          p_request_type?: string
          p_uic?: string
        }
        Returns: Json
      }
      supervisor_add_member: {
        Args: { p_clinic_id: string; p_user_id: string }
        Returns: Json
      }
      supervisor_create_user: {
        Args: {
          p_clinic_id: string
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
      supervisor_find_user_by_email: {
        Args: { p_email: string }
        Returns: Json
      }
      supervisor_get_my_clinics: { Args: never; Returns: Json }
      supervisor_list_clinic_members: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      supervisor_remove_member: {
        Args: { p_clinic_id: string; p_user_id: string }
        Returns: Json
      }
      supervisor_update_clinic: {
        Args: {
          p_clinic_id: string
          p_location?: string
          p_name?: string
          p_uics?: string[]
        }
        Returns: Json
      }
      supervisor_update_clinic_note_content: {
        Args: {
          p_clinic_id: string
          p_plan_instruction_tags?: Json
          p_plan_order_sets?: Json
          p_plan_order_tags?: Json
          p_text_expanders?: Json
        }
        Returns: Json
      }
      update_own_security_settings:
        | {
            Args: { p_pin_hash?: string; p_pin_salt?: string }
            Returns: undefined
          }
        | {
            Args: {
              p_notifications_enabled?: boolean
              p_pin_hash?: string
              p_pin_salt?: string
            }
            Returns: undefined
          }
      update_user_profile:
        | {
            Args: {
              p_as_role: string
              p_component?: string
              p_credential?: string
              p_first_name?: string
              p_last_name?: string
              p_middle_initial?: string
              p_note_include_hpi?: boolean
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
              p_rank?: string
              p_target_user_id: string
              p_uic?: string
            }
            Returns: Json
          }
      validate_uics: { Args: { arr: string[] }; Returns: boolean }
    }
    Enums: {
      custody_action:
        | "sign_down"
        | "sign_up"
        | "lateral"
        | "initial_issue"
        | "turn_in"
        | "expended"
      discrepancy_status: "open" | "rectified"
      property_condition:
        | "serviceable"
        | "unserviceable"
        | "missing"
        | "damaged"
      rectify_method:
        | "found"
        | "replaced"
        | "statement_of_charges"
        | "write_off"
      request_type: "new_account" | "profile_change" | "support"
      sync_action: "create" | "update" | "delete"
      sync_status: "pending" | "synced" | "failed"
      user_role: "medic" | "supervisor" | "dev" | "provider"
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
      custody_action: [
        "sign_down",
        "sign_up",
        "lateral",
        "initial_issue",
        "turn_in",
        "expended",
      ],
      discrepancy_status: ["open", "rectified"],
      property_condition: [
        "serviceable",
        "unserviceable",
        "missing",
        "damaged",
      ],
      rectify_method: [
        "found",
        "replaced",
        "statement_of_charges",
        "write_off",
      ],
      request_type: ["new_account", "profile_change", "support"],
      sync_action: ["create", "update", "delete"],
      sync_status: ["pending", "synced", "failed"],
      user_role: ["medic", "supervisor", "dev", "provider"],
    },
  },
} as const
