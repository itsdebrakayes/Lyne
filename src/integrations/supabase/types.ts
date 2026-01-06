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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analytics_insights: {
        Row: {
          created_at: string | null
          data: Json
          expires_at: string | null
          generated_at: string | null
          id: string
          insight_type: string
          notebook_version: string | null
          organization_id: string
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_type: string
          notebook_version?: string | null
          organization_id: string
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          expires_at?: string | null
          generated_at?: string | null
          id?: string
          insight_type?: string
          notebook_version?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          closing_time: string | null
          created_at: string | null
          friday_closing_time: string | null
          id: string
          is_main_branch: boolean | null
          is_open: boolean | null
          name: string
          opening_time: string | null
          organization_id: string
          phone: string | null
        }
        Insert: {
          address: string
          closing_time?: string | null
          created_at?: string | null
          friday_closing_time?: string | null
          id?: string
          is_main_branch?: boolean | null
          is_open?: boolean | null
          name: string
          opening_time?: string | null
          organization_id: string
          phone?: string | null
        }
        Update: {
          address?: string
          closing_time?: string | null
          created_at?: string | null
          friday_closing_time?: string | null
          id?: string
          is_main_branch?: boolean | null
          is_open?: boolean | null
          name?: string
          opening_time?: string | null
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_type: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          id: string
          id_number: string | null
          phone: string | null
          subscription_tier: string | null
          trn_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          client_type?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          phone?: string | null
          subscription_tier?: string | null
          trn_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          client_type?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          phone?: string | null
          subscription_tier?: string | null
          trn_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      counter_assignments: {
        Row: {
          assignment_date: string
          counter_id: string
          created_at: string | null
          id: string
          shift_end: string | null
          shift_start: string | null
          staff_user_id: string
        }
        Insert: {
          assignment_date: string
          counter_id: string
          created_at?: string | null
          id?: string
          shift_end?: string | null
          shift_start?: string | null
          staff_user_id: string
        }
        Update: {
          assignment_date?: string
          counter_id?: string
          created_at?: string | null
          id?: string
          shift_end?: string | null
          shift_start?: string | null
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counter_assignments_counter_id_fkey"
            columns: ["counter_id"]
            isOneToOne: false
            referencedRelation: "counters"
            referencedColumns: ["id"]
          },
        ]
      }
      counters: {
        Row: {
          counter_number: number
          created_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          service_id: string
        }
        Insert: {
          counter_number: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          service_id: string
        }
        Update: {
          counter_number?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counters_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      export_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          export_type: string
          file_hash: string | null
          id: string
          organization_id: string | null
          row_count: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          export_type: string
          file_hash?: string | null
          id?: string
          organization_id?: string | null
          row_count?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          export_type?: string
          file_hash?: string | null
          id?: string
          organization_id?: string | null
          row_count?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          actual_wait_minutes: number | null
          branch_id: string | null
          called_at: string | null
          client_id: string
          completed_at: string | null
          created_at: string | null
          estimated_wait_minutes: number | null
          id: string
          joined_at: string | null
          notes: string | null
          organization_id: string
          position: number
          service_id: string
          started_serving_at: string | null
          status: string | null
          ticket_number: string
        }
        Insert: {
          actual_wait_minutes?: number | null
          branch_id?: string | null
          called_at?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          estimated_wait_minutes?: number | null
          id?: string
          joined_at?: string | null
          notes?: string | null
          organization_id: string
          position: number
          service_id: string
          started_serving_at?: string | null
          status?: string | null
          ticket_number: string
        }
        Update: {
          actual_wait_minutes?: number | null
          branch_id?: string | null
          called_at?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          estimated_wait_minutes?: number | null
          id?: string
          joined_at?: string | null
          notes?: string | null
          organization_id?: string
          position?: number
          service_id?: string
          started_serving_at?: string | null
          status?: string | null
          ticket_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string | null
          description: string | null
          email: string | null
          full_description: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          operating_hours: Json | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          full_description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          operating_hours?: Json | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          full_description?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          operating_hours?: Json | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      service_sessions: {
        Row: {
          completed_at: string | null
          counter_id: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          line_id: string
          notes: string | null
          outcome: string | null
          staff_user_id: string | null
          started_at: string | null
        }
        Insert: {
          completed_at?: string | null
          counter_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          line_id: string
          notes?: string | null
          outcome?: string | null
          staff_user_id?: string | null
          started_at?: string | null
        }
        Update: {
          completed_at?: string | null
          counter_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          line_id?: string
          notes?: string | null
          outcome?: string | null
          staff_user_id?: string | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_sessions_counter_id_fkey"
            columns: ["counter_id"]
            isOneToOne: false
            referencedRelation: "counters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_sessions_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_avg_time_minutes: number | null
          color: string | null
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
        }
        Insert: {
          base_avg_time_minutes?: number | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
        }
        Update: {
          base_avg_time_minutes?: number | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_performance: {
        Row: {
          avg_service_time_minutes: number | null
          avg_wait_time_minutes: number | null
          completion_rate: number | null
          created_at: string | null
          customers_served: number | null
          efficiency_score: number | null
          id: string
          organization_id: string
          period_date: string
          rank_in_org: number | null
          staff_user_id: string
        }
        Insert: {
          avg_service_time_minutes?: number | null
          avg_wait_time_minutes?: number | null
          completion_rate?: number | null
          created_at?: string | null
          customers_served?: number | null
          efficiency_score?: number | null
          id?: string
          organization_id: string
          period_date: string
          rank_in_org?: number | null
          staff_user_id: string
        }
        Update: {
          avg_service_time_minutes?: number | null
          avg_wait_time_minutes?: number | null
          completion_rate?: number | null
          created_at?: string | null
          customers_served?: number | null
          efficiency_score?: number | null
          id?: string
          organization_id?: string
          period_date?: string
          rank_in_org?: number | null
          staff_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_performance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          assigned_section: string | null
          assigned_service_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_section?: string | null
          assigned_service_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_section?: string | null
          assigned_service_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_assigned_service_id_fkey"
            columns: ["assigned_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_history: {
        Row: {
          client_id: string | null
          created_at: string | null
          day_of_week: number
          hour_of_day: number
          id: string
          organization_id: string
          service_id: string | null
          service_time_minutes: number | null
          visit_date: string
          wait_time_minutes: number | null
          was_cancelled: boolean | null
          was_no_show: boolean | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          day_of_week: number
          hour_of_day: number
          id?: string
          organization_id: string
          service_id?: string | null
          service_time_minutes?: number | null
          visit_date: string
          wait_time_minutes?: number | null
          was_cancelled?: boolean | null
          was_no_show?: boolean | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          day_of_week?: number
          hour_of_day?: number
          id?: string
          organization_id?: string
          service_id?: string | null
          service_time_minutes?: number | null
          visit_date?: string
          wait_time_minutes?: number | null
          was_cancelled?: boolean | null
          was_no_show?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_sessions: {
        Row: {
          client_id: string | null
          created_at: string | null
          device_info: string | null
          did_join: boolean | null
          duration_seconds: number | null
          id: string
          organization_id: string
          queue_state_snapshot: Json | null
          services_viewed: Json | null
          session_end: string | null
          session_start: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          device_info?: string | null
          did_join?: boolean | null
          duration_seconds?: number | null
          id?: string
          organization_id: string
          queue_state_snapshot?: Json | null
          services_viewed?: Json | null
          session_end?: string | null
          session_start?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          device_info?: string | null
          did_join?: boolean | null
          duration_seconds?: number | null
          id?: string
          organization_id?: string
          queue_state_snapshot?: Json | null
          services_viewed?: Json | null
          session_end?: string | null
          session_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitor_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      client_in_org_queue: {
        Args: { p_client_id: string; p_org_id: string }
        Returns: boolean
      }
      get_client_user_id: { Args: { p_client_id: string }; Returns: string }
      get_user_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_executive: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager_or_higher: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_staff: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      shift_queue_positions: {
        Args: {
          p_from_position: number
          p_org_id: string
          p_service_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "staff" | "section_manager" | "manager" | "executive"
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
      app_role: ["staff", "section_manager", "manager", "executive"],
    },
  },
} as const
