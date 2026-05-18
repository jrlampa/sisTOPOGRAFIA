type PoleLike = {
  nodeChangeFlag?: "existing" | "new" | "remove" | "replace";
  verified?: boolean;
};

export function getBtPoleColor(
  pole: PoleLike,
  isCritical: boolean,
  isPending: boolean,
): string {
  if (isCritical) return "#ef4444";
  if (isPending) return "#f59e0b";

  switch (pole.nodeChangeFlag ?? "existing") {
    case "new":
      return "#22c55e";
    case "replace":
      return "#eab308";
    case "remove":
      return "#f43f5e";
    default:
      return "#0ea5e9";
  }
}

export function getBtPoleFillColor(
  pole: PoleLike,
  isCritical: boolean,
  isLoadCenter: boolean,
): string {
  if (isCritical) return "#fecaca";
  if (isLoadCenter) return "#67e8f9";

  if (pole.verified) return "#86efac";

  switch (pole.nodeChangeFlag ?? "existing") {
    case "new":
      return "#bbf7d0";
    case "replace":
      return "#fde68a";
    case "remove":
      return "#fda4af";
    default:
      return "#bfdbfe";
  }
}
