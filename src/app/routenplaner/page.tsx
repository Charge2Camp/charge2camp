import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Caravan, Vehicle } from "@/types/database";
import { RoutePlannerForm } from "@/components/routing/route-planner-form";

export default async function RoutePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ savedRouteId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { savedRouteId } = await searchParams;

  const [{ data: vehicles }, { data: caravans }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("caravans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Routenplaner</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Route mit anhängertauglichen Ladestopps für dein Gespann planen.
      </p>

      <div className="mt-8">
        <RoutePlannerForm
          vehicles={(vehicles as Vehicle[]) ?? []}
          caravans={(caravans as Caravan[]) ?? []}
          initialSavedRouteId={savedRouteId}
        />
      </div>
    </div>
  );
}
