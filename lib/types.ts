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
      participants: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          password: string
          slug: string
          survey_completed: boolean
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          password: string
          slug: string
          survey_completed?: boolean
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          password?: string
          slug?: string
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
            referencedRelation: "participants"
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

export type Question = Database["public"]["Tables"]["questions"]["Row"]
export type Participant = Database["public"]["Tables"]["participants"]["Row"]
export type Response = Database["public"]["Tables"]["responses"]["Row"]
export type ResponseAnswer =
  Database["public"]["Tables"]["response_answers"]["Row"]
