import { getReviewState, REVIEW_STATE_COLORS, REVIEW_STATE_LABELS } from "@/lib/trailer-verdict";

export function ReviewStateBadge({ origin, className = "" }: { origin: string | null | undefined; className?: string }) {
  const state = getReviewState(origin);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs text-white ${className}`}
      style={{ backgroundColor: REVIEW_STATE_COLORS[state] }}
    >
      {REVIEW_STATE_LABELS[state]}
    </span>
  );
}
