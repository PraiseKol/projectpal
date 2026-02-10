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
      admin_audit_log: {
        Row: {
          action_type: string
          admin_user_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      ambassador_commissions: {
        Row: {
          ambassador_user_id: string
          claimed_at: string | null
          commission_amount: number
          commission_rate: number | null
          created_at: string | null
          id: string
          paid_at: string | null
          referred_user_id: string
          status: string | null
          transaction_amount: number
          transaction_id: string
        }
        Insert: {
          ambassador_user_id: string
          claimed_at?: string | null
          commission_amount: number
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          referred_user_id: string
          status?: string | null
          transaction_amount: number
          transaction_id: string
        }
        Update: {
          ambassador_user_id?: string
          claimed_at?: string | null
          commission_amount?: number
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          referred_user_id?: string
          status?: string | null
          transaction_amount?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_commissions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      analysis_sessions: {
        Row: {
          analyses_run: Json | null
          column_config: Json | null
          created_at: string
          credits_used: number | null
          file_name: string
          file_url: string | null
          id: string
          raw_data: Json | null
          results: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analyses_run?: Json | null
          column_config?: Json | null
          created_at?: string
          credits_used?: number | null
          file_name: string
          file_url?: string | null
          id?: string
          raw_data?: Json | null
          results?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analyses_run?: Json | null
          column_config?: Json | null
          created_at?: string
          credits_used?: number | null
          file_name?: string
          file_url?: string | null
          id?: string
          raw_data?: Json | null
          results?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commission_payouts: {
        Row: {
          admin_notes: string | null
          admin_user_id: string | null
          ambassador_user_id: string
          amount: number
          created_at: string | null
          id: string
          payment_method: string | null
          payment_reference: string | null
          processed_at: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          admin_user_id?: string | null
          ambassador_user_id: string
          amount: number
          created_at?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          admin_user_id?: string | null
          ambassador_user_id?: string
          amount?: number
          created_at?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          ai_analysis: Json | null
          created_at: string
          document_type: string | null
          edited_content: string | null
          extracted_content: string | null
          file_name: string
          file_url: string
          id: string
          last_edited_at: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string
          document_type?: string | null
          edited_content?: string | null
          extracted_content?: string | null
          file_name: string
          file_url: string
          id?: string
          last_edited_at?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string
          document_type?: string | null
          edited_content?: string | null
          extracted_content?: string | null
          file_name?: string
          file_url?: string
          id?: string
          last_edited_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          content: string
          created_at: string
          created_by: string
          email_type: string
          id: string
          name: string
          recipients_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          email_type: string
          id?: string
          name: string
          recipients_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          email_type?: string
          id?: string
          name?: string
          recipients_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          campaign_id: string | null
          email: string
          error_message: string | null
          id: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          email: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          email?: string
          error_message?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          activity_reminders: boolean
          created_at: string
          id: string
          marketing_emails: boolean
          reengagement_emails: boolean
          unsubscribe_token: string
          unsubscribed_all: boolean
          updated_at: string
          usage_reports: boolean
          user_id: string
        }
        Insert: {
          activity_reminders?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          reengagement_emails?: boolean
          unsubscribe_token?: string
          unsubscribed_all?: boolean
          updated_at?: string
          usage_reports?: boolean
          user_id: string
        }
        Update: {
          activity_reminders?: boolean
          created_at?: string
          id?: string
          marketing_emails?: boolean
          reengagement_emails?: boolean
          unsubscribe_token?: string
          unsubscribed_all?: boolean
          updated_at?: string
          usage_reports?: boolean
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender: Database["public"]["Enums"]["message_sender"]
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender: Database["public"]["Enums"]["message_sender"]
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender?: Database["public"]["Enums"]["message_sender"]
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      paraphrase_logs: {
        Row: {
          created_at: string
          id: string
          input_text: string
          output_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_text: string
          output_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_text?: string
          output_text?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits_expiry_date: string | null
          daily_credits: number
          daily_paraphrase_count: number | null
          daily_reset_date: string
          first_name: string | null
          id: string
          last_name: string | null
          monthly_analysis_count: number | null
          monthly_analysis_reset_date: string | null
          monthly_credits: number
          paid_credits: number
          plan_type: Database["public"]["Enums"]["plan_type"]
          referred_by: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_expiry_date?: string | null
          daily_credits?: number
          daily_paraphrase_count?: number | null
          daily_reset_date?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          monthly_analysis_count?: number | null
          monthly_analysis_reset_date?: string | null
          monthly_credits?: number
          paid_credits?: number
          plan_type?: Database["public"]["Enums"]["plan_type"]
          referred_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_expiry_date?: string | null
          daily_credits?: number
          daily_paraphrase_count?: number | null
          daily_reset_date?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          monthly_analysis_count?: number | null
          monthly_analysis_reset_date?: string | null
          monthly_credits?: number
          paid_credits?: number
          plan_type?: Database["public"]["Enums"]["plan_type"]
          referred_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          ambassador_user_id: string
          created_at: string | null
          id: string
          referral_code_used: string
          referred_user_id: string
        }
        Insert: {
          ambassador_user_id: string
          created_at?: string | null
          id?: string
          referral_code_used: string
          referred_user_id: string
        }
        Update: {
          ambassador_user_id?: string
          created_at?: string | null
          id?: string
          referral_code_used?: string
          referred_user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          billing_period: string | null
          created_at: string | null
          credits_purchased: number
          currency: string | null
          duration_days: number | null
          id: string
          plan_type: string
          reference: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_period?: string | null
          created_at?: string | null
          credits_purchased: number
          currency?: string | null
          duration_days?: number | null
          id?: string
          plan_type: string
          reference: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_period?: string | null
          created_at?: string | null
          credits_purchased?: number
          currency?: string | null
          duration_days?: number | null
          id?: string
          plan_type?: string
          reference?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin" | "ambassador"
      message_sender: "user" | "ai"
      plan_type: "free" | "pro" | "scholar"
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
      app_role: ["admin", "moderator", "user", "super_admin", "ambassador"],
      message_sender: ["user", "ai"],
      plan_type: ["free", "pro", "scholar"],
    },
  },
} as const
