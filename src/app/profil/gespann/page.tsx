import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Caravan, CaravanModel, Vehicle, VehicleModel } from "@/types/database";
import { VehicleForm } from "@/components/profile/vehicle-form";
import { VehicleList } from "@/components/profile/vehicle-list";
import { CaravanForm } from "@/components/profile/caravan-form";
import { CaravanList } from "@/components/profile/caravan-list";
import { CollapsibleFormSection } from "@/components/collapsible-form-section";
import { DefaultGespannPicker } from "@/components/profile/default-gespann-picker";
import { PreferredProvidersForm } from "@/components/profile/preferred-providers-form";

export default async function GespannPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: vehicles }, { data: caravans }, { data: vehicleModels }, { data: caravanModels }, { data: profile }] =
    await Promise.all([
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
      supabase
        .from("profiles")
        .select("default_vehicle_id, default_caravan_id, preferred_charging_providers, avoided_charging_providers")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const vehicleList = (vehicles as Vehicle[]) ?? [];
  const caravanList = (caravans as Caravan[]) ?? [];
  const vehicleModelList = (vehicleModels as VehicleModel[]) ?? [];
  const caravanModelList = (caravanModels as CaravanModel[]) ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold">Mein Gespann</h2>

      <div className="mt-6 flex flex-col gap-12">
        <DefaultGespannPicker
          vehicles={vehicleList}
          caravans={caravanList}
          initialVehicleId={profile?.default_vehicle_id ?? ""}
          initialCaravanId={profile?.default_caravan_id ?? ""}
        />

        <section>
          <h3 className="font-semibold">Elektroauto</h3>
          <div className="mt-4">
            <VehicleList vehicles={vehicleList} models={vehicleModelList} />
          </div>
          <CollapsibleFormSection addLabel="Elektroauto hinzufügen" defaultOpen={vehicleList.length === 0}>
            <VehicleForm models={vehicleModelList} />
          </CollapsibleFormSection>
        </section>

        <section>
          <h3 className="font-semibold">Wohnwagen</h3>
          <div className="mt-4">
            <CaravanList caravans={caravanList} models={caravanModelList} />
          </div>
          <CollapsibleFormSection addLabel="Wohnwagen hinzufügen" defaultOpen={caravanList.length === 0}>
            <CaravanForm models={caravanModelList} />
          </CollapsibleFormSection>
        </section>

        <section>
          <h3 className="font-semibold">Anbieter priorisieren oder ausschließen</h3>
          <p className="-mt-1 text-sm text-black/60 dark:text-white/60">
            Wird im Routenplaner als Standardauswahl für den Anbieter-Filter verwendet. Bevorzugte
            Anbieter werden vorgezogen, vermiedene Anbieter werden nie als Ladestopp vorgeschlagen.
          </p>
          <div className="mt-4">
            <PreferredProvidersForm
              initialPreferred={profile?.preferred_charging_providers ?? []}
              initialAvoided={profile?.avoided_charging_providers ?? []}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
