export function normalizeAiCode(code: string): string {
  return code.trim().toLowerCase();
}

export type PrimaryCandidate = {
  mapping_id: string;
  is_primary: boolean;
  is_active: boolean;
  sort_order: number;
  createdAt: Date;
};

/** Active primary if present; otherwise the earliest active mapping by sort_order, then createdAt. */
export function selectNextPrimary<T extends PrimaryCandidate>(
  mappings: T[],
): T | undefined {
  const active = mappings.filter((m) => m.is_active);
  const primary = active.find((m) => m.is_primary);
  if (primary) {
    return primary;
  }
  return [...active].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}
