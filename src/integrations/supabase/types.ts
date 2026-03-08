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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ativo: boolean
          criado_em: string
          encerrado_em: string | null
          encerrado_motivo: string | null
          encerrado_por: string | null
          id: string
          origem_wave_id: string | null
          place_id: string
          reinteracao_permitida_em: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          encerrado_em?: string | null
          encerrado_motivo?: string | null
          encerrado_por?: string | null
          id?: string
          origem_wave_id?: string | null
          place_id: string
          reinteracao_permitida_em?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          encerrado_em?: string | null
          encerrado_motivo?: string | null
          encerrado_por?: string | null
          id?: string
          origem_wave_id?: string | null
          place_id?: string
          reinteracao_permitida_em?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_origem_wave_id_fkey"
            columns: ["origem_wave_id"]
            isOneToOne: false
            referencedRelation: "waves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intentions: {
        Row: {
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      interest_categories: {
        Row: {
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      interests: {
        Row: {
          category_id: string
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          category_id: string
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "interest_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          criado_em: string
          criado_por: string | null
          id: string
          latitude: number
          longitude: number
          nome: string
          raio: number
          status_aprovacao: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          latitude: number
          longitude: number
          nome: string
          raio?: number
          status_aprovacao?: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          latitude?: number
          longitude?: number
          nome?: string
          raio?: number
          status_aprovacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          conteudo: string
          conversation_id: string
          criado_em: string
          id: string
          sender_id: string
        }
        Insert: {
          conteudo: string
          conversation_id: string
          criado_em?: string
          id?: string
          sender_id: string
        }
        Update: {
          conteudo?: string
          conversation_id?: string
          criado_em?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string | null
          cidade: string | null
          created_by: string | null
          criado_em: string
          dados_brutos: Json | null
          endereco: string | null
          estado: string | null
          expires_at: string | null
          id: string
          is_temporary: boolean
          latitude: number
          longitude: number
          nome: string
          origem: string
          pais: string | null
          provider: string
          provider_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          cidade?: string | null
          created_by?: string | null
          criado_em?: string
          dados_brutos?: Json | null
          endereco?: string | null
          estado?: string | null
          expires_at?: string | null
          id?: string
          is_temporary?: boolean
          latitude: number
          longitude: number
          nome: string
          origem?: string
          pais?: string | null
          provider?: string
          provider_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          cidade?: string | null
          created_by?: string | null
          criado_em?: string
          dados_brutos?: Json | null
          endereco?: string | null
          estado?: string | null
          expires_at?: string | null
          id?: string
          is_temporary?: boolean
          latitude?: number
          longitude?: number
          nome?: string
          origem?: string
          pais?: string | null
          provider?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presence: {
        Row: {
          assunto_atual: string | null
          ativo: boolean
          checkin_selfie_created_at: string | null
          checkin_selfie_url: string | null
          confirmed_at: string | null
          disponivel: boolean
          disponivel_desde: string | null
          disponivel_expira_em: string | null
          id: string
          inicio: string
          intention_id: string
          is_confirmed: boolean
          location_id: string | null
          place_id: string | null
          selfie_provided: boolean | null
          selfie_source: string | null
          ultima_atividade: string
          user_id: string
        }
        Insert: {
          assunto_atual?: string | null
          ativo?: boolean
          checkin_selfie_created_at?: string | null
          checkin_selfie_url?: string | null
          confirmed_at?: string | null
          disponivel?: boolean
          disponivel_desde?: string | null
          disponivel_expira_em?: string | null
          id?: string
          inicio?: string
          intention_id: string
          is_confirmed?: boolean
          location_id?: string | null
          place_id?: string | null
          selfie_provided?: boolean | null
          selfie_source?: string | null
          ultima_atividade?: string
          user_id: string
        }
        Update: {
          assunto_atual?: string | null
          ativo?: boolean
          checkin_selfie_created_at?: string | null
          checkin_selfie_url?: string | null
          confirmed_at?: string | null
          disponivel?: boolean
          disponivel_desde?: string | null
          disponivel_expira_em?: string | null
          id?: string
          inicio?: string
          intention_id?: string
          is_confirmed?: boolean
          location_id?: string | null
          place_id?: string | null
          selfie_provided?: boolean | null
          selfie_source?: string | null
          ultima_atividade?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_intention_id_fkey"
            columns: ["intention_id"]
            isOneToOne: false
            referencedRelation: "intentions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          atualizado_em: string
          bio: string | null
          criado_em: string
          data_nascimento: string | null
          foto_url: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          nome: string | null
        }
        Insert: {
          atualizado_em?: string
          bio?: string | null
          criado_em?: string
          data_nascimento?: string | null
          foto_url?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          nome?: string | null
        }
        Update: {
          atualizado_em?: string
          bio?: string | null
          criado_em?: string
          data_nascimento?: string | null
          foto_url?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_user_id: string
          criado_em: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          criado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          criado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_interests: {
        Row: {
          interest_id: string
          user_id: string
        }
        Insert: {
          interest_id: string
          user_id: string
        }
        Update: {
          interest_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "interests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mutes: {
        Row: {
          criado_em: string
          expira_em: string
          id: string
          muted_user_id: string
          place_id: string | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          expira_em?: string
          id?: string
          muted_user_id: string
          place_id?: string | null
          user_id: string
        }
        Update: {
          criado_em?: string
          expira_em?: string
          id?: string
          muted_user_id?: string
          place_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mutes_muted_user_id_fkey"
            columns: ["muted_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mutes_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waves: {
        Row: {
          accepted_by: string | null
          criado_em: string
          de_user_id: string
          expires_at: string | null
          id: string
          ignore_cooldown_until: string | null
          ignored_at: string | null
          location_id: string | null
          para_user_id: string
          place_id: string | null
          status: string
          visualizado: boolean
        }
        Insert: {
          accepted_by?: string | null
          criado_em?: string
          de_user_id: string
          expires_at?: string | null
          id?: string
          ignore_cooldown_until?: string | null
          ignored_at?: string | null
          location_id?: string | null
          para_user_id: string
          place_id?: string | null
          status?: string
          visualizado?: boolean
        }
        Update: {
          accepted_by?: string | null
          criado_em?: string
          de_user_id?: string
          expires_at?: string | null
          id?: string
          ignore_cooldown_until?: string | null
          ignored_at?: string | null
          location_id?: string | null
          para_user_id?: string
          place_id?: string | null
          status?: string
          visualizado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "waves_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waves_de_user_id_fkey"
            columns: ["de_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waves_para_user_id_fkey"
            columns: ["para_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waves_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_wave: {
        Args: { p_user_id: string; p_wave_id: string }
        Returns: string
      }
      activate_presence: {
        Args: {
          p_assunto_atual?: string
          p_intention_id: string
          p_place_id: string
          p_user_id: string
        }
        Returns: string
      }
      block_user: {
        Args: { p_blocked_user_id: string; p_user_id: string }
        Returns: undefined
      }
      can_auto_end_presence: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: boolean
      }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      cleanup_expired_presences: { Args: never; Returns: number }
      close_conversations_without_presence: { Args: never; Returns: undefined }
      confirm_presence: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: boolean
      }
      end_conversation: {
        Args: {
          p_conversation_id: string
          p_motivo?: string
          p_user_id: string
        }
        Returns: undefined
      }
      end_presence_cascade:
        | {
            Args: { p_place_id: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: { p_motivo?: string; p_place_id: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_force?: boolean
              p_motivo?: string
              p_place_id: string
              p_user_id: string
            }
            Returns: undefined
          }
      find_nearby_temporary_places: {
        Args: { radius_meters?: number; user_lat: number; user_lng: number }
        Returns: {
          active_users: number
          distance_meters: number
          id: string
          nome: string
        }[]
      }
      get_active_mute_for_pair: {
        Args: { p_muted_user_id: string; p_user_id: string }
        Returns: string
      }
      get_user_active_location_id: { Args: never; Returns: string }
      get_user_active_place_id: { Args: never; Returns: string }
      get_users_at_place_feed: {
        Args: { p_place_id: string; p_user_id: string }
        Returns: {
          assunto_atual: string
          bio: string
          checkin_selfie_url: string
          data_nascimento: string
          foto_url: string
          intention_id: string
          interests: string[]
          mutual_interests: string[]
          nome: string
          presence_inicio: string
          user_id: string
        }[]
      }
      is_user_blocked: {
        Args: { p_other_user_id: string; p_user_id: string }
        Returns: boolean
      }
      is_user_muted: {
        Args: { p_other_user_id: string; p_user_id: string }
        Returns: boolean
      }
      log_action: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: undefined
      }
      mute_user: {
        Args: {
          p_muted_user_id: string
          p_place_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      send_wave: {
        Args: {
          p_from_user_id: string
          p_place_id: string
          p_to_user_id: string
        }
        Returns: string
      }
      unblock_user: {
        Args: { p_blocked_user_id: string; p_user_id: string }
        Returns: undefined
      }
      unmute_user: {
        Args: { p_muted_user_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      gender_type:
        | "man"
        | "woman"
        | "non_binary"
        | "trans_man"
        | "trans_woman"
        | "agender"
        | "genderfluid"
        | "prefer_not_to_say"
        | "other"
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
      gender_type: [
        "man",
        "woman",
        "non_binary",
        "trans_man",
        "trans_woman",
        "agender",
        "genderfluid",
        "prefer_not_to_say",
        "other",
      ],
    },
  },
} as const
