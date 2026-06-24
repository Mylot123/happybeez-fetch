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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_conversations: {
        Row: {
          agent_id: string
          created_at: string
          elevenlabs_conversation_id: string | null
          ended_at: string | null
          id: string
          started_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          elevenlabs_conversation_id?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          seq: number
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          seq?: number
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          seq?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      book_contents: {
        Row: {
          chapter: string | null
          content: string
          created_at: string
          id: string
          page_number: number | null
          suggested_channels: string[]
          tags: string[]
          title: string
          type: string
          updated_at: string
          used_count: number
          user_id: string
        }
        Insert: {
          chapter?: string | null
          content: string
          created_at?: string
          id?: string
          page_number?: number | null
          suggested_channels?: string[]
          tags?: string[]
          title: string
          type: string
          updated_at?: string
          used_count?: number
          user_id: string
        }
        Update: {
          chapter?: string | null
          content?: string
          created_at?: string
          id?: string
          page_number?: number | null
          suggested_channels?: string[]
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }
      content_calendar_items: {
        Row: {
          canva_link: string | null
          channel: string
          content_text: string | null
          content_type: string | null
          created_at: string
          id: string
          image_storage_path: string | null
          image_url: string | null
          notes: string | null
          publish_date: string | null
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          canva_link?: string | null
          channel: string
          content_text?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          notes?: string | null
          publish_date?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          canva_link?: string | null
          channel?: string
          content_text?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          notes?: string | null
          publish_date?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_book_sections: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          page_start: number | null
          section_number: number
          tags: string[]
          title: string
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          id?: string
          page_start?: number | null
          section_number: number
          tags?: string[]
          title: string
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          page_start?: number | null
          section_number?: number
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_sections_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          source_url: string | null
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          source_url?: string | null
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          source_url?: string | null
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      library_photos: {
        Row: {
          book_id: string | null
          caption: string | null
          created_at: string
          credit: string | null
          height: number | null
          id: string
          image_url: string
          storage_path: string | null
          suggested_channels: string[]
          tags: string[]
          title: string
          width: number | null
        }
        Insert: {
          book_id?: string | null
          caption?: string | null
          created_at?: string
          credit?: string | null
          height?: number | null
          id?: string
          image_url: string
          storage_path?: string | null
          suggested_channels?: string[]
          tags?: string[]
          title: string
          width?: number | null
        }
        Update: {
          book_id?: string | null
          caption?: string | null
          created_at?: string
          credit?: string | null
          height?: number | null
          id?: string
          image_url?: string
          storage_path?: string | null
          suggested_channels?: string[]
          tags?: string[]
          title?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_photos_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          created_at: string
          id: string
          published_at: string | null
          relevance: number | null
          source: string | null
          summary: string | null
          title: string
          updated_at: string
          url: string | null
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          published_at?: string | null
          relevance?: number | null
          source?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          url?: string | null
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          published_at?: string | null
          relevance?: number | null
          source?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_keywords: {
        Row: {
          created_at: string
          current_rank: number | null
          difficulty: number | null
          id: string
          keyword: string
          notes: string | null
          search_volume: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_rank?: number | null
          difficulty?: number | null
          id?: string
          keyword: string
          notes?: string | null
          search_volume?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_rank?: number | null
          difficulty?: number | null
          id?: string
          keyword?: string
          notes?: string | null
          search_volume?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_profiles: {
        Row: {
          active: boolean
          channel: string
          created_at: string
          description: string | null
          handle: string
          id: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          channel: string
          created_at?: string
          description?: string | null
          handle: string
          id?: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          channel?: string
          created_at?: string
          description?: string | null
          handle?: string
          id?: string
          updated_at?: string
          url?: string | null
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
