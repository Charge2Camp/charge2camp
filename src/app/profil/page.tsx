import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Caravan, CaravanModel, Vehicle, VehicleModel } from "@/types/database";
import { VehicleForm } from "@/components/profile/vehicle-form";
import { VehicleList } from "@/components/profile/vehicle-list";
import { CaravanForm } from "@/components/profile/caravan-form";
import { CaravanList } from "@/components/profile/caravan-list";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { data: vehicles },
    { data: caravans },
    { data: vehicleModels },
    { data: caravanModels },
  ] = await Promise.all([
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
    supabase
      .from("vehicle_models")
      .select("*")
      .order("manufacturer")
      .order("model")
      .order("variant"),
    supabase
      .from("caravan_models")
      .select("*")
      .order("manufacturer")
      .order("model")
      .order("series"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Mein Profil</h1>
      <p className="mt-2 text-black/60 dark:text-white/60">{user.email}</p>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Elektroauto</h2>
        <div className="mt-4">
          <VehicleList vehicles={(vehicles as Vehicle[]) ?? []} />
        </div>
        <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <VehicleForm models={(vehicleModels as VehicleModel[]) ?? []} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Wohnwagen</h2>
        <div className="mt-4">
          <CaravanList caravans={(caravans as Caravan[]) ?? []} />
        </div>
        <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
          <CaravanForm models={(caravanModels as CaravanModel[]) ?? []} />
        </div>
      </section>
    </div>
  );
}
