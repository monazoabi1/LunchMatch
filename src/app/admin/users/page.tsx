import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guard";
import { DEMO_MODE } from "@/lib/demo/flag";
import AdminUsersClient from "@/components/admin/AdminUsersClient";

export default async function AdminUsersPage() {
  // Demo mode has no real accounts to manage.
  if (DEMO_MODE) redirect("/lunch");

  const supabase = await createClient();
  const ctx = await requireAdmin(supabase);
  if (!ctx) redirect("/lunch"); // middleware also blocks; belt and suspenders

  return <AdminUsersClient adminName={ctx.profile.display_name} />;
}
