export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      guest_profiles: {
        Row: {
          id: string
          created_at: string
          token: string | null
          api_id: string | null
          name: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          company: string | null
          job_title: string | null
          linkedin_url: string | null
          approval_status: string | null
          profile_pic_url: string | null
          headline: string | null
          summary: string | null
          occupation: string | null
          city: string | null
          state: string | null
          country: string | null
          country_full_name: string | null
          industry: string | null
          follower_count: number | null
          experiences: Json | null
          education: Json | null
          skills: Json | null
          certifications: Json | null
          interests: Json | null
          activities: Json | null
          enriched_at: string | null
          raw_enrichment: Json | null
          slug: string | null
          password: string | null
          survey_completed: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          token?: string | null
          api_id?: string | null
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          company?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          approval_status?: string | null
          profile_pic_url?: string | null
          headline?: string | null
          summary?: string | null
          occupation?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          country_full_name?: string | null
          industry?: string | null
          follower_count?: number | null
          experiences?: Json | null
          education?: Json | null
          skills?: Json | null
          certifications?: Json | null
          interests?: Json | null
          activities?: Json | null
          enriched_at?: string | null
          raw_enrichment?: Json | null
          slug?: string | null
          password?: string | null
          survey_completed?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          token?: string | null
          api_id?: string | null
          name?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          company?: string | null
          job_title?: string | null
          linkedin_url?: string | null
          approval_status?: string | null
          profile_pic_url?: string | null
          headline?: string | null
          summary?: string | null
          occupation?: string | null
          city?: string | null
          state?: string | null
          country?: string | null
          country_full_name?: string | null
          industry?: string | null
          follower_count?: number | null
          experiences?: Json | null
          education?: Json | null
          skills?: Json | null
          certifications?: Json | null
          interests?: Json | null
          activities?: Json | null
          enriched_at?: string | null
          raw_enrichment?: Json | null
          slug?: string | null
          password?: string | null
          survey_completed?: boolean
        }
        Relationships: []
      }
      questions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          previous_question_id: string | null
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          previous_question_id?: string | null
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          previous_question_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_previous_question_id_fkey"
            columns: ["previous_question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      response_answers: {
        Row: {
          answer_text: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_text?: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_text?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          participant_id: string
          transcript: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          participant_id: string
          transcript?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          transcript?: string
        }
        Relationships: [
          {
            foreignKeyName: "responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: true
            referencedRelation: "guest_profiles"
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type GuestProfile = Database["public"]["Tables"]["guest_profiles"]["Row"]
export type Question = Database["public"]["Tables"]["questions"]["Row"]
export type Participant = GuestProfile // backwards compat alias
export type Response = Database["public"]["Tables"]["responses"]["Row"]
export type ResponseAnswer =
  Database["public"]["Tables"]["response_answers"]["Row"]
