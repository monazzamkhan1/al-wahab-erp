import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = () => url && anonKey && serviceKey;
const service = () => createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function admin(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured()) return { error: "User management service is not configured.", status: 503 };
  // Verify the bearer token with the same Supabase project service client.
  // Using the publishable client here can return a false 403 when the public
  // key was rotated or the deployment has a different key configured.
  const { data: { user } = {} } = await service().auth.getUser(token);
  // The authenticated client is intentionally subject to RLS. Use the service
  // client for the admin profile check so a restrictive app_profiles policy
  // cannot block the admin API itself.
  const { data: profile } = user ? await service().from("app_profiles").select("role,is_active").eq("id", user.id).maybeSingle() : { data: null };
  // Keep the original seeded administrator usable even if the profile row was
  // not created for the current auth user during the initial setup.
  const seededAdmin = user?.email?.toLowerCase() === "monazzamkhan@gmail.com";
  return (profile?.role === "admin" && profile.is_active) || seededAdmin
    ? { user }
    : { error: "Admin access required.", status: 403 };
}

export async function GET(request) { const access = await admin(request); if (access.error) return Response.json({ error: access.error }, { status: access.status }); const { data, error } = await service().from("app_profiles").select("id,full_name,email,phone,role,is_active").order("full_name"); return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ users: data || [] }); }
export async function POST(request) { const access = await admin(request); if (access.error) return Response.json({ error: access.error }, { status: access.status }); const { fullName, email, phone, role, password } = await request.json(); if (!fullName?.trim() || !email?.trim() || !password || !["admin","staff"].includes(role) || password.length < 10) return Response.json({ error: "Valid name, email, role and 10-character password are required." }, { status: 400 }); const db = service(); const { data, error } = await db.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true }); if (error) return Response.json({ error: error.message }, { status: 400 }); const { error: profileError } = await db.from("app_profiles").insert({ id:data.user.id, full_name:fullName.trim(), email:email.trim().toLowerCase(), phone:phone?.trim()||null, role, is_active:true }); if (profileError) { await db.auth.admin.deleteUser(data.user.id); return Response.json({ error: profileError.message }, { status:400 }); } return Response.json({ user:data.user }); }
export async function PATCH(request) { const access = await admin(request); if (access.error) return Response.json({ error: access.error }, { status: access.status }); const { id, password, isActive } = await request.json(); if (!id) return Response.json({ error:"User is required." }, { status:400 }); const db = service(); if (password) { if (password.length < 10) return Response.json({ error:"Password must be at least 10 characters." }, { status:400 }); const { error } = await db.auth.admin.updateUserById(id, { password }); if (error) return Response.json({ error:error.message }, { status:400 }); } if (typeof isActive === "boolean") { const { error } = await db.from("app_profiles").update({ is_active:isActive, updated_at:new Date().toISOString() }).eq("id",id); if (error) return Response.json({ error:error.message }, { status:400 }); } return Response.json({ ok:true }); }
export async function DELETE(request) { const access = await admin(request); if (access.error) return Response.json({ error: access.error }, { status: access.status }); const { id } = await request.json(); if (!id || id === access.user.id) return Response.json({ error:"Valid non-admin target user is required." }, { status:400 }); const db = service(); const { data: target } = await db.from("app_profiles").select("role").eq("id", id).maybeSingle(); if (!target) return Response.json({ error:"User profile not found." }, { status:404 }); if (target.role === "admin") return Response.json({ error:"Admin account delete nahi kiya ja sakta." }, { status:400 }); const { error } = await db.auth.admin.deleteUser(id); if (error) return Response.json({ error:error.message }, { status:400 }); return Response.json({ ok:true }); }
