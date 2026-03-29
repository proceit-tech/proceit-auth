import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { env } from "@/lib/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __proceit_supabase_admin__: SupabaseClient | undefined;
}

type SupabaseAdminClient = SupabaseClient;

/**
 * Cliente administrativo do Supabase (server-side only)
 *
 * IMPORTANTE (arquitetura PROCEIT):
 * - NÃO é usado como auth principal
 * - NÃO depende de sessão do Supabase
 * - NÃO deve ser exposto ao cliente
 *
 * Uso correto:
 * - storage
 * - operações administrativas
 * - suporte a features específicas do Supabase
 * - integrações auxiliares
 */
function createSupabaseAdminClient(): SupabaseAdminClient {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },

      global: {
        headers: {
          "x-client-info": "proceit-auth-runtime",
        },
      },
    }
  );
}

/**
 * Singleton server-side
 * evita recriação de client em cada request (importante no Vercel)
 */
const supabaseAdminClient =
  global.__proceit_supabase_admin__ ?? createSupabaseAdminClient();

if (!env.isProduction) {
  global.__proceit_supabase_admin__ = supabaseAdminClient;
}

/**
 * Getter oficial do client administrativo
 */
export function getSupabaseAdminClient(): SupabaseAdminClient {
  return supabaseAdminClient;
}

/**
 * Health check simples (opcional para Control Tower futuro)
 */
export async function checkSupabaseHealth(): Promise<{
  ok: boolean;
  code: string;
}> {
  try {
    const { error } = await supabaseAdminClient.from("_health").select("*").limit(1);

    if (error) {
      return {
        ok: false,
        code: "SUPABASE_QUERY_ERROR",
      };
    }

    return {
      ok: true,
      code: "SUPABASE_OK",
    };
  } catch {
    return {
      ok: false,
      code: "SUPABASE_UNAVAILABLE",
    };
  }
}