import { createClient } from "@/lib/supabase/server";
import { BottomTabBarClient } from "@/components/bottom-tab-bar-client";

export async function BottomTabBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    isAdmin = Boolean(profile?.is_admin);
  }

  return <BottomTabBarClient isLoggedIn={Boolean(user)} isAdmin={isAdmin} />;
}
