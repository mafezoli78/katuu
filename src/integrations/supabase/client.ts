import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

const SUPABASE_URL = "https://jhpxfvwhcxakzajioxiz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "COLE_A_ANON_AQUI";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
