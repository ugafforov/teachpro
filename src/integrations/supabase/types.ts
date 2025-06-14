export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      archived_groups: {
        Row: {
          archived_at: string
          archived_by: string | null
          can_restore: boolean | null
          description: string | null
          id: string
          name: string
          original_group_id: string
          teacher_id: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          can_restore?: boolean | null
          description?: string | null
          id?: string
          name: string
          original_group_id: string
          teacher_id: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          can_restore?: boolean | null
          description?: string | null
          id?: string
          name?: string
          original_group_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_groups_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
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
          archived_at: string
          archived_by: string | null
          can_restore: boolean | null
          email: string | null
          group_name: string
          id: string
          name: string
          original_student_id: string
          phone: string | null
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          can_restore?: boolean | null
          email?: string | null
          group_name: string
          id?: string
          name: string
          original_student_id: string
          phone?: string | null
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          can_restore?: boolean | null
          email?: string | null
          group_name?: string
          id?: string
          name?: string
          original_student_id?: string
          phone?: string | null
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_students_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
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
          reason: string | null
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
          status: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
          status?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
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
      deleted_groups: {
        Row: {
          deleted_at: string
          description: string | null
          id: string
          name: string
          original_group_id: string
          teacher_id: string
        }
        Insert: {
          deleted_at?: string
          description?: string | null
          id?: string
          name: string
          original_group_id: string
          teacher_id: string
        }
        Update: {
          deleted_at?: string
          description?: string | null
          id?: string
          name?: string
          original_group_id?: string
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
      deleted_students: {
        Row: {
          deleted_at: string
          email: string | null
          group_name: string
          id: string
          name: string
          original_student_id: string
          phone: string | null
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          deleted_at?: string
          email?: string | null
          group_name: string
          id?: string
          name: string
          original_student_id: string
          phone?: string | null
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          deleted_at?: string
          email?: string | null
          group_name?: string
          id?: string
          name?: string
          original_student_id?: string
          phone?: string | null
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
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          teacher_id?: string
          updated_at?: string
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
          id: string
          points: number
          reason: string
          student_id: string
          teacher_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          student_id: string
          teacher_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          student_id?: string
          teacher_id?: string
          type?: string
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
      student_rankings: {
        Row: {
          absent_count: number | null
          attendance_percentage: number | null
          id: string
          last_updated: string
          late_count: number | null
          present_count: number | null
          rank_position: number | null
          student_id: string
          teacher_id: string
          total_classes: number | null
        }
        Insert: {
          absent_count?: number | null
          attendance_percentage?: number | null
          id?: string
          last_updated?: string
          late_count?: number | null
          present_count?: number | null
          rank_position?: number | null
          student_id: string
          teacher_id: string
          total_classes?: number | null
        }
        Update: {
          absent_count?: number | null
          attendance_percentage?: number | null
          id?: string
          last_updated?: string
          late_count?: number | null
          present_count?: number | null
          rank_position?: number | null
          student_id?: string
          teacher_id?: string
          total_classes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_rankings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_rankings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_scores: {
        Row: {
          attendance_points: number | null
          class_rank: number | null
          created_at: string
          id: string
          reward_penalty_points: number | null
          student_id: string
          teacher_id: string
          total_score: number | null
          updated_at: string
        }
        Insert: {
          attendance_points?: number | null
          class_rank?: number | null
          created_at?: string
          id?: string
          reward_penalty_points?: number | null
          student_id: string
          teacher_id: string
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          attendance_points?: number | null
          class_rank?: number | null
          created_at?: string
          id?: string
          reward_penalty_points?: number | null
          student_id?: string
          teacher_id?: string
          total_score?: number | null
          updated_at?: string
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
          created_at: string
          email: string | null
          group_id: string | null
          group_name: string
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          student_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          group_id?: string | null
          group_name: string
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          student_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          group_id?: string | null
          group_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          student_id?: string | null
          teacher_id?: string
          updated_at?: string
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
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          school: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          school: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          school?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_attendance_points: {
        Args: { p_student_id: string; p_teacher_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
