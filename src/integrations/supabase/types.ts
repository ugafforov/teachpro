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
      archived_exams: {
        Row: {
          archived_at: string
          exam_date: string
          exam_name: string
          group_id: string | null
          group_name: string | null
          id: string
          original_exam_id: string | null
          results_data: Json | null
          teacher_id: string
        }
        Insert: {
          archived_at?: string
          exam_date: string
          exam_name: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          original_exam_id?: string | null
          results_data?: Json | null
          teacher_id: string
        }
        Update: {
          archived_at?: string
          exam_date?: string
          exam_name?: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          original_exam_id?: string | null
          results_data?: Json | null
          teacher_id?: string
        }
        Relationships: []
      }
      archived_groups: {
        Row: {
          archived_at: string
          description: string | null
          id: string
          name: string
          original_group_id: string | null
          teacher_id: string
        }
        Insert: {
          archived_at?: string
          description?: string | null
          id?: string
          name: string
          original_group_id?: string | null
          teacher_id: string
        }
        Update: {
          archived_at?: string
          description?: string | null
          id?: string
          name?: string
          original_group_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_students: {
        Row: {
          age: number | null
          archived_at: string
          email: string | null
          group_name: string | null
          id: string
          name: string
          original_student_id: string | null
          parent_phone: string | null
          phone: string | null
          reward_penalty_points: number | null
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          age?: number | null
          archived_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          name: string
          original_student_id?: string | null
          parent_phone?: string | null
          phone?: string | null
          reward_penalty_points?: number | null
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          age?: number | null
          archived_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          name?: string
          original_student_id?: string | null
          parent_phone?: string | null
          phone?: string | null
          reward_penalty_points?: number | null
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          status: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          status: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_attendance_records: {
        Row: {
          created_at: string | null
          date: string
          deleted_at: string | null
          id: string
          notes: string | null
          original_record_id: string | null
          status: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          original_record_id?: string | null
          status: string
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          original_record_id?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      deleted_exam_results: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          exam_id: string
          id: string
          notes: string | null
          original_record_id: string | null
          score: number
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          exam_id: string
          id?: string
          notes?: string | null
          original_record_id?: string | null
          score: number
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          exam_id?: string
          id?: string
          notes?: string | null
          original_record_id?: string | null
          score?: number
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      deleted_exams: {
        Row: {
          deleted_at: string
          exam_date: string
          exam_name: string
          group_id: string | null
          group_name: string | null
          id: string
          original_exam_id: string | null
          results_data: Json | null
          teacher_id: string
        }
        Insert: {
          deleted_at?: string
          exam_date: string
          exam_name: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          original_exam_id?: string | null
          results_data?: Json | null
          teacher_id: string
        }
        Update: {
          deleted_at?: string
          exam_date?: string
          exam_name?: string
          group_id?: string | null
          group_name?: string | null
          id?: string
          original_exam_id?: string | null
          results_data?: Json | null
          teacher_id?: string
        }
        Relationships: []
      }
      deleted_groups: {
        Row: {
          deleted_at: string
          description: string | null
          id: string
          name: string
          original_group_id: string | null
          teacher_id: string
        }
        Insert: {
          deleted_at?: string
          description?: string | null
          id?: string
          name: string
          original_group_id?: string | null
          teacher_id: string
        }
        Update: {
          deleted_at?: string
          description?: string | null
          id?: string
          name?: string
          original_group_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deleted_groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      deleted_reward_penalty_history: {
        Row: {
          created_at: string | null
          date: string
          deleted_at: string | null
          id: string
          original_record_id: string | null
          points: number
          reason: string | null
          student_id: string
          teacher_id: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          original_record_id?: string | null
          points: number
          reason?: string | null
          student_id: string
          teacher_id: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          original_record_id?: string | null
          points?: number
          reason?: string | null
          student_id?: string
          teacher_id?: string
          type?: string | null
        }
        Relationships: []
      }
      deleted_student_scores: {
        Row: {
          created_at: string | null
          date: string
          deleted_at: string | null
          id: string
          notes: string | null
          original_record_id: string | null
          reward_penalty_points: number | null
          score: number
          student_id: string
          subject: string
          teacher_id: string
          total_score: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          original_record_id?: string | null
          reward_penalty_points?: number | null
          score: number
          student_id: string
          subject: string
          teacher_id: string
          total_score?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          original_record_id?: string | null
          reward_penalty_points?: number | null
          score?: number
          student_id?: string
          subject?: string
          teacher_id?: string
          total_score?: number | null
        }
        Relationships: []
      }
      deleted_students: {
        Row: {
          age: number | null
          deleted_at: string
          email: string | null
          group_name: string | null
          id: string
          name: string
          original_student_id: string | null
          parent_phone: string | null
          phone: string | null
          reward_penalty_points: number | null
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          age?: number | null
          deleted_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          name: string
          original_student_id?: string | null
          parent_phone?: string | null
          phone?: string | null
          reward_penalty_points?: number | null
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          age?: number | null
          deleted_at?: string
          email?: string | null
          group_name?: string | null
          id?: string
          name?: string
          original_student_id?: string | null
          parent_phone?: string | null
          phone?: string | null
          reward_penalty_points?: number | null
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deleted_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          notes: string | null
          score: number
          student_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          notes?: string | null
          score: number
          student_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          notes?: string | null
          score?: number
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_types: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_types_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          exam_date: string
          exam_name: string
          exam_type_id: string | null
          group_id: string
          id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          exam_date: string
          exam_name: string
          exam_type_id?: string | null
          group_id: string
          id?: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          exam_name?: string
          exam_type_id?: string | null
          group_id?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_exam_type_id_fkey"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "exam_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_penalty_history: {
        Row: {
          created_at: string
          date: string
          id: string
          points: number
          reason: string | null
          student_id: string
          teacher_id: string
          type: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          points: number
          reason?: string | null
          student_id: string
          teacher_id: string
          type?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          points?: number
          reason?: string | null
          student_id?: string
          teacher_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_penalty_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_penalty_history_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_scores: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          reward_penalty_points: number | null
          score: number
          student_id: string
          subject: string
          teacher_id: string
          total_score: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          reward_penalty_points?: number | null
          score: number
          student_id: string
          subject: string
          teacher_id: string
          total_score?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          reward_penalty_points?: number | null
          score?: number
          student_id?: string
          subject?: string
          teacher_id?: string
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_scores_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          age: number | null
          created_at: string
          email: string | null
          group_id: string | null
          group_name: string | null
          id: string
          is_active: boolean
          name: string
          parent_phone: string | null
          phone: string | null
          reward_penalty_points: number | null
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_phone?: string | null
          phone?: string | null
          reward_penalty_points?: number | null
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          age?: number | null
          created_at?: string
          email?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_phone?: string | null
          phone?: string | null
          reward_penalty_points?: number | null
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string
          id: string
          institution_address: string | null
          institution_name: string | null
          name: string
          phone: string | null
          rejection_reason: string | null
          requested_at: string | null
          school: string | null
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email: string
          id?: string
          institution_address?: string | null
          institution_name?: string | null
          name: string
          phone?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          school?: string | null
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string
          id?: string
          institution_address?: string | null
          institution_name?: string | null
          name?: string
          phone?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          school?: string | null
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "teachers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      is_teacher_approved: { Args: { _user_id: string }; Returns: boolean }
      restore_student_full: {
        Args: { p_deleted_student_id: string }
        Returns: string
      }
      soft_delete_student: {
        Args: { p_student_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "teacher"
      verification_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "teacher"],
      verification_status: ["pending", "approved", "rejected"],
    },
  },
} as const
