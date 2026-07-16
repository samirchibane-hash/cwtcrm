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
      activity_log: {
        Row: {
          calls: number
          created_at: string
          date: string
          emails: number
          id: string
          linkedin: number
          logged_by: string
          note: string | null
          prospect_id: string | null
        }
        Insert: {
          calls?: number
          created_at?: string
          date: string
          emails?: number
          id?: string
          linkedin?: number
          logged_by: string
          note?: string | null
          prospect_id?: string | null
        }
        Update: {
          calls?: number
          created_at?: string
          date?: string
          emails?: number
          id?: string
          linkedin?: number
          logged_by?: string
          note?: string | null
          prospect_id?: string | null
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          daily_send_cap: number
          enabled: boolean
          id: boolean
          max_sends_per_tick: number
          send_days: number[]
          send_window_end: number
          send_window_start: number
          timezone: string
          updated_at: string
        }
        Insert: {
          daily_send_cap?: number
          enabled?: boolean
          id?: boolean
          max_sends_per_tick?: number
          send_days?: number[]
          send_window_end?: number
          send_window_start?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          daily_send_cap?: number
          enabled?: boolean
          id?: boolean
          max_sends_per_tick?: number
          send_days?: number[]
          send_window_end?: number
          send_window_start?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_recommendations: {
        Row: {
          action_type: string
          contact_method: string | null
          contact_name: string | null
          created_at: string
          date: string
          id: string
          priority: string
          prospect_id: string | null
          reason: string
          snooze_until: string | null
          status: string
          talking_point: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          contact_method?: string | null
          contact_name?: string | null
          created_at?: string
          date?: string
          id?: string
          priority: string
          prospect_id?: string | null
          reason: string
          snooze_until?: string | null
          status?: string
          talking_point?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          contact_method?: string | null
          contact_name?: string | null
          created_at?: string
          date?: string
          id?: string
          priority?: string
          prospect_id?: string | null
          reason?: string
          snooze_until?: string | null
          status?: string
          talking_point?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          contact_email: string
          contact_name: string | null
          created_at: string
          gmail_message_id: string
          gmail_thread_id: string
          id: string
          outreach_session_id: string | null
          prospect_id: string
          responded: boolean
          responded_at: string | null
          sent_at: string
          sequence_number: number
          skipped: boolean
          subject: string
        }
        Insert: {
          contact_email: string
          contact_name?: string | null
          created_at?: string
          gmail_message_id: string
          gmail_thread_id: string
          id?: string
          outreach_session_id?: string | null
          prospect_id: string
          responded?: boolean
          responded_at?: string | null
          sent_at?: string
          sequence_number?: number
          skipped?: boolean
          subject: string
        }
        Update: {
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          gmail_message_id?: string
          gmail_thread_id?: string
          id?: string
          outreach_session_id?: string | null
          prospect_id?: string
          responded?: boolean
          responded_at?: string | null
          sent_at?: string
          sequence_number?: number
          skipped?: boolean
          subject?: string
        }
        Relationships: []
      }
      outreach_sessions: {
        Row: {
          approved_email_ids: Json | null
          approved_import_ids: Json | null
          body_template: string | null
          created_at: string | null
          discovered_contacts: Json
          email_body: string | null
          email_mode: string | null
          email_subject: string | null
          followup_of_session_id: string | null
          followup_sequence: number
          hook: string | null
          id: string
          prospect_id: string | null
          prospect_name: string
          session_type: string
          status: string
          updated_at: string | null
          wqa_body_template: string | null
        }
        Insert: {
          approved_email_ids?: Json | null
          approved_import_ids?: Json | null
          body_template?: string | null
          created_at?: string | null
          discovered_contacts?: Json
          email_body?: string | null
          email_mode?: string | null
          email_subject?: string | null
          followup_of_session_id?: string | null
          followup_sequence?: number
          hook?: string | null
          id?: string
          prospect_id?: string | null
          prospect_name: string
          session_type?: string
          status?: string
          updated_at?: string | null
          wqa_body_template?: string | null
        }
        Update: {
          approved_email_ids?: Json | null
          approved_import_ids?: Json | null
          body_template?: string | null
          created_at?: string | null
          discovered_contacts?: Json
          email_body?: string | null
          email_mode?: string | null
          email_subject?: string | null
          followup_of_session_id?: string | null
          followup_sequence?: number
          hook?: string | null
          id?: string
          prospect_id?: string | null
          prospect_name?: string
          session_type?: string
          status?: string
          updated_at?: string | null
          wqa_body_template?: string | null
        }
        Relationships: []
      }
      prospect_suggestions: {
        Row: {
          approved_company_ids: Json
          created_at: string
          decline_reasons: Json | null
          declined_company_ids: Json | null
          discovered_companies: Json
          id: string
          run_label: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_company_ids?: Json
          created_at?: string
          decline_reasons?: Json | null
          declined_company_ids?: Json | null
          discovered_companies?: Json
          id?: string
          run_label?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_company_ids?: Json
          created_at?: string
          decline_reasons?: Json | null
          declined_company_ids?: Json | null
          discovered_companies?: Json
          id?: string
          run_label?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_templates: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string | null
          derived_from_enrollment_id: string | null
          description: string | null
          exit_on_reply: boolean
          id: string
          name: string
          steps: Json
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          derived_from_enrollment_id?: string | null
          description?: string | null
          exit_on_reply?: boolean
          id?: string
          name: string
          steps?: Json
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string | null
          derived_from_enrollment_id?: string | null
          description?: string | null
          exit_on_reply?: boolean
          id?: string
          name?: string
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      workflow_enrollments: {
        Row: {
          completed_at: string | null
          contact_email: string
          contact_name: string | null
          created_at: string
          current_step: number
          enrolled_at: string
          exit_on_reply: boolean
          gmail_thread_id: string | null
          id: string
          last_error: string | null
          last_rfc_message_id: string | null
          next_run_at: string | null
          prospect_id: string
          prospect_name: string | null
          status: string
          steps: Json
          template_id: string | null
          template_name: string | null
          thread_subject: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_email: string
          contact_name?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          exit_on_reply?: boolean
          gmail_thread_id?: string | null
          id?: string
          last_error?: string | null
          last_rfc_message_id?: string | null
          next_run_at?: string | null
          prospect_id: string
          prospect_name?: string | null
          status?: string
          steps?: Json
          template_id?: string | null
          template_name?: string | null
          thread_subject?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          current_step?: number
          enrolled_at?: string
          exit_on_reply?: boolean
          gmail_thread_id?: string | null
          id?: string
          last_error?: string | null
          last_rfc_message_id?: string | null
          next_run_at?: string | null
          prospect_id?: string
          prospect_name?: string | null
          status?: string
          steps?: Json
          template_id?: string | null
          template_name?: string | null
          thread_subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workflow_step_runs: {
        Row: {
          enrollment_id: string
          error: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          ran_at: string
          rfc_message_id: string | null
          status: string
          step_id: string | null
          step_index: number
          subject: string | null
        }
        Insert: {
          enrollment_id: string
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          ran_at?: string
          rfc_message_id?: string | null
          status: string
          step_id?: string | null
          step_index: number
          subject?: string | null
        }
        Update: {
          enrollment_id?: string
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          ran_at?: string
          rfc_message_id?: string | null
          status?: string
          step_id?: string | null
          step_index?: number
          subject?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          status: string
          priority: string
          due_date: string | null
          prospect_id: string | null
          prospect_name: string | null
          order_id: string | null
          order_name: string | null
          contact_tags: Json
          labels: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: string
          priority?: string
          due_date?: string | null
          prospect_id?: string | null
          prospect_name?: string | null
          order_id?: string | null
          order_name?: string | null
          contact_tags?: Json
          labels?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: string
          priority?: string
          due_date?: string | null
          prospect_id?: string | null
          prospect_name?: string | null
          order_id?: string | null
          order_name?: string | null
          contact_tags?: Json
          labels?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          content: string
          author: string | null
          edited: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id: string
          content: string
          author?: string | null
          edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          content?: string
          author?: string | null
          edited?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      allowed_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          attachments: Json
          company: string
          created_at: string
          id: string
          model_items: Json
          model_type: string | null
          order_total: string
          order_type: string
          po_number: string
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          company: string
          created_at?: string
          id?: string
          model_items?: Json
          model_type?: string | null
          order_total: string
          order_type?: string
          po_number: string
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          company?: string
          created_at?: string
          id?: string
          model_items?: Json
          model_type?: string | null
          order_total?: string
          order_type?: string
          po_number?: string
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      product_models: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          pricing_tiers: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pricing_tiers?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pricing_tiers?: Json
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          city: string | null
          company_name: string
          contacts: Json
          country: string | null
          created_at: string
          engagement_notes: string | null
          engagements: Json
          google_maps_url: string | null
          id: string
          last_contact: string | null
          lead_tier: string
          linkedin: string | null
          market_type: string | null
          stage: string | null
          starred: boolean
          state: string | null
          street: string | null
          type: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          company_name: string
          contacts?: Json
          country?: string | null
          created_at?: string
          engagement_notes?: string | null
          engagements?: Json
          google_maps_url?: string | null
          id?: string
          last_contact?: string | null
          lead_tier?: string
          linkedin?: string | null
          market_type?: string | null
          stage?: string | null
          starred?: boolean
          state?: string | null
          street?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          company_name?: string
          contacts?: Json
          country?: string | null
          created_at?: string
          engagement_notes?: string | null
          engagements?: Json
          google_maps_url?: string | null
          id?: string
          last_contact?: string | null
          lead_tier?: string
          linkedin?: string | null
          market_type?: string | null
          stage?: string | null
          starred?: boolean
          state?: string | null
          street?: string | null
          type?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_email_allowed: { Args: { check_email: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
