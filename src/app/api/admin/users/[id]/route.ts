import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";
import { generateTempPassword } from "@/lib/auth/password";
import { DEMO_MODE } from "@/lib/demo/flag";

type Action = "disable" | "reactivate" | "reset_password" | "promote" | "demote";

// PATCH /api/admin/users/:id — account actions (admin only).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (DEMO_MODE) return NextResponse.json({ error: "not_available_in_demo" }, { status: 501 });

  const supabase = await createClient();
  const ctx = await requireAdmin(supabase);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const { id } = await params;
  const { action } = (await request.json().catch(() => ({}))) as { action?: Action };
  if (!action) return NextResponse.json({ error: "missing_action" }, { status: 400 });

  // Admins cannot lock themselves out with self-targeting actions.
  if (id === ctx.user.id && action !== "reset_password") {
    return NextResponse.json({ error: "You cannot apply this action to your own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  switch (action) {
    case "disable": {
      // Ban the auth user (blocks new sign-ins) + flag the profile
      // (middleware blocks existing sessions).
      await admin.auth.admin.updateUserById(id, { ban_duration: "87600h" });
      await admin.from("profiles").update({ account_status: "disabled", updated_at: now }).eq("id", id);
      return NextResponse.json({ ok: true });
    }
    case "reactivate": {
      await admin.auth.admin.updateUserById(id, { ban_duration: "none" });
      await admin.from("profiles").update({ account_status: "active", updated_at: now }).eq("id", id);
      return NextResponse.json({ ok: true });
    }
    case "reset_password": {
      const tempPassword = generateTempPassword();
      const { error } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
      if (error) return NextResponse.json({ error: "Could not reset the password." }, { status: 400 });
      await admin
        .from("profiles")
        .update({ must_change_password: true, updated_at: now })
        .eq("id", id);
      const { data: profile } = await admin
        .from("profiles")
        .select("username")
        .eq("id", id)
        .single();
      // Shown once; never stored by the app, never logged.
      return NextResponse.json({ ok: true, username: profile?.username, temp_password: tempPassword });
    }
    case "promote": {
      await admin.from("profiles").update({ role: "admin", updated_at: now }).eq("id", id);
      return NextResponse.json({ ok: true });
    }
    case "demote": {
      await admin.from("profiles").update({ role: "user", updated_at: now }).eq("id", id);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
}

// DELETE /api/admin/users/:id — permanent delete (admin only, UI confirms first).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (DEMO_MODE) return NextResponse.json({ error: "not_available_in_demo" }, { status: 501 });

  const supabase = await createClient();
  const ctx = await requireAdmin(supabase);
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const { id } = await params;
  if (id === ctx.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id); // profile row cascades
  if (error) return NextResponse.json({ error: "Could not delete the account." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
