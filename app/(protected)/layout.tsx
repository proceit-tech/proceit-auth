import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getRuntimeContext } from "@/lib/auth/runtime-context";
import ProtectedSidebar from "@/components/shell/protected-sidebar";
import ProtectedTopbar from "@/components/shell/protected-topbar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Lang = "es" | "pt";

type Props = {
  children: ReactNode;
};

/* =========================
   DEBUG HELPERS
========================= */

const LAYOUT_SCOPE = "AUTH_PROTECTED_LAYOUT";

type DebugPayload = Record<string, unknown>;

function buildDebugBase() {
  return {
    ts: new Date().toISOString(),
    scope: LAYOUT_SCOPE,
    env: process.env.NODE_ENV ?? null,
    route: "/app",
  };
}

function layoutLog(step: string, payload?: DebugPayload) {
  console.log(
    JSON.stringify({
      ...buildDebugBase(),
      level: "info",
      step,
      ...(payload ?? {}),
    })
  );
}

function layoutWarn(step: string, payload?: DebugPayload) {
  console.warn(
    JSON.stringify({
      ...buildDebugBase(),
      level: "warn",
      step,
      ...(payload ?? {}),
    })
  );
}

function layoutError(
  step: string,
  error: unknown,
  payload?: DebugPayload
) {
  console.error(
    JSON.stringify({
      ...buildDebugBase(),
      level: "error",
      step,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : {
              value: String(error),
            },
      ...(payload ?? {}),
    })
  );
}

function summarizeRuntimeContext(ctx: Awaited<ReturnType<typeof getRuntimeContext>>) {
  return {
    authenticated: ctx.authenticated,
    sessionId: ctx.sessionId,
    userId: ctx.user?.id ?? null,
    userEmail: ctx.user?.email ?? null,
    userDisplayName: ctx.user?.displayName ?? null,
    activeTenantId: ctx.activeTenant?.id ?? null,
    activeTenantName: ctx.activeTenant?.name ?? null,
    membershipId: ctx.membership?.id ?? null,
    membershipStatus: ctx.membership?.status ?? null,
    membershipRoleCode: ctx.membership?.roleCode ?? null,
    requiresTenantSelection: ctx.requiresTenantSelection,
    hasTenantScope: ctx.hasTenantScope,
    hasMasterAccess: ctx.hasMasterAccess,
    platformRoles: ctx.platformRoles,
    tenantRoles: ctx.tenantRoles,
    permissionsCount: ctx.permissions.length,
    modulesCount: ctx.modules.length,
    navigationFlatCount: ctx.navigationFlat.length,
    navigationCount: ctx.navigation.length,
  };
}

function buildLoginRedirect(reason: string, payload?: DebugPayload): never {
  layoutWarn("buildLoginRedirect.redirecting", {
    redirect_to: "/login",
    reason,
    ...(payload ?? {}),
  });

  /**
   * Regra oficial:
   * - login é o ponto de entrada para sessão inexistente/expirada/inválida;
   * - evitar hardcode agressivo de return_to quando a própria camada de auth
   *   já consegue reconstruir navegação posterior;
   * - reduz acoplamento entre layout protegido e rota pública de entrada.
   */
  redirect("/login");
}

function buildTenantSelectionRedirect(
  reason: string,
  payload?: DebugPayload
): never {
  layoutWarn("buildTenantSelectionRedirect.redirecting", {
    redirect_to: "/select-tenant",
    reason,
    ...(payload ?? {}),
  });

  /**
   * Regra oficial:
   * - sessão válida sem escopo operacional final deve ir para seleção de tenant;
   * - esta rota permanece dentro do domínio protegido do runtime.
   */
  redirect("/select-tenant");
}

export default async function ProtectedLayout({ children }: Props) {
  const lang: Lang = "es";

  layoutLog("ProtectedLayout.start", {
    lang,
  });

  try {
    layoutLog("ProtectedLayout.getRuntimeContext.start");

    const ctx = await getRuntimeContext();

    layoutLog("ProtectedLayout.getRuntimeContext.success", {
      runtime: summarizeRuntimeContext(ctx),
    });

    /**
     * Regra oficial da camada protegida:
     *
     * 1) sem identidade autenticada real -> login
     * 2) com identidade autenticada, porém sem tenant ativo/escopo operacional -> select-tenant
     * 3) com identidade autenticada + tenant ativo + escopo operacional -> render normal
     *
     * Observação importante:
     * - esta camada NÃO deve inventar uma terceira interpretação paralela da auth;
     * - o critério aqui precisa continuar coerente com o runtime oficial;
     * - o middleware deve atuar apenas como barreira leve, nunca como autoridade final.
     */

    /**
     * Etapa 1 — autenticação real.
     *
     * `authenticated` continua sendo a sinalização de que:
     * - a sessão foi resolvida pelo runtime;
     * - a identidade pôde ser carregada;
     * - o contexto mínimo protegido existe.
     *
     * Se isso falhar, o destino correto é login.
     */
    if (!ctx.authenticated) {
      return buildLoginRedirect("ctx.authenticated_false", {
        runtime: summarizeRuntimeContext(ctx),
      });
    }

    /**
     * Etapa 2 — escopo operacional obrigatório.
     *
     * Mesmo com autenticação válida, a operação protegida do hub exige tenant
     * realmente resolvido. Portanto, qualquer um dos sinais abaixo obriga
     * seleção de tenant:
     *
     * - runtime explicitamente pede seleção;
     * - não há tenant scope aplicado;
     * - não há tenant ativo disponível.
     */
    if (
      ctx.requiresTenantSelection ||
      !ctx.hasTenantScope ||
      !ctx.activeTenant
    ) {
      return buildTenantSelectionRedirect("tenant_scope_incomplete", {
        runtime: summarizeRuntimeContext(ctx),
        requiresTenantSelection: ctx.requiresTenantSelection,
        hasTenantScope: ctx.hasTenantScope,
        activeTenantPresent: Boolean(ctx.activeTenant),
      });
    }

    layoutLog("ProtectedLayout.render_allowed", {
      runtime: summarizeRuntimeContext(ctx),
    });

    return (
      <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.09),_transparent_22%),radial-gradient(circle_at_20%_80%,_rgba(14,165,233,0.06),_transparent_20%),linear-gradient(180deg,_#020617_0%,_#030712_45%,_#020617_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />
        <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent opacity-90" />

        <div className="relative flex min-h-screen">
          <ProtectedSidebar lang={lang} items={ctx.navigation} />

          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <ProtectedTopbar lang={lang} ctx={ctx} />

            <main className="flex-1">
              <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 sm:py-8">
                <div className="min-w-0 rounded-[32px] border border-white/10 bg-white/[0.03] p-2 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                  <div className="h-[2px] w-full rounded-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />

                  <div className="min-w-0 p-2 sm:p-3 md:p-4">
                    {children}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    layoutError("ProtectedLayout.fatal_error", error);

    return buildLoginRedirect("layout_fatal_error", {
      fatal: true,
    });
  }
}