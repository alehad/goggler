export function ebaySellerProfileUrl(sellerUserId: string | undefined): string | undefined {
  const seller = sellerUserId?.trim();
  if (!seller) {
    return undefined;
  }

  return `https://www.ebay.co.uk/usr/${encodeURIComponent(seller)}`;
}
