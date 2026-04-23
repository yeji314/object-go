import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api/guards";

export const runtime = "nodejs";

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let out = "";
  const buf = new Uint8Array(12);
  (globalThis.crypto ?? require("crypto").webcrypto).getRandomValues(buf);
  for (let i = 0; i < buf.length; i++) out += chars[buf[i] % chars.length];
  return out;
}

export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,email,phone,created_at")
    .eq("role", "client")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;

  const { name, email, phone } = await req.json();
  if (!name || !email) return NextResponse.json({ error: "name, email 필수" }, { status: 400 });

  const service = createServiceClient();
  const tempPassword = randomPassword();

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name,
      phone: phone || null,
      role: "client",
      must_change_password: true,
    },
  });
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

  // Ensure the profile row is in place (trigger usually handles this; we upsert defensively).
  const uid = created.user?.id;
  if (uid) {
    await service.from("profiles").upsert(
      {
        id: uid,
        email,
        name,
        phone: phone || null,
        role: "client",
      },
      { onConflict: "id" }
    );
  }

  // Also send a password reset email so the user can set their own password from the link.
  const redirectTo = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/set-password`
    : undefined;
  await service.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  return NextResponse.json({ ok: true, user_id: uid, temp_password: tempPassword });
}
