import { redirect } from "next/navigation";

import {
  requireAuthenticated,
  requireTenantContext,
} from "@/lib/auth/guards";

export default async function RootEntryPage() {
  await requireAuthenticated();
  await requireTenantContext();

  redirect("/app");
}