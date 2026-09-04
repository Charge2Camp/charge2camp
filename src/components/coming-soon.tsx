export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-black/60 dark:text-white/60">
        Dieser Bereich wird in {phase} des eCamper-MVP umgesetzt.
      </p>
    </div>
  );
}
