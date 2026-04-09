import { redirect } from "next/navigation";

import {
  requireAuthenticated,
  requireTenantContext,
} from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootEntryPage() {
  await requireAuthenticated();
  await requireTenantContext();

  redirect("/app");
}