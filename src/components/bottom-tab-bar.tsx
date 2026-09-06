import { createClient } from "@/lib/supabase/server";
import { BottomTabBarClient } from "@/components/bottom-tab-bar-client";

export async function BottomTabBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <BottomTabBarClient isLoggedIn={Boolean(user)} />;
}
