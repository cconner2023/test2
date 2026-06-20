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
      audit_log: {
        Row: {
          actor_id: string | null
          clinic_id: string
          created_at: string
          domain: Database["public"]["Enums"]["audit_domain"]
          event_type: string
          id: string
          occurred_at: string
          payload_enc: string | null
          seq: number
          subject_id: string
          subject_type: string
        }
        Insert: {
          actor_id?: string | null
          clinic_id: string
          created_at?: string
          domain: Database["public"]["Enums"]["audit_domain"]
          event_type: string
          id?: string
          occurred_at?: string
          payload_enc?: string | null
          seq?: never
          subject_id: string
          subject_type: string
        }
        Update: {
          actor_id?: string | null
          clinic_id?: string
          created_at?: string
          domain?: Database["public"]["Enums"]["audit_domain"]
          event_type?: string
          id?: string
          occurred_at?: string
          payload_enc?: string | null
          seq?: never
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      clinic_invites: {
        Row: {
          clinic_fingerprint: string | null
          clinic_id: string
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
        }
        Insert: {
          clinic_fingerprint?: string | null
          clinic_id: string
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
        }
        Update: {
          clinic_fingerprint?: string | null
          clinic_id?: string
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
        }
        Relationships: [
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
        ]
      }
      clinics: {
        Row: {
          appointment_types: Json
          associated_clinic_ids: string[]
          calendar_category_colors: Json
          child_clinic_ids: string[]
          created_at: string
          encryption_key: string
          exercises: Json
          huddle_tasks: Json
          id: string
          location: string | null
          location_id: string | null
          name: string
          oncall: string[]
          parent_clinic_id: string | null
          plan_instruction_tags: Json | null
          plan_order_sets: Json | null
          plan_order_tags: Json | null
          pre_combat_checks: Json
          text_expanders: Json | null
          uics: string[]
          updated_at: string
          vault_chain_key: string | null
          vault_created_at: string | null
          vault_iteration: number
          workouts: Json
        }
        Insert: {
          appointment_types?: Json
          associated_clinic_ids?: string[]
          calendar_category_colors?: Json
          child_clinic_ids?: string[]
          created_at?: string
          encryption_key?: string
          exercises?: Json
          huddle_tasks?: Json
          id?: string
          location?: string | null
          location_id?: string | null
          name: string
          oncall?: string[]
          parent_clinic_id?: string | null
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          pre_combat_checks?: Json
          text_expanders?: Json | null
          uics?: string[]
          updated_at?: string
          vault_chain_key?: string | null
          vault_created_at?: string | null
          vault_iteration?: number
          workouts?: Json
        }
        Update: {
          appointment_types?: Json
          associated_clinic_ids?: string[]
          calendar_category_colors?: Json
          child_clinic_ids?: string[]
          created_at?: string
          encryption_key?: string
          exercises?: Json
          huddle_tasks?: Json
          id?: string
          location?: string | null
          location_id?: string | null
          name?: string
          oncall?: string[]
          parent_clinic_id?: string | null
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          pre_combat_checks?: Json
          text_expanders?: Json | null
          uics?: string[]
          updated_at?: string
          vault_chain_key?: string | null
          vault_created_at?: string | null
          vault_iteration?: number
          workouts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clinics_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinics_parent_clinic_id_fkey"
            columns: ["parent_clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
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
          quantity_delta: number
          recorded_at: string
          recorded_by: string
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
          quantity_delta?: number
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
      event_intake_credentials: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          id: string
          intake_enabled: boolean
          oncall_enabled: boolean
          oncall_voicemail_greeting: Json | null
          outside_message_enabled: boolean
          passcode: string
          passcode_rotated_at: string
          passphrase_hash: string
          passphrase_rotated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          intake_enabled?: boolean
          oncall_enabled?: boolean
          oncall_voicemail_greeting?: Json | null
          outside_message_enabled?: boolean
          passcode: string
          passcode_rotated_at?: string
          passphrase_hash: string
          passphrase_rotated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          intake_enabled?: boolean
          oncall_enabled?: boolean
          oncall_voicemail_greeting?: Json | null
          outside_message_enabled?: boolean
          passcode?: string
          passcode_rotated_at?: string
          passphrase_hash?: string
          passphrase_rotated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_intake_credentials_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      event_intake_requests: {
        Row: {
          approved_origin_id: string | null
          clinic_id: string
          credential_id: string | null
          event_id: string | null
          id: string
          intake_request_origin_id: string | null
          requested_end: string | null
          requested_start: string | null
          requester_email: string | null
          requester_name: string | null
          requester_org: string | null
          status: string
          submitted_at: string
          title: string | null
        }
        Insert: {
          approved_origin_id?: string | null
          clinic_id: string
          credential_id?: string | null
          event_id?: string | null
          id?: string
          intake_request_origin_id?: string | null
          requested_end?: string | null
          requested_start?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_org?: string | null
          status?: string
          submitted_at?: string
          title?: string | null
        }
        Update: {
          approved_origin_id?: string | null
          clinic_id?: string
          credential_id?: string | null
          event_id?: string | null
          id?: string
          intake_request_origin_id?: string | null
          requested_end?: string | null
          requested_start?: string | null
          requester_email?: string | null
          requester_name?: string | null
          requester_org?: string | null
          status?: string
          submitted_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_intake_requests_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_intake_requests_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "event_intake_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_vote_candidates: {
        Row: {
          created_at: string
          cycle_id: string
          description: string | null
          id: string
          sort_order: number
          source_suggestion_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          description?: string | null
          id?: string
          sort_order?: number
          source_suggestion_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          description?: string | null
          id?: string
          sort_order?: number
          source_suggestion_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_vote_candidates_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "feature_vote_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_vote_cycles: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          opened_at: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opened_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          opened_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      feature_vote_suggestions: {
        Row: {
          created_at: string
          cycle_id: string | null
          description: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_id?: string | null
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_id?: string | null
          description?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_vote_suggestions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "feature_vote_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_votes: {
        Row: {
          candidate_id: string
          created_at: string
          cycle_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          cycle_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          cycle_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "feature_vote_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_votes_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "feature_vote_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          archived_at: string | null
          comments: string | null
          created_at: string
          desired_feature: string | null
          display_name: string | null
          id: string
          most_useful_feature: string | null
          needs_improvement: string | null
          rating: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archived_at?: string | null
          comments?: string | null
          created_at?: string
          desired_feature?: string | null
          display_name?: string | null
          id?: string
          most_useful_feature?: string | null
          needs_improvement?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archived_at?: string | null
          comments?: string | null
          created_at?: string
          desired_feature?: string | null
          display_name?: string | null
          id?: string
          most_useful_feature?: string | null
          needs_improvement?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      intake_auth_throttle: {
        Row: {
          credential_id: string
          fail_count: number
          locked_until: string | null
          window_start: string
        }
        Insert: {
          credential_id: string
          fail_count?: number
          locked_until?: string | null
          window_start?: string
        }
        Update: {
          credential_id?: string
          fail_count?: number
          locked_until?: string | null
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_auth_throttle_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: true
            referencedRelation: "event_intake_credentials"
            referencedColumns: ["id"]
          },
        ]
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
      locations: {
        Row: {
          archived_at: string | null
          command: string | null
          country_code: string
          created_at: string
          display_name: string
          id: string
          installation: string
          lat: number | null
          lon: number | null
          parent_id: string | null
          sub_area: string | null
          subdivision: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          command?: string | null
          country_code: string
          created_at?: string
          display_name: string
          id?: string
          installation: string
          lat?: number | null
          lon?: number | null
          parent_id?: string | null
          sub_area?: string | null
          subdivision?: string | null
          timezone: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          command?: string | null
          country_code?: string
          created_at?: string
          display_name?: string
          id?: string
          installation?: string
          lat?: number | null
          lon?: number | null
          parent_id?: string | null
          sub_area?: string | null
          subdivision?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
      outside_session_calls: {
        Row: {
          call_id: string
          initiator_user_id: string
          session_id: string
          started_at: string
          status: string
        }
        Insert: {
          call_id: string
          initiator_user_id: string
          session_id: string
          started_at?: string
          status?: string
        }
        Update: {
          call_id?: string
          initiator_user_id?: string
          session_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outside_session_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "outside_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      outside_sessions: {
        Row: {
          clinic_id: string
          closed_at: string | null
          closed_reason: string | null
          last_seen_at: string
          opened_at: string
          outside_pub: string
          requester_name: string
          session_id: string
          status: string
        }
        Insert: {
          clinic_id: string
          closed_at?: string | null
          closed_reason?: string | null
          last_seen_at?: string
          opened_at?: string
          outside_pub: string
          requester_name: string
          session_id?: string
          status?: string
        }
        Update: {
          clinic_id?: string
          closed_at?: string | null
          closed_reason?: string | null
          last_seen_at?: string
          opened_at?: string
          outside_pub?: string
          requester_name?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outside_sessions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_clinic_loans: {
        Row: {
          clinic_id: string
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_clinic_loans_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_clinic_loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_clinic_loans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_blob: Json | null
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
          note_template_clinic_ids: string[] | null
          notify_calendar_assignments: boolean
          notify_clinic_notes: boolean | null
          notify_dev_alerts: boolean | null
          overview_widgets: Json | null
          pin_hash: string | null
          pin_salt: string | null
          plan_instruction_tags: Json | null
          plan_order_sets: Json | null
          plan_order_tags: Json | null
          provider_note_templates: Json | null
          rank: string | null
          roles: Database["public"]["Enums"]["user_role"][] | null
          supervisor_created: boolean
          surrogate_clinic_id: string | null
          swipe_actions: Json | null
          text_expanders: Json | null
          theme: string | null
          uic: string | null
          updated_at: string
          voicemail_greeting: Json | null
        }
        Insert: {
          avatar_blob?: Json | null
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
          note_template_clinic_ids?: string[] | null
          notify_calendar_assignments?: boolean
          notify_clinic_notes?: boolean | null
          notify_dev_alerts?: boolean | null
          overview_widgets?: Json | null
          pin_hash?: string | null
          pin_salt?: string | null
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          provider_note_templates?: Json | null
          rank?: string | null
          roles?: Database["public"]["Enums"]["user_role"][] | null
          supervisor_created?: boolean
          surrogate_clinic_id?: string | null
          swipe_actions?: Json | null
          text_expanders?: Json | null
          theme?: string | null
          uic?: string | null
          updated_at?: string
          voicemail_greeting?: Json | null
        }
        Update: {
          avatar_blob?: Json | null
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
          note_template_clinic_ids?: string[] | null
          notify_calendar_assignments?: boolean
          notify_clinic_notes?: boolean | null
          notify_dev_alerts?: boolean | null
          overview_widgets?: Json | null
          pin_hash?: string | null
          pin_salt?: string | null
          plan_instruction_tags?: Json | null
          plan_order_sets?: Json | null
          plan_order_tags?: Json | null
          provider_note_templates?: Json | null
          rank?: string | null
          roles?: Database["public"]["Enums"]["user_role"][] | null
          supervisor_created?: boolean
          surrogate_clinic_id?: string | null
          swipe_actions?: Json | null
          text_expanders?: Json | null
          theme?: string | null
          uic?: string | null
          updated_at?: string
          voicemail_greeting?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_surrogate_clinic_id_fkey"
            columns: ["surrogate_clinic_id"]
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
          expiry_date: string | null
          id: string
          is_serialized: boolean
          lin: string | null
          location_id: string | null
          location_tag_id: string | null
          name: string
          nomenclature: string | null
          notes: string | null
          nsn: string | null
          parent_item_id: string | null
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
          expiry_date?: string | null
          id?: string
          is_serialized?: boolean
          lin?: string | null
          location_id?: string | null
          location_tag_id?: string | null
          name: string
          nomenclature?: string | null
          notes?: string | null
          nsn?: string | null
          parent_item_id?: string | null
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
          expiry_date?: string | null
          id?: string
          is_serialized?: boolean
          lin?: string | null
          location_id?: string | null
          location_tag_id?: string | null
          name?: string
          nomenclature?: string | null
          notes?: string | null
          nsn?: string | null
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
          is_default_zone: boolean
          kind: string
          name: string
          ordinal: number
          overlay_feature_id: string | null
          overlay_id: string | null
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
          is_default_zone?: boolean
          kind?: string
          name: string
          ordinal?: number
          overlay_feature_id?: string | null
          overlay_id?: string | null
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
          is_default_zone?: boolean
          kind?: string
          name?: string
          ordinal?: number
          overlay_feature_id?: string | null
          overlay_id?: string | null
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
          snapshot_id: string
          user_id: string
        }
        Insert: {
          backup_version?: number
          ciphertext: string
          created_at?: string
          message_count?: number
          salt: string
          snapshot_id?: string
          user_id: string
        }
        Update: {
          backup_version?: number
          ciphertext?: string
          created_at?: string
          message_count?: number
          salt?: string
          snapshot_id?: string
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
      signal_message_reads: {
        Row: {
          message_id: string
          read_at: string
          recipient_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          recipient_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "signal_messages"
            referencedColumns: ["id"]
          },
        ]
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
      signal_messages_delete_audit: {
        Row: {
          application_name: string | null
          audit_id: number
          deleted_at: string
          deleted_by: string | null
          group_id: string | null
          is_vault_row: boolean | null
          message_id: string
          message_type: string | null
          origin_id: string | null
          recipient_device_id: string | null
          recipient_id: string | null
          row_created_at: string | null
          sender_device_id: string | null
          sender_id: string | null
          txid: number
        }
        Insert: {
          application_name?: string | null
          audit_id?: number
          deleted_at?: string
          deleted_by?: string | null
          group_id?: string | null
          is_vault_row?: boolean | null
          message_id: string
          message_type?: string | null
          origin_id?: string | null
          recipient_device_id?: string | null
          recipient_id?: string | null
          row_created_at?: string | null
          sender_device_id?: string | null
          sender_id?: string | null
          txid?: number
        }
        Update: {
          application_name?: string | null
          audit_id?: number
          deleted_at?: string
          deleted_by?: string | null
          group_id?: string | null
          is_vault_row?: boolean | null
          message_id?: string
          message_type?: string | null
          origin_id?: string | null
          recipient_device_id?: string | null
          recipient_id?: string | null
          row_created_at?: string | null
          sender_device_id?: string | null
          sender_id?: string | null
          txid?: number
        }
        Relationships: []
      }
      system_identity_shared: {
        Row: {
          created_at: string
          dev_key: string
          encrypted_blob: string | null
          id: boolean
          iv: string | null
          kdf_iterations: number
          salt: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          dev_key: string
          encrypted_blob?: string | null
          id?: boolean
          iv?: string | null
          kdf_iterations?: number
          salt?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          dev_key?: string
          encrypted_blob?: string | null
          id?: boolean
          iv?: string | null
          kdf_iterations?: number
          salt?: string | null
          updated_at?: string
          version?: number
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
      _assert_supervisor_or_dev: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      _emit_audit: {
        Args: {
          p_actor: string
          p_clinic_id: string
          p_domain: Database["public"]["Enums"]["audit_domain"]
          p_event: string
          p_payload_enc?: string
          p_subject_id: string
          p_subject_type: string
        }
        Returns: undefined
      }
      _ensure_clinic_oncall_group: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      _ensure_clinic_system_group_for_intake: {
        Args: { p_clinic_id: string }
        Returns: string
      }
      _intake_throttle_apply_fail: {
        Args: { p_cred: string }
        Returns: undefined
      }
      _intake_throttle_assert: { Args: { p_cred: string }; Returns: undefined }
      _intake_throttle_fail: { Args: { p_cred: string }; Returns: undefined }
      _intake_throttle_reset: { Args: { p_cred: string }; Returns: undefined }
      _is_valid_passphrase: { Args: { p: string }; Returns: boolean }
      _oncall_ring_set: { Args: { p_clinic_id: string }; Returns: string[] }
      _outside_session_finalize: {
        Args: { p_reason: string; p_session_id: string }
        Returns: undefined
      }
      _outside_session_sweep: { Args: never; Returns: undefined }
      _random_passphrase: { Args: never; Returns: string }
      _random_unambiguous: { Args: { p_len: number }; Returns: string }
      _sanitize_outside_name: { Args: { p: string }; Returns: string }
      accept_oncall: {
        Args: { p_answer_sdp: Json; p_call_id: string }
        Returns: Json
      }
      ack_outside_session_reply: {
        Args: { p_reply_ids: string[]; p_session_id: string }
        Returns: undefined
      }
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
      admin_list_clinic_loans: {
        Args: { p_clinic_id: string }
        Returns: {
          clinic_id: string
          direction: string
          user_id: string
        }[]
      }
      admin_list_user_loans: {
        Args: { p_user_id: string }
        Returns: {
          clinic_id: string
        }[]
      }
      admin_list_users: { Args: { p_since?: string }; Returns: Json }
      admin_provision_clinic_vault: {
        Args: {
          p_clinic_id: string
          p_device_label?: string
          p_encrypted_blob: string
          p_identity_dh_key: string
          p_identity_signing_key: string
          p_iv: string
          p_kdf_iterations: number
          p_one_time_pre_keys: Json
          p_salt: string
          p_signed_pre_key: string
          p_signed_pre_key_id: number
          p_signed_pre_key_sig: string
          p_version: number
        }
        Returns: Json
      }
      admin_rescue_clinic_associations_by_location: {
        Args: { p_location_id: string }
        Returns: number
      }
      admin_reset_password: {
        Args: { p_new_password: string; p_target_user_id: string }
        Returns: Json
      }
      admin_set_clinic: {
        Args: { p_clinic_id: string; p_target_user_id: string }
        Returns: Json
      }
      admin_set_user_loans: {
        Args: { p_clinic_ids: string[]; p_user_id: string }
        Returns: undefined
      }
      admin_update_user_email: {
        Args: { new_email: string; target_user_id: string }
        Returns: Json
      }
      approve_account_request: {
        Args: { admin_user_id: string; request_id: string }
        Returns: Json
      }
      assign_clinic_by_uic: {
        Args: { p_uic: string; p_user_id: string }
        Returns: undefined
      }
      auth_clinic_ids: { Args: never; Returns: string[] }
      backfill_location_clinic_associations: {
        Args: never
        Returns: {
          added_peers: number
          clinic_id: string
        }[]
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
      dblink: { Args: { "": string }; Returns: Record<string, unknown>[] }
      dblink_cancel_query: { Args: { "": string }; Returns: string }
      dblink_close: { Args: { "": string }; Returns: string }
      dblink_connect: { Args: { "": string }; Returns: string }
      dblink_connect_u: { Args: { "": string }; Returns: string }
      dblink_current_query: { Args: never; Returns: string }
      dblink_disconnect:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      dblink_error_message: { Args: { "": string }; Returns: string }
      dblink_exec: { Args: { "": string }; Returns: string }
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] }
        Returns: undefined
      }
      dblink_get_connections: { Args: never; Returns: string[] }
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] }
      dblink_get_pkey: {
        Args: { "": string }
        Returns: Database["public"]["CompositeTypes"]["dblink_pkey_results"][]
        SetofOptions: {
          from: "*"
          to: "dblink_pkey_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dblink_get_result: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      dblink_is_busy: { Args: { "": string }; Returns: number }
      demote_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      disassociate_clinic: {
        Args: { p_clinic_id: string; p_peer_clinic_id: string }
        Returns: Json
      }
      drain_system_inbox: {
        Args: { p_after?: string }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "signal_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      end_outside_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      fetch_group_members: { Args: { p_group_id: string }; Returns: Json }
      fetch_my_groups: { Args: never; Returns: Json }
      fetch_peer_devices: { Args: { p_peer_id: string }; Returns: Json }
      fetch_profiles_by_ids: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_blob: Json
          avatar_id: string
          clinic_id: string
          clinic_name: string
          credential: string
          first_name: string
          id: string
          last_name: string
          middle_initial: string
          rank: string
          voicemail_greeting: Json
        }[]
      }
      gc_read_signal_messages: {
        Args: { p_recipient_id?: string }
        Returns: number
      }
      generate_clinic_invite: {
        Args: { p_expires_hours?: number }
        Returns: Json
      }
      get_associated_clinic_code: {
        Args: { p_clinic_id: string }
        Returns: string
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
      get_clinic_outside_contact_status: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      get_current_user_clinic_id: { Args: never; Returns: string }
      get_event_intake_credential: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      get_location_medics: {
        Args: never
        Returns: {
          avatar_blob: Json
          avatar_id: string
          clinic_id: string
          clinic_name: string
          credential: string
          first_name: string
          id: string
          is_loaned_in: boolean
          last_name: string
          middle_initial: string
          rank: string
          roles: Database["public"]["Enums"]["user_role"][]
          surrogate_clinic_id: string
        }[]
      }
      get_my_clinic_id: { Args: never; Returns: string }
      get_my_roles: { Args: never; Returns: string[] }
      get_note_author_display: { Args: { p_user_id: string }; Returns: string }
      get_oncall_greeting: { Args: { p_clinic_id: string }; Returns: Json }
      get_or_create_clinic_calendar_group: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      get_or_create_clinic_system_group: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      get_peer_identity_dh_keys: {
        Args: { p_user_ids: string[] }
        Returns: {
          identity_dh_key: string
          user_id: string
        }[]
      }
      get_push_tokens: {
        Args: { p_user_ids: string[] }
        Returns: {
          fcm_token: string
          id: string
          user_id: string
        }[]
      }
      get_system_shared: { Args: never; Returns: Json }
      get_user_clinic_sets: {
        Args: { p_user_ids: string[] }
        Returns: {
          clinic_id: string
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
      hard_delete_recipient_origin: {
        Args: { p_origin_ids: string[] }
        Returns: number
      }
      hard_delete_system_origin: {
        Args: { p_origin_ids: string[] }
        Returns: number
      }
      intake_action: {
        Args: { p_action: string; p_event_id?: string; p_intake_id: string }
        Returns: Json
      }
      intake_authorize_and_bundles: {
        Args: { p_passcode: string; p_passphrase: string }
        Returns: Json
      }
      intake_insert_system_rows: {
        Args: { p_group_id: string; p_origin_id: string; p_rows: Json }
        Returns: undefined
      }
      is_dev: { Args: never; Returns: boolean }
      is_supervisor_of: { Args: { target_user_id: string }; Returns: boolean }
      kill_event_intake_credential: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      leave_message_group: { Args: { p_group_id: string }; Returns: undefined }
      mark_signal_messages_read: {
        Args: { p_message_ids: string[]; p_recipient_id?: string }
        Returns: undefined
      }
      mint_event_intake_credential: {
        Args: { p_clinic_id: string; p_passphrase?: string }
        Returns: Json
      }
      oncall_resolve_authorize_and_bundles: {
        Args: {
          p_actor?: string
          p_call_id: string
          p_outcome: string
          p_passcode?: string
          p_passphrase?: string
        }
        Returns: Json
      }
      outside_message_authorize_and_bundles: {
        Args: { p_passcode: string; p_passphrase: string }
        Returns: Json
      }
      poll_oncall_signal: {
        Args: { p_call_id: string; p_passcode: string }
        Returns: Json
      }
      poll_outside_session: { Args: { p_session_id: string }; Returns: Json }
      primary_logout_all: { Args: never; Returns: Json }
      promote_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      purge_clinic_intake_conversation: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      purge_message_group: { Args: { p_group_id: string }; Returns: undefined }
      read_audit: {
        Args: {
          p_clinic_id?: string
          p_domain?: Database["public"]["Enums"]["audit_domain"]
          p_limit?: number
          p_since?: number
          p_subject_id?: string
        }
        Returns: {
          actor_id: string | null
          clinic_id: string
          created_at: string
          domain: Database["public"]["Enums"]["audit_domain"]
          event_type: string
          id: string
          occurred_at: string
          payload_enc: string | null
          seq: number
          subject_id: string
          subject_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "audit_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reap_clinic_vault_below: {
        Args: { p_clinic_id: string; p_watermark: string }
        Returns: number
      }
      redeem_clinic_invite: { Args: { p_code: string }; Returns: Json }
      register_device_with_role: {
        Args: {
          p_device_id: string
          p_device_label: string
          p_is_primary: boolean
        }
        Returns: Json
      }
      register_outside_session: {
        Args: {
          p_outside_pub: string
          p_passcode: string
          p_passphrase: string
          p_requester_name: string
        }
        Returns: Json
      }
      reject_account_request: {
        Args: { admin_user_id: string; reason: string; request_id: string }
        Returns: undefined
      }
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
      request_oncall: {
        Args: {
          p_passcode: string
          p_passphrase: string
          p_requester_name: string
          p_sdp_offer: Json
        }
        Returns: Json
      }
      resolve_event_intake_code: { Args: { p_passcode: string }; Returns: Json }
      ring_outside_session: {
        Args: { p_call_id: string; p_offer_sdp: Json; p_session_id: string }
        Returns: Json
      }
      rotate_event_intake_passcode: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      rotate_event_intake_passphrase: {
        Args: { p_clinic_id: string; p_passphrase?: string }
        Returns: Json
      }
      save_push_subscription: {
        Args: { p_fcm_token: string }
        Returns: undefined
      }
      search_users: {
        Args: { query: string }
        Returns: {
          avatar_id: string
          clinic_id: string
          clinic_name: string
          credential: string
          email: string
          first_name: string
          id: string
          last_name: string
          middle_initial: string
          rank: string
        }[]
      }
      self_cleanup_clinic_device: {
        Args: { p_clinic_device_id: string }
        Returns: undefined
      }
      self_cleanup_device: { Args: { p_device_id: string }; Returns: undefined }
      send_outside_session_call_signal: {
        Args: { p_call_id: string; p_kind: string; p_sdp?: Json }
        Returns: undefined
      }
      send_outside_session_reply: {
        Args: { p_sealed: Json; p_session_id: string; p_text: string }
        Returns: Json
      }
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
      send_signal_message_as_system: {
        Args: {
          p_group_id?: string
          p_id: string
          p_origin_id?: string
          p_payload: Json
          p_recipient_device_id: string
          p_recipient_id: string
        }
        Returns: string
      }
      send_signal_messages_batch: {
        Args: { p_messages: Json }
        Returns: string[]
      }
      set_intake_enabled: {
        Args: { p_clinic_id: string; p_enabled: boolean }
        Returns: Json
      }
      set_oncall_greeting: {
        Args: { p_clinic_id: string; p_greeting: Json }
        Returns: Json
      }
      set_oncall_master: {
        Args: { p_clinic_id: string; p_enabled: boolean }
        Returns: Json
      }
      set_outside_message_enabled: {
        Args: { p_clinic_id: string; p_enabled: boolean }
        Returns: Json
      }
      set_system_shared: {
        Args: {
          p_bundle: Json
          p_dev_key: string
          p_encrypted_blob: string
          p_iv: string
          p_kdf_iterations?: number
          p_salt: string
        }
        Returns: Json
      }
      set_user_roles: {
        Args: {
          new_roles: Database["public"]["Enums"]["user_role"][]
          target_user_id: string
        }
        Returns: Json
      }
      set_user_surrogate: {
        Args: { p_surrogate_clinic_id: string; p_user_id: string }
        Returns: undefined
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
      submit_outside_session_call_signal: {
        Args: {
          p_call_id: string
          p_kind: string
          p_sdp?: Json
          p_session_id: string
        }
        Returns: undefined
      }
      supervisor_add_member: {
        Args: { p_clinic_id: string; p_user_id: string }
        Returns: Json
      }
      supervisor_can_evaluate: {
        Args: { p_target_user_id: string }
        Returns: boolean
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
      supervisor_end_all_loans_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      supervisor_end_loan_user: {
        Args: { p_clinic_id: string; p_user_id: string }
        Returns: undefined
      }
      supervisor_find_user_by_email: {
        Args: { p_email: string }
        Returns: Json
      }
      supervisor_get_member_profile: {
        Args: { p_user_id: string }
        Returns: Json
      }
      supervisor_get_my_clinics: { Args: never; Returns: Json }
      supervisor_list_clinic_members: {
        Args: { p_clinic_id: string }
        Returns: Json
      }
      supervisor_loan_user: {
        Args: { p_target_clinic_code: string; p_user_id: string }
        Returns: undefined
      }
      supervisor_loan_user_to_clinic: {
        Args: { p_target_clinic_id: string; p_user_id: string }
        Returns: undefined
      }
      supervisor_remove_member: {
        Args: { p_clinic_id: string; p_user_id: string }
        Returns: Json
      }
      supervisor_remove_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      supervisor_reset_password: {
        Args: { p_new_password: string; p_target_user_id: string }
        Returns: Json
      }
      supervisor_transfer_user: {
        Args: { p_target_clinic_code: string; p_user_id: string }
        Returns: undefined
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
      supervisor_update_clinic_appointment_types: {
        Args: { p_clinic_id: string; p_types: Json }
        Returns: undefined
      }
      supervisor_update_clinic_calendar_colors: {
        Args: { p_clinic_id: string; p_colors: Json }
        Returns: undefined
      }
      supervisor_update_clinic_exercises: {
        Args: { p_clinic_id: string; p_exercises: Json }
        Returns: undefined
      }
      supervisor_update_clinic_huddle_tasks: {
        Args: { p_clinic_id: string; p_tasks: Json }
        Returns: undefined
      }
      supervisor_update_clinic_location_id: {
        Args: { p_clinic_id: string; p_location_id: string }
        Returns: undefined
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
      supervisor_update_clinic_pre_combat_checks: {
        Args: { p_clinic_id: string; p_pcc: Json }
        Returns: undefined
      }
      supervisor_update_clinic_workouts: {
        Args: { p_clinic_id: string; p_workouts: Json }
        Returns: undefined
      }
      supervisor_update_user_email: {
        Args: { p_new_email: string; p_target_user_id: string }
        Returns: Json
      }
      toggle_oncall_presence: {
        Args: { p_clinic_id: string; p_on: boolean; p_user_id: string }
        Returns: Json
      }
      trim_all_signal_backups: { Args: { p_keep?: number }; Returns: number }
      trim_signal_backups: { Args: { p_keep?: number }; Returns: number }
      update_own_email: { Args: { p_new_email: string }; Returns: Json }
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
      update_system_shared_blob: {
        Args: {
          p_encrypted_blob: string
          p_expected_version: number
          p_iv: string
        }
        Returns: number
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
      write_clinic_snapshot: {
        Args: {
          p_ciphertext: string
          p_clinic_id: string
          p_event_count: number
          p_expected_version: number
          p_retain?: number
          p_salt: string
        }
        Returns: number
      }
    }
    Enums: {
      audit_domain: "property" | "personnel" | "training" | "cert"
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
      dblink_pkey_results: {
        position: number | null
        colname: string | null
      }
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
      audit_domain: ["property", "personnel", "training", "cert"],
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
