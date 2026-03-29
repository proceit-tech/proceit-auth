import { redirect } from "next/navigation";

import { requiresTenantSelection } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/server-context";

export default async function RootEntryPage() {
  const ctx = await getAuthContext();

  if (!ctx?.ok) {
    redirect("/login");
  }

  if (requiresTenantSelection(ctx)) {
    redirect("/select-tenant");
  }

  redirect("/app");
}