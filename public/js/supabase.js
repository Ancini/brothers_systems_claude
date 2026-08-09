import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configurações do seu banco de dados
const supabaseUrl = "https://hnaapsbkrokrkmnzayyr.supabase.co";
const supabaseKey = "sb_publishable_AaxUlPsbivnRIu2_iu3Epg_nzr8w-3u"; 

// Exporta a instância pronta para ser usada por qualquer outro arquivo .js do projeto
export const supabase = createClient(supabaseUrl, supabaseKey);