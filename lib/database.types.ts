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
      account_deletion_requests: {
        Row: {
          cancelled: boolean
          execute_at: string
          executed: boolean
          executed_at: string | null
          id: string
          last_chance_sent: boolean
          requested_at: string
          stripe_account_id: string | null
          stripe_pending_disconnect: boolean
          user_id: string
          user_type: string
        }
        Insert: {
          cancelled?: boolean
          execute_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          last_chance_sent?: boolean
          requested_at?: string
          stripe_account_id?: string | null
          stripe_pending_disconnect?: boolean
          user_id: string
          user_type: string
        }
        Update: {
          cancelled?: boolean
          execute_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          last_chance_sent?: boolean
          requested_at?: string
          stripe_account_id?: string | null
          stripe_pending_disconnect?: boolean
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      app_cache: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      artist_accounts: {
        Row: {
          country: string | null
          created_at: string
          email: string
          id: string
          independence_confirmed: boolean
          independence_confirmed_at: string | null
          self_attest_independent: boolean
          stripe_account_id: string | null
          stripe_onboarded: boolean
          stripe_verified: boolean
          stripe_verified_at: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email: string
          id: string
          independence_confirmed?: boolean
          independence_confirmed_at?: string | null
          self_attest_independent?: boolean
          stripe_account_id?: string | null
          stripe_onboarded?: boolean
          stripe_verified?: boolean
          stripe_verified_at?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          independence_confirmed?: boolean
          independence_confirmed_at?: string | null
          self_attest_independent?: boolean
          stripe_account_id?: string | null
          stripe_onboarded?: boolean
          stripe_verified?: boolean
          stripe_verified_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_accounts_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_posts: {
        Row: {
          artist_id: string
          content: string
          created_at: string
          id: string
          media_url: string | null
          post_type: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          content: string
          created_at?: string
          id?: string
          media_url?: string | null
          post_type: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          content?: string
          created_at?: string
          id?: string
          media_url?: string | null
          post_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_posts_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_recommendations: {
        Row: {
          created_at: string
          id: string
          recommended_id: string
          recommender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recommended_id: string
          recommender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recommended_id?: string
          recommender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_recommendations_recommended_id_fkey"
            columns: ["recommended_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_recommendations_recommender_id_fkey"
            columns: ["recommender_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artists: {
        Row: {
          accent_colour: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          default_currency: string
          first_year_zero_fees: boolean
          first_year_zero_fees_start: string | null
          founding_artist: boolean
          founding_artist_confirmed_at: string | null
          founding_artist_first_sale_at: string | null
          id: string
          milestone_first_sale: boolean
          milestone_first_sale_at: string | null
          milestone_first_sale_shown: boolean
          milestone_first_sale_shown_at: string | null
          name: string
          return_address: Json | null
          search_vector: unknown
          slug: string
          social_links: Json | null
          updated_at: string
        }
        Insert: {
          accent_colour?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          default_currency?: string
          first_year_zero_fees?: boolean
          first_year_zero_fees_start?: string | null
          founding_artist?: boolean
          founding_artist_confirmed_at?: string | null
          founding_artist_first_sale_at?: string | null
          id: string
          milestone_first_sale?: boolean
          milestone_first_sale_at?: string | null
          milestone_first_sale_shown?: boolean
          milestone_first_sale_shown_at?: string | null
          name: string
          return_address?: Json | null
          search_vector?: unknown
          slug: string
          social_links?: Json | null
          updated_at?: string
        }
        Update: {
          accent_colour?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          default_currency?: string
          first_year_zero_fees?: boolean
          first_year_zero_fees_start?: string | null
          founding_artist?: boolean
          founding_artist_confirmed_at?: string | null
          founding_artist_first_sale_at?: string | null
          id?: string
          milestone_first_sale?: boolean
          milestone_first_sale_at?: string | null
          milestone_first_sale_shown?: boolean
          milestone_first_sale_shown_at?: string | null
          name?: string
          return_address?: Json | null
          search_vector?: unknown
          slug?: string
          social_links?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      auth_transfer_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      basket_sessions: {
        Row: {
          created_at: string
          fan_currency: string
          id: string
          items: Json
          ref_code: string | null
        }
        Insert: {
          created_at?: string
          fan_currency?: string
          id?: string
          items: Json
          ref_code?: string | null
        }
        Update: {
          created_at?: string
          fan_currency?: string
          id?: string
          items?: Json
          ref_code?: string | null
        }
        Relationships: []
      }
      broadcast_history: {
        Row: {
          audience_filter: Json
          body_html: string
          body_markdown: string
          completed_at: string | null
          created_at: string
          id: string
          recipient_count: number
          sent_by: string
          status: string
          subject: string
        }
        Insert: {
          audience_filter?: Json
          body_html: string
          body_markdown: string
          completed_at?: string | null
          created_at?: string
          id?: string
          recipient_count?: number
          sent_by: string
          status?: string
          subject: string
        }
        Update: {
          audience_filter?: Json
          body_html?: string
          body_markdown?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          recipient_count?: number
          sent_by?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      broadcast_templates: {
        Row: {
          body_markdown: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_markdown: string
          created_at?: string
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_markdown?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      download_events: {
        Row: {
          created_at: string
          format: string
          id: string
          release_id: string
          track_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          format: string
          id?: string
          release_id: string
          track_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          release_id?: string
          track_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "download_events_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      download_grants: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          max_uses: number
          purchase_id: string
          token: string
          used_count: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          max_uses?: number
          purchase_id: string
          token: string
          used_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          max_uses?: number
          purchase_id?: string
          token?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "download_grants_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_badges: {
        Row: {
          awarded_at: string
          badge_type: string
          id: string
          metadata: Json | null
          release_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_type: string
          id?: string
          metadata?: Json | null
          release_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_type?: string
          id?: string
          metadata?: Json | null
          release_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_badges_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_follows: {
        Row: {
          artist_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_follows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_hidden_purchases: {
        Row: {
          created_at: string
          purchase_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          purchase_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          purchase_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_hidden_purchases_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_pinned_releases: {
        Row: {
          created_at: string
          id: string
          position: number
          release_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          release_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          release_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_pinned_releases_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_preferences: {
        Row: {
          created_at: string
          genre: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          genre: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          genre?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      fan_profiles: {
        Row: {
          accent_colour: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_currency: string | null
          email_unsubscribed: boolean
          first_year_zero_fees: boolean
          first_year_zero_fees_unlocked_at: string | null
          has_seen_welcome: boolean
          id: string
          is_admin: boolean
          is_public: boolean
          locale: string | null
          referral_code: string
          referral_count: number
          referred_by: string | null
          show_collection: boolean
          show_purchase_amounts: boolean
          show_wall: boolean
          stripe_customer_id: string | null
          username: string | null
        }
        Insert: {
          accent_colour?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_currency?: string | null
          email_unsubscribed?: boolean
          first_year_zero_fees?: boolean
          first_year_zero_fees_unlocked_at?: string | null
          has_seen_welcome?: boolean
          id: string
          is_admin?: boolean
          is_public?: boolean
          locale?: string | null
          referral_code: string
          referral_count?: number
          referred_by?: string | null
          show_collection?: boolean
          show_purchase_amounts?: boolean
          show_wall?: boolean
          stripe_customer_id?: string | null
          username?: string | null
        }
        Update: {
          accent_colour?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_currency?: string | null
          email_unsubscribed?: boolean
          first_year_zero_fees?: boolean
          first_year_zero_fees_unlocked_at?: string | null
          has_seen_welcome?: boolean
          id?: string
          is_admin?: boolean
          is_public?: boolean
          locale?: string | null
          referral_code?: string
          referral_count?: number
          referred_by?: string | null
          show_collection?: boolean
          show_purchase_amounts?: boolean
          show_wall?: boolean
          stripe_customer_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      fan_wishlist: {
        Row: {
          created_at: string
          id: string
          release_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          release_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          release_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_wishlist_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          id: string
          release_id: string | null
          track_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          release_id?: string | null
          track_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          release_id?: string | null
          track_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_artists: {
        Row: {
          artist_id: string
          created_at: string
          editorial_note: string | null
          id: string
          week_of: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          editorial_note?: string | null
          id?: string
          week_of: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          editorial_note?: string | null
          id?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      founding_artist_programme: {
        Row: {
          filled_count: number
          id: number
          paused: boolean
          total_spots: number
        }
        Insert: {
          filled_count?: number
          id?: number
          paused?: boolean
          total_spots?: number
        }
        Update: {
          filled_count?: number
          id?: number
          paused?: boolean
          total_spots?: number
        }
        Relationships: []
      }
      merch: {
        Row: {
          artist_id: string
          created_at: string
          currency: string
          description: string
          dispatch_estimate: string
          id: string
          is_active: boolean
          name: string
          photos: Json
          postage: number
          price: number
          stock: number
          updated_at: string
          variants: Json | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          currency?: string
          description: string
          dispatch_estimate?: string
          id?: string
          is_active?: boolean
          name: string
          photos?: Json
          postage: number
          price: number
          stock: number
          updated_at?: string
          variants?: Json | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          currency?: string
          description?: string
          dispatch_estimate?: string
          id?: string
          is_active?: boolean
          name?: string
          photos?: Json
          postage?: number
          price?: number
          stock?: number
          updated_at?: string
          variants?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "merch_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          email: boolean
          id: string
          in_app: boolean
          type: string
          user_id: string
        }
        Insert: {
          email?: boolean
          id?: string
          in_app?: boolean
          type: string
          user_id: string
        }
        Update: {
          email?: boolean
          id?: string
          in_app?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_paid: number
          amount_paid_currency: string
          artist_id: string
          artist_received: number
          artist_received_currency: string
          carrier: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          fan_id: string
          id: string
          merch_id: string
          platform_pence: number
          postage_paid: number
          return_requested_at: string | null
          returned_at: string | null
          shipping_address: Json
          status: string
          stripe_checkout_id: string | null
          stripe_fee_pence: number
          stripe_payment_intent_id: string | null
          tracking_number: string | null
          variant_selected: string | null
        }
        Insert: {
          amount_paid: number
          amount_paid_currency: string
          artist_id: string
          artist_received: number
          artist_received_currency: string
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          fan_id: string
          id?: string
          merch_id: string
          platform_pence: number
          postage_paid: number
          return_requested_at?: string | null
          returned_at?: string | null
          shipping_address: Json
          status?: string
          stripe_checkout_id?: string | null
          stripe_fee_pence?: number
          stripe_payment_intent_id?: string | null
          tracking_number?: string | null
          variant_selected?: string | null
        }
        Update: {
          amount_paid?: number
          amount_paid_currency?: string
          artist_id?: string
          artist_received?: number
          artist_received_currency?: string
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          fan_id?: string
          id?: string
          merch_id?: string
          platform_pence?: number
          postage_paid?: number
          return_requested_at?: string | null
          returned_at?: string | null
          shipping_address?: Json
          status?: string
          stripe_checkout_id?: string | null
          stripe_fee_pence?: number
          stripe_payment_intent_id?: string | null
          tracking_number?: string | null
          variant_selected?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merch_id_fkey"
            columns: ["merch_id"]
            isOneToOne: false
            referencedRelation: "merch"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_events: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          status: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          status: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          stripe_payout_id?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_costs: {
        Row: {
          amount: number
          cost_type: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          related_order_id: string | null
          related_purchase_id: string | null
        }
        Insert: {
          amount: number
          cost_type: string
          created_at?: string
          currency: string
          id?: string
          notes?: string | null
          related_order_id?: string | null
          related_purchase_id?: string | null
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          related_order_id?: string | null
          related_purchase_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_costs_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_costs_related_purchase_id_fkey"
            columns: ["related_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_reports: {
        Row: {
          admin_notes: string | null
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          details: string | null
          id: string
          reported_artist_id: string | null
          reported_fan_id: string | null
          reported_profile_type: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          admin_notes?: string | null
          category: Database["public"]["Enums"]["report_category"]
          created_at?: string
          details?: string | null
          id?: string
          reported_artist_id?: string | null
          reported_fan_id?: string | null
          reported_profile_type: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          details?: string | null
          id?: string
          reported_artist_id?: string | null
          reported_fan_id?: string | null
          reported_profile_type?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profile_reports_reported_artist_id_fkey"
            columns: ["reported_artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_reports_reported_fan_id_fkey"
            columns: ["reported_fan_id"]
            isOneToOne: false
            referencedRelation: "fan_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_pence: number
          artist_id: string
          artist_pence: number
          buyer_email: string
          buyer_user_id: string | null
          created_at: string
          digital_content_consent_at: string | null
          fan_amount: number | null
          fan_currency: string | null
          id: string
          paid_at: string | null
          platform_pence: number
          pre_order: boolean
          release_date: string | null
          release_id: string
          status: string
          stripe_checkout_id: string | null
          stripe_fee_pence: number
          stripe_pi_id: string | null
        }
        Insert: {
          amount_pence: number
          artist_id: string
          artist_pence: number
          buyer_email: string
          buyer_user_id?: string | null
          created_at?: string
          digital_content_consent_at?: string | null
          fan_amount?: number | null
          fan_currency?: string | null
          id?: string
          paid_at?: string | null
          platform_pence: number
          pre_order?: boolean
          release_date?: string | null
          release_id: string
          status?: string
          stripe_checkout_id?: string | null
          stripe_fee_pence?: number
          stripe_pi_id?: string | null
        }
        Update: {
          amount_pence?: number
          artist_id?: string
          artist_pence?: number
          buyer_email?: string
          buyer_user_id?: string | null
          created_at?: string
          digital_content_consent_at?: string | null
          fan_amount?: number | null
          fan_currency?: string | null
          id?: string
          paid_at?: string | null
          platform_pence?: number
          pre_order?: boolean
          release_date?: string | null
          release_id?: string
          status?: string
          stripe_checkout_id?: string | null
          stripe_fee_pence?: number
          stripe_pi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: Database["public"]["Enums"]["rate_limit_action"]
          created_at: string
          id: string
          key: string
        }
        Insert: {
          action: Database["public"]["Enums"]["rate_limit_action"]
          created_at?: string
          id?: string
          key: string
        }
        Update: {
          action?: Database["public"]["Enums"]["rate_limit_action"]
          created_at?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      release_tags: {
        Row: {
          created_at: string
          id: string
          is_custom: boolean
          release_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_custom?: boolean
          release_id: string
          tag: string
        }
        Update: {
          created_at?: string
          id?: string
          is_custom?: boolean
          release_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_tags_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          artist_id: string
          cancelled: boolean
          cover_url: string | null
          created_at: string
          currency: string
          deletion_retain_until: string | null
          description: string | null
          genre: string | null
          id: string
          preorder_enabled: boolean
          price_pence: number
          published: boolean
          pwyw_enabled: boolean
          pwyw_minimum_pence: number | null
          release_date: string | null
          search_vector: unknown
          slug: string
          title: string
          type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          artist_id: string
          cancelled?: boolean
          cover_url?: string | null
          created_at?: string
          currency?: string
          deletion_retain_until?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          preorder_enabled?: boolean
          price_pence: number
          published?: boolean
          pwyw_enabled?: boolean
          pwyw_minimum_pence?: number | null
          release_date?: string | null
          search_vector?: unknown
          slug: string
          title: string
          type: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          artist_id?: string
          cancelled?: boolean
          cover_url?: string | null
          created_at?: string
          currency?: string
          deletion_retain_until?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          preorder_enabled?: boolean
          price_pence?: number
          published?: boolean
          pwyw_enabled?: boolean
          pwyw_minimum_pence?: number | null
          release_date?: string | null
          search_vector?: unknown
          slug?: string
          title?: string
          type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          artist_id: string
          created_at: string
          id: string
          reason: string
          reporter_email: string | null
          status: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_email?: string | null
          status?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_email?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          query: string
          results_count: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          results_count?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          results_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          description: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          description?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      suspicious_activity_flags: {
        Row: {
          created_at: string
          details: Json
          flag_type: Database["public"]["Enums"]["suspicious_flag_type"]
          id: string
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          flag_type: Database["public"]["Enums"]["suspicious_flag_type"]
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          flag_type?: Database["public"]["Enums"]["suspicious_flag_type"]
          id?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          audio_path: string
          created_at: string
          duration_sec: number | null
          id: string
          position: number
          preview_path: string | null
          release_id: string
          title: string
        }
        Insert: {
          audio_path: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          position: number
          preview_path?: string | null
          release_id: string
          title: string
        }
        Update: {
          audio_path?: string
          created_at?: string
          duration_sec?: number | null
          id?: string
          position?: number
          preview_path?: string | null
          release_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          admin_notes: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          id: string
          message: string
          page_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["feedback_status"]
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          category: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          message: string
          page_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          id?: string
          message?: string
          page_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["feedback_status"]
          user_id?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          device: string
          id: string
          ip_display: string
          ip_hash: string
          last_active_at: string
          last_verified_at: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string
          id?: string
          ip_display: string
          ip_hash: string
          last_active_at?: string
          last_verified_at?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string
          id?: string
          ip_display?: string
          ip_hash?: string
          last_active_at?: string
          last_verified_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: number
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: never
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: never
        }
        Relationships: []
      }
      waitlist_overflow: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      webhook_errors: {
        Row: {
          created_at: string
          error: string
          event_id: string | null
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          error: string
          event_id?: string | null
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          error?: string
          event_id?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      release_favourite_counts: {
        Row: {
          release_id: string | null
          save_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "favourites_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      track_favourite_counts: {
        Row: {
          save_count: number | null
          track_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favourites_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_purchase_stats: {
        Args: { since_ts?: string }
        Returns: {
          artist_received: number
          platform_revenue: number
          stripe_fees: number
          total_revenue: number
          total_sales: number
        }[]
      }
      cancel_preorder_release: {
        Args: { target_release_id: string }
        Returns: {
          amount_pence: number
          buyer_email: string
          purchase_id: string
          stripe_pi_id: string
        }[]
      }
      check_rate_limit: {
        Args: {
          p_action: Database["public"]["Enums"]["rate_limit_action"]
          p_key: string
          p_max: number
          p_window: string
        }
        Returns: boolean
      }
      confirm_founding_artist: { Args: { artist_id: string }; Returns: boolean }
      count_distinct_purchasers: { Args: never; Returns: number }
      decrement_merch_stock: { Args: { merch_id: string }; Returns: boolean }
      get_artist_zero_fees: {
        Args: { artist_id: string }
        Returns: {
          fees_start: string
          zero_fees: boolean
        }[]
      }
      get_founding_artist_fee: {
        Args: { p_artist_id: string }
        Returns: {
          first_sale_at: string
          is_founding: boolean
        }[]
      }
      get_user_id_by_email: { Args: { lookup_email: string }; Returns: string }
      get_waitlist_count: { Args: never; Returns: number }
      increment_download_grant: {
        Args: { p_grant_id: string }
        Returns: boolean
      }
      increment_play_count: {
        Args: { is_preview: boolean; track_id: string }
        Returns: undefined
      }
      log_search: {
        Args: { p_query: string; p_results_count: number; p_user_id: string }
        Returns: undefined
      }
      record_referral: {
        Args: { new_user_id: string; referrer_code: string }
        Returns: boolean
      }
      save_fan_preferences: {
        Args: { p_genres: string[]; p_user_id: string }
        Returns: undefined
      }
      search_artists: {
        Args: { max_results?: number; query: string }
        Returns: {
          avatar_url: string
          bio: string
          id: string
          name: string
          rank: number
          release_count: number
          slug: string
        }[]
      }
      search_artists_fuzzy: {
        Args: { max_results?: number; query: string }
        Returns: {
          avatar_url: string
          bio: string
          id: string
          name: string
          rank: number
          release_count: number
          slug: string
        }[]
      }
      search_releases: {
        Args: { max_results?: number; query: string }
        Returns: {
          artist_id: string
          artist_name: string
          artist_slug: string
          cover_url: string
          currency: string
          genre: string
          id: string
          price_pence: number
          rank: number
          slug: string
          title: string
          type: string
        }[]
      }
      search_releases_fuzzy: {
        Args: { max_results?: number; query: string }
        Returns: {
          artist_id: string
          artist_name: string
          artist_slug: string
          cover_url: string
          currency: string
          genre: string
          id: string
          price_pence: number
          rank: number
          slug: string
          title: string
          type: string
        }[]
      }
      set_fan_preferences: {
        Args: { p_genres: string[]; p_user_id: string }
        Returns: undefined
      }
      set_founding_artist_first_sale: {
        Args: { p_artist_id: string; p_sale_at: string }
        Returns: undefined
      }
      set_zero_fees_start: { Args: { artist_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      touch_session: { Args: { p_session_id: string }; Returns: undefined }
      unlock_preorders: {
        Args: never
        Returns: {
          artist_name: string
          buyer_email: string
          release_id: string
          release_title: string
        }[]
      }
      verify_session: { Args: { p_session_id: string }; Returns: undefined }
    }
    Enums: {
      feedback_category: "bug" | "feature_request" | "general"
      feedback_status: "new" | "noted" | "done" | "dismissed"
      payout_status: "paid" | "failed" | "canceled"
      rate_limit_action:
        | "magic_link"
        | "purchase"
        | "signup"
        | "redeem_code"
        | "social_verify"
        | "email_change"
      report_category:
        | "dmca_copyright"
        | "ai_generated_music"
        | "impersonation"
        | "harassment_hate_speech"
        | "spam_scam"
        | "inappropriate_content"
        | "underage_user"
        | "stolen_artwork"
        | "misleading_info"
        | "other"
      report_status: "open" | "resolved" | "dismissed"
      suspicious_flag_type:
        | "high_chargeback_rate"
        | "chargeback_volume"
        | "rapid_transactions"
        | "failed_payouts"
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
      feedback_category: ["bug", "feature_request", "general"],
      feedback_status: ["new", "noted", "done", "dismissed"],
      payout_status: ["paid", "failed", "canceled"],
      rate_limit_action: [
        "magic_link",
        "purchase",
        "signup",
        "redeem_code",
        "social_verify",
        "email_change",
      ],
      report_category: [
        "dmca_copyright",
        "ai_generated_music",
        "impersonation",
        "harassment_hate_speech",
        "spam_scam",
        "inappropriate_content",
        "underage_user",
        "stolen_artwork",
        "misleading_info",
        "other",
      ],
      report_status: ["open", "resolved", "dismissed"],
      suspicious_flag_type: [
        "high_chargeback_rate",
        "chargeback_volume",
        "rapid_transactions",
        "failed_payouts",
      ],
    },
  },
} as const
