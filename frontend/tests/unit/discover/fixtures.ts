import type { CatalogItem, ItemsResponse } from "@/lib/catalog";

// a catalog item in the backend's normalized format
export function makeItem(changes: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: null,
    category: "movies",
    provider: "tmdb",
    external_id: "550",
    title: "Fight Club",
    description: "An insomniac and a soap salesman.",
    image_url: "https://image.tmdb.org/t/p/w500/poster.jpg",
    year_or_date: "1999-10-15",
    source_rating: 8.43,
    source_rating_count: 30000,
    community_rating: null,
    community_review_count: 0,
    details: null,
    ...changes,
  };
}

export function makeResponse(
  items: CatalogItem[],
  meta: Partial<ItemsResponse["meta"]> = {},
): ItemsResponse {
  return {
    data: items,
    meta: {
      page: 1,
      page_size: 20,
      total: items.length,
      has_next: false,
      ...meta,
    },
    request_id: "test-request",
  };
}
