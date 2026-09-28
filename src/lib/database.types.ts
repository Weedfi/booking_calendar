export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      channels: {
        Row: {
          created_at: string
          ical_url: string
          id: string
          last_sync_error: string | null
          last_synced_at: string | null
          property_id: string
          source: Database["public"]["Enums"]["channel_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ical_url: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          property_id: string
          source: Database["public"]["Enums"]["channel_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ical_url?: string
          id?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          property_id?: string
          source?: Database["public"]["Enums"]["channel_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_stays: {
        Row: {
          created_at: string
          end_date: string
          guest_name: string
          id: string
          property_id: string
          source: Database["public"]["Enums"]["guest_name_source"]
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          guest_name: string
          id?: string
          property_id: string
          source: Database["public"]["Enums"]["guest_name_source"]
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          guest_name?: string
          id?: string
          property_id?: string
          source?: Database["public"]["Enums"]["guest_name_source"]
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_stays_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          booking_property_id: string | null
          booking_room_name: string | null
          color: string
          created_at: string
          id: string
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_property_id?: string | null
          booking_room_name?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_property_id?: string | null
          booking_room_name?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          channel_id: string
          created_at: string
          end_date: string
          external_uid: string
          id: string
          property_id: string
          source: Database["public"]["Enums"]["channel_source"]
          start_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          end_date: string
          external_uid: string
          id?: string
          property_id: string
          source: Database["public"]["Enums"]["channel_source"]
          start_date: string
          status?: Database["public"]["Enums"]["reservation_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          end_date?: string
          external_uid?: string
          id?: string
          property_id?: string
          source?: Database["public"]["Enums"]["channel_source"]
          start_date?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_channel_id_property_id_fkey"
            columns: ["channel_id", "property_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id", "property_id"]
          },
        ]
      }
      sync_events: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          matched_by: Database["public"]["Enums"]["property_match"] | null
          ok: boolean | null
          property_id: string | null
          received_at: string | null
          started_at: string
          trigger: Database["public"]["Enums"]["sync_trigger"]
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: never
          matched_by?: Database["public"]["Enums"]["property_match"] | null
          ok?: boolean | null
          property_id?: string | null
          received_at?: string | null
          started_at?: string
          trigger: Database["public"]["Enums"]["sync_trigger"]
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: never
          matched_by?: Database["public"]["Enums"]["property_match"] | null
          ok?: boolean | null
          property_id?: string | null
          received_at?: string | null
          started_at?: string
          trigger?: Database["public"]["Enums"]["sync_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      channel_source: "booking" | "airbnb" | "other"
      guest_name_source: "manual" | "email" | "import"
      property_match: "booking_id" | "name" | "none"
      reservation_status: "active" | "cancelled"
      sync_trigger: "email" | "cron" | "manual"
      user_role: "admin" | "owner"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      channel_source: ["booking", "airbnb", "other"],
      guest_name_source: ["manual", "email", "import"],
      property_match: ["booking_id", "name", "none"],
      reservation_status: ["active", "cancelled"],
      sync_trigger: ["email", "cron", "manual"],
      user_role: ["admin", "owner"],
    },
  },
} as const

