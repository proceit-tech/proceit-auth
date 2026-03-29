import type { ReactNode } from "react";

import type { RuntimeContext } from "@/lib/auth/runtime-context";
import ProtectedSidebar from "@/components/shell/protected-sidebar";
import ProtectedTopbar from "@/components/shell/protected-topbar";

type Lang = "pt" | "es";

type ProtectedShellProps = {
  lang?: Lang;
  ctx: RuntimeContext;
  children: ReactNode;
};

export default function ProtectedShell({
  lang = "es",
  ctx,
  children,
}: ProtectedShellProps) {
  const hasNavigation = Array.isArray(ctx.navigation) && ctx.navigation.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.09),_transparent_22%),radial-gradient(circle_at_20%_80%,_rgba(14,165,233,0.06),_transparent_20%),linear-gradient(180deg,_#020617_0%,_#030712_45%,_#020617_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />
      <div className="absolute left-0 top-0 h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent opacity-90" />

      <div className="relative flex min-h-screen">
        <ProtectedSidebar lang={lang} items={ctx.navigation} />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <ProtectedTopbar lang={lang} ctx={ctx} />

          <main
            id="protected-main-content"
            role="main"
            className="relative flex-1"
          >
            <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 sm:py-8">
              <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.035] shadow-[0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur-sm">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[hsl(var(--nav-accent))] to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_32%)] pointer-events-none" />

                <div className="relative min-w-0 p-2 sm:p-3 md:p-4">
                  <div className="min-w-0 rounded-[28px] border border-white/8 bg-[#050b17]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {!hasNavigation && ctx.authenticated ? (
                      <div className="border-b border-white/8 px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">
                            {lang === "es" ? "Contexto limitado" : "Contexto limitado"}
                          </span>

                          <span className="text-sm text-white/65">
                            {lang === "es"
                              ? "La navegación aún no está disponible para este contexto activo."
                              : "A navegação ainda não está disponível para este contexto ativo."}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div className="min-w-0 p-4 sm:p-5 md:p-6">
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}