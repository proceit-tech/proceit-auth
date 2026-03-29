import type { ReactNode } from "react";

import { requireTenantContext } from "@/lib/auth/guards";
import ProtectedShell from "@/components/shell/protected-shell";

type Lang = "es" | "pt";

type AppProtectedLayoutProps = {
  children: ReactNode;
};

export default async function AppProtectedLayout({
  children,
}: AppProtectedLayoutProps) {
  const lang: Lang = "es";
  const ctx = await requireTenantContext();

  return (
    <ProtectedShell lang={lang} ctx={ctx}>
      {children}
    </ProtectedShell>
  );
}