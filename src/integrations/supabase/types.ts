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
          org_id: string
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
          org_id?: string
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
          org_id?: string
          started_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          org_id: string
          role: string
          seq: number
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          org_id?: string
          role: string
          seq?: number
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          org_id?: string
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
          {
            foreignKeyName: "agent_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
          page_number?: number | null
          suggested_channels?: string[]
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
          used_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_contents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_profiles: {
        Row: {
          audience: string | null
          created_at: string
          extra: Json
          id: string
          industry: string | null
          org_id: string
          pillar_mix: Json
          pillars: string[]
          primary_color: string | null
          secondary_color: string | null
          tone: string | null
          updated_at: string
          usps: string[]
          website: string | null
        }
        Insert: {
          audience?: string | null
          created_at?: string
          extra?: Json
          id?: string
          industry?: string | null
          org_id: string
          pillar_mix?: Json
          pillars?: string[]
          primary_color?: string | null
          secondary_color?: string | null
          tone?: string | null
          updated_at?: string
          usps?: string[]
          website?: string | null
        }
        Update: {
          audience?: string | null
          created_at?: string
          extra?: Json
          id?: string
          industry?: string | null
          org_id?: string
          pillar_mix?: Json
          pillars?: string[]
          primary_color?: string | null
          secondary_color?: string | null
          tone?: string | null
          updated_at?: string
          usps?: string[]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_blocks: {
        Row: {
          created_at: string
          hook: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          pillar: string | null
          plan_id: string
          platforms: string[]
          sort_order: number
          updated_at: string
          week: number | null
        }
        Insert: {
          created_at?: string
          hook?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          pillar?: string | null
          plan_id: string
          platforms?: string[]
          sort_order?: number
          updated_at?: string
          week?: number | null
        }
        Update: {
          created_at?: string
          hook?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          pillar?: string | null
          plan_id?: string
          platforms?: string[]
          sort_order?: number
          updated_at?: string
          week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_blocks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_blocks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "campaign_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_plans: {
        Row: {
          created_at: string
          created_by: string | null
          goal: string | null
          id: string
          month: number
          org_id: string
          status: string
          summary: string | null
          theme: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          goal?: string | null
          id?: string
          month: number
          org_id: string
          status?: string
          summary?: string | null
          theme: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          goal?: string | null
          id?: string
          month?: number
          org_id?: string
          status?: string
          summary?: string | null
          theme?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_calendar_items: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          ayrshare_post_id: string | null
          campaign_block_id: string | null
          canva_link: string | null
          channel: string
          content_text: string | null
          content_type: string | null
          created_at: string
          failure_reason: string | null
          hashtags: string[]
          id: string
          image_storage_path: string | null
          image_url: string | null
          last_publish_attempt_at: string | null
          notes: string | null
          org_id: string
          publish_date: string | null
          retry_count: number
          review_notes: string | null
          scheduled_at: string | null
          source_id: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          ayrshare_post_id?: string | null
          campaign_block_id?: string | null
          canva_link?: string | null
          channel: string
          content_text?: string | null
          content_type?: string | null
          created_at?: string
          failure_reason?: string | null
          hashtags?: string[]
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          last_publish_attempt_at?: string | null
          notes?: string | null
          org_id?: string
          publish_date?: string | null
          retry_count?: number
          review_notes?: string | null
          scheduled_at?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          ayrshare_post_id?: string | null
          campaign_block_id?: string | null
          canva_link?: string | null
          channel?: string
          content_text?: string | null
          content_type?: string | null
          created_at?: string
          failure_reason?: string | null
          hashtags?: string[]
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          last_publish_attempt_at?: string | null
          notes?: string | null
          org_id?: string
          publish_date?: string | null
          retry_count?: number
          review_notes?: string | null
          scheduled_at?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_calendar_items_campaign_block_id_fkey"
            columns: ["campaign_block_id"]
            isOneToOne: false
            referencedRelation: "campaign_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_calendar_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_sections: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
          {
            foreignKeyName: "library_book_sections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
          source_url?: string | null
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_books_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
          {
            foreignKeyName: "library_photos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          format: string | null
          height: number | null
          id: string
          meta: Json
          org_id: string
          prompt: string | null
          render_job_id: string | null
          render_status: string
          source: string
          template_id: string | null
          type: string
          updated_at: string
          url: string
          width: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          format?: string | null
          height?: number | null
          id?: string
          meta?: Json
          org_id: string
          prompt?: string | null
          render_job_id?: string | null
          render_status?: string
          source?: string
          template_id?: string | null
          type: string
          updated_at?: string
          url: string
          width?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          format?: string | null
          height?: number | null
          id?: string
          meta?: Json
          org_id?: string
          prompt?: string | null
          render_job_id?: string | null
          render_status?: string
          source?: string
          template_id?: string | null
          type?: string
          updated_at?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          created_at: string
          id: string
          org_id: string
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
          org_id?: string
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
          org_id?: string
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
        Relationships: [
          {
            foreignKeyName: "news_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_metrics: {
        Row: {
          clicks: number
          comments: number
          engagement_rate: number
          id: string
          impressions: number
          likes: number
          org_id: string
          platform: string
          post_id: string
          provider_post_id: string | null
          raw: Json
          reach: number
          recorded_at: string
          saves: number
          shares: number
        }
        Insert: {
          clicks?: number
          comments?: number
          engagement_rate?: number
          id?: string
          impressions?: number
          likes?: number
          org_id: string
          platform: string
          post_id: string
          provider_post_id?: string | null
          raw?: Json
          reach?: number
          recorded_at?: string
          saves?: number
          shares?: number
        }
        Update: {
          clicks?: number
          comments?: number
          engagement_rate?: number
          id?: string
          impressions?: number
          likes?: number
          org_id?: string
          platform?: string
          post_id?: string
          provider_post_id?: string | null
          raw?: Json
          reach?: number
          recorded_at?: string
          saves?: number
          shares?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_calendar_items"
            referencedColumns: ["id"]
          },
        ]
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
      publish_attempts: {
        Row: {
          attempted_at: string
          error: string | null
          id: string
          org_id: string
          platform: string
          post_id: string
          provider: string
          provider_post_id: string | null
          response: Json | null
          status: string
        }
        Insert: {
          attempted_at?: string
          error?: string | null
          id?: string
          org_id: string
          platform: string
          post_id: string
          provider?: string
          provider_post_id?: string | null
          response?: Json | null
          status: string
        }
        Update: {
          attempted_at?: string
          error?: string | null
          id?: string
          org_id?: string
          platform?: string
          post_id?: string
          provider?: string
          provider_post_id?: string | null
          response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "publish_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_attempts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "content_calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_competitor_history: {
        Row: {
          checked_at: string
          competitor_domain: string
          database_code: string
          id: string
          keyword: string
          org_id: string
          position_url: string | null
          rank: number | null
          user_id: string
        }
        Insert: {
          checked_at?: string
          competitor_domain: string
          database_code?: string
          id?: string
          keyword: string
          org_id: string
          position_url?: string | null
          rank?: number | null
          user_id: string
        }
        Update: {
          checked_at?: string
          competitor_domain?: string
          database_code?: string
          id?: string
          keyword?: string
          org_id?: string
          position_url?: string | null
          rank?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_competitor_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_competitors: {
        Row: {
          competitor_domain: string
          created_at: string
          database_code: string
          id: string
          label: string | null
          org_id: string
          own_domain: string
          updated_at: string
          user_id: string
        }
        Insert: {
          competitor_domain: string
          created_at?: string
          database_code?: string
          id?: string
          label?: string | null
          org_id: string
          own_domain: string
          updated_at?: string
          user_id: string
        }
        Update: {
          competitor_domain?: string
          created_at?: string
          database_code?: string
          id?: string
          label?: string | null
          org_id?: string
          own_domain?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_competitors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_domain_snapshots: {
        Row: {
          ai_actions: Json
          competitors: Json | null
          content_gaps: Json
          created_at: string
          database_code: string
          domain: string
          id: string
          org_id: string
          organic_cost: number | null
          organic_keywords: number | null
          organic_traffic: number | null
          page_audit: Json | null
          quick_wins: Json | null
          rank_global: number | null
          soft_error: string | null
          top_keywords: Json | null
          user_id: string
        }
        Insert: {
          ai_actions?: Json
          competitors?: Json | null
          content_gaps?: Json
          created_at?: string
          database_code?: string
          domain: string
          id?: string
          org_id?: string
          organic_cost?: number | null
          organic_keywords?: number | null
          organic_traffic?: number | null
          page_audit?: Json | null
          quick_wins?: Json | null
          rank_global?: number | null
          soft_error?: string | null
          top_keywords?: Json | null
          user_id: string
        }
        Update: {
          ai_actions?: Json
          competitors?: Json | null
          content_gaps?: Json
          created_at?: string
          database_code?: string
          domain?: string
          id?: string
          org_id?: string
          organic_cost?: number | null
          organic_keywords?: number | null
          organic_traffic?: number | null
          page_audit?: Json | null
          quick_wins?: Json | null
          rank_global?: number | null
          soft_error?: string | null
          top_keywords?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_domain_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keyword_history: {
        Row: {
          checked_at: string
          cpc: number | null
          database_code: string
          difficulty: number | null
          domain: string
          id: string
          intent: string | null
          keyword: string
          org_id: string
          position_url: string | null
          rank: number | null
          search_volume: number | null
          serp_features: Json | null
          user_id: string
        }
        Insert: {
          checked_at?: string
          cpc?: number | null
          database_code?: string
          difficulty?: number | null
          domain: string
          id?: string
          intent?: string | null
          keyword: string
          org_id?: string
          position_url?: string | null
          rank?: number | null
          search_volume?: number | null
          serp_features?: Json | null
          user_id: string
        }
        Update: {
          checked_at?: string
          cpc?: number | null
          database_code?: string
          difficulty?: number | null
          domain?: string
          id?: string
          intent?: string | null
          keyword?: string
          org_id?: string
          position_url?: string | null
          rank?: number | null
          search_volume?: number | null
          serp_features?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_keyword_history_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keyword_ideas: {
        Row: {
          competition: number | null
          cpc: number | null
          created_at: string
          database_code: string
          difficulty: number | null
          id: string
          keyword: string
          kind: string
          org_id: string
          search_volume: number | null
          seed: string
          user_id: string
        }
        Insert: {
          competition?: number | null
          cpc?: number | null
          created_at?: string
          database_code?: string
          difficulty?: number | null
          id?: string
          keyword: string
          kind?: string
          org_id?: string
          search_volume?: number | null
          seed: string
          user_id: string
        }
        Update: {
          competition?: number | null
          cpc?: number | null
          created_at?: string
          database_code?: string
          difficulty?: number | null
          id?: string
          keyword?: string
          kind?: string
          org_id?: string
          search_volume?: number | null
          seed?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_keyword_ideas_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_keywords: {
        Row: {
          competition: number | null
          cpc: number | null
          created_at: string
          current_rank: number | null
          database_code: string | null
          difficulty: number | null
          domain: string | null
          id: string
          intent: string | null
          keyword: string
          last_checked_at: string | null
          notes: string | null
          org_id: string
          position_url: string | null
          search_volume: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          competition?: number | null
          cpc?: number | null
          created_at?: string
          current_rank?: number | null
          database_code?: string | null
          difficulty?: number | null
          domain?: string | null
          id?: string
          intent?: string | null
          keyword: string
          last_checked_at?: string | null
          notes?: string | null
          org_id?: string
          position_url?: string | null
          search_volume?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          competition?: number | null
          cpc?: number | null
          created_at?: string
          current_rank?: number | null
          database_code?: string | null
          difficulty?: number | null
          domain?: string | null
          id?: string
          intent?: string | null
          keyword?: string
          last_checked_at?: string | null
          notes?: string | null
          org_id?: string
          position_url?: string | null
          search_volume?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_keywords_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_page_audits: {
        Row: {
          ai_summary: string | null
          created_at: string
          goal: string | null
          h1: string | null
          id: string
          issues: Json | null
          meta_description: string | null
          org_id: string
          recommendations: Json | null
          score: number | null
          target_keyword: string | null
          title: string | null
          url: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          goal?: string | null
          h1?: string | null
          id?: string
          issues?: Json | null
          meta_description?: string | null
          org_id?: string
          recommendations?: Json | null
          score?: number | null
          target_keyword?: string | null
          title?: string | null
          url: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          goal?: string | null
          h1?: string | null
          id?: string
          issues?: Json | null
          meta_description?: string | null
          org_id?: string
          recommendations?: Json | null
          score?: number | null
          target_keyword?: string | null
          title?: string | null
          url?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_audits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          active: boolean
          channel: string
          created_at: string
          description: string | null
          handle: string
          id: string
          org_id: string
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
          org_id?: string
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
          org_id?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      video_templates: {
        Row: {
          aspect_ratio: string
          created_at: string
          creatomate_template_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          thumbnail_url: string | null
          updated_at: string
          variables_schema: Json
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          creatomate_template_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          variables_schema?: Json
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          creatomate_template_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
          variables_schema?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "agency_admin" | "org_admin" | "editor"
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
      app_role: ["agency_admin", "org_admin", "editor"],
    },
  },
} as const
