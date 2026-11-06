import { supabase } from "../supabase";

export async function getPortalProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data } = await supabase.from("app_profiles").select("role,is_active").eq("id", session.user.id).maybeSingle();
  return data || null;
}

export async function canModifyRecord(createdAt) {
  const profile = await getPortalProfile();
  if (!profile || !profile.is_active || profile.role === "admin") return true;
  if (!createdAt) return false;
  return new Date(createdAt).getTime() >= Date.now() - (7 * 24 * 60 * 60 * 1000);
}

export function staffWindowMessage() {
  return "Staff account se sirf pichlay 7 din ka record edit/delete ho sakta hai. Purana record Admin account se kholen.";
}
