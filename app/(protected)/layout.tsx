import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getRuntimeContext } from "@/lib/auth/runtime-context";
import ProtectedSidebar from "@/components/shell/protected-sidebar";
import ProtectedTopbar from "@/components/shell/protected-topbar";

type Lang = "es" | "pt";

type Props = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: Props) {
  const lang: Lang = "es";
  const ctx = await getRuntimeContext();

  if (!ctx.authenticated) {
    redirect("/login");
  }

  if (ctx.requiresTenantSelection || !ctx.hasTenantScope || !ctx.activeTenant) {
    redirect("/select-tenant");
  }

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
}