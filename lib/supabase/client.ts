import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types"

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient<Database>(url, key)
}
