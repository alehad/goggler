export function ebaySellerProfileUrl(sellerUserId: string | undefined): string | undefined {
  const seller = sellerUserId?.trim();
  if (!seller) {
    return undefined;
  }

  return `https://www.ebay.co.uk/usr/${encodeURIComponent(seller)}`;
}


export type SellerObservation = {
  itemId: string;
  sellerUserId?: string;
  sellerUsername?: string;
  sellerDisplayName?: string;
  sellerProfileUrl?: string;
};

function usableUsername(value: string | undefined): string | undefined {
  const name = value?.trim();
  return name && name.length <= 64 && !/[\u0000-\u001f\u007f*]/.test(name) ? name : undefined;
}

function usernameEvidence(item: SellerObservation): { name: string; strength: number } | undefined {
  const explicit = usableUsername(item.sellerUsername);
  if (explicit) return { name: explicit, strength: 2 };
  const legacy = usableUsername(item.sellerUserId);
  return legacy && !/^\d+$/.test(legacy) ? { name: legacy, strength: 1 } : undefined;
}

/** Response-local seller identity/display resolution. Evidence must belong to one
 * user's dataset. Only exact-listing co-occurrence establishes an association.
 * Never persist inferred names into raw seller identity fields.
 */
export function resolveSellerDetails<T extends SellerObservation>(rows: readonly T[], evidence: readonly SellerObservation[] = rows): Array<T & { sellerUsername?: string; sellerDisplayName: string; sellerProfileUrl?: string }> {
  const listings = new Map<string, SellerObservation[]>();
  for (const item of evidence) {
    const group = listings.get(item.itemId) ?? [];
    group.push(item); listings.set(item.itemId, group);
  }
  const associations = new Map<string, { strength: number; names: Set<string> }>();
  for (const group of listings.values()) {
    const opaqueIds = new Set(group.filter(item => {
      const id = item.sellerUserId?.trim();
      return id && !id.includes("*") && (!usernameEvidence(item) || (item.sellerUsername && item.sellerUsername.trim() !== id));
    }).map(item => item.sellerUserId!.trim()));
    if (opaqueIds.size > 1) continue;
    const names = group.flatMap(item => { const value = usernameEvidence(item); return value ? [value] : []; });
    for (const id of opaqueIds) {
      for (const value of names) {
        const previous = associations.get(id);
        if (!previous || value.strength > previous.strength) associations.set(id, { strength: value.strength, names: new Set([value.name]) });
        else if (value.strength === previous.strength) previous.names.add(value.name);
      }
    }
  }
  return rows.map(item => {
    const direct = usernameEvidence(item);
    const identity = item.sellerUserId?.trim();
    const associated = identity ? associations.get(identity) : undefined;
    const username = item.sellerUsername ? usableUsername(item.sellerUsername)
      : associated?.names.size === 1 ? [...associated.names][0] : direct?.name;
    return { ...item, sellerUsername: username,
      sellerDisplayName: username ?? (identity ? `Seller ${identity}` : "Unknown seller"),
      sellerProfileUrl: username ? ebaySellerProfileUrl(username) : undefined };
  });
}
