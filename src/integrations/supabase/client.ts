import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

const SUPABASE_URL = "https://ynothcoqcdkrfalxfwjj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "SUA_CHAVE_AQUI";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
