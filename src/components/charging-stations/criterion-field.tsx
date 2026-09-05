/** Ja/Nein-Feld fuer ein Bewertungskriterium, das auch unbeantwortet
 * bleiben kann (leer = "keine Angabe", siehe parseOptionalBoolean in den
 * jeweiligen Server-Actions). Gemeinsam genutzt vom Bewertungsformular
 * (neue Bewertung) und der Bearbeiten-Ansicht im Profil. */
export function CriterionField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="mb-1">{label}</legend>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5">
          <input type="radio" name={name} value="yes" checked={value === "yes"} onChange={() => onChange("yes")} />
          Ja
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={name} value="no" checked={value === "no"} onChange={() => onChange("no")} />
          Nein
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={name} value="" checked={value === ""} onChange={() => onChange("")} />
          Weiß nicht
        </label>
      </div>
    </fieldset>
  );
}
