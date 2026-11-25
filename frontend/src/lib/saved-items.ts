import { apiRequest } from "@/lib/api";

/** The two states supported by the saved-items API. */
export type SavedItemStatus = "planned" | "completed";

/** Categories supported by the InterestFinder catalog API. */
export type CatalogCategory = "movies" | "books" | "music" | "attractions";
export type CatalogProvider = "tmdb" | "google_books" | "musicbrainz" | "opentripmap";

/** Catalog information now embedded in every saved-item API response. */
export interface SavedCatalogItem {
  id: number;
  category: CatalogCategory;
  provider: CatalogProvider;
  external_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  year_or_date: string | null;
}

/** A saved record returned by GET/POST/PATCH /saved-items/. */
export interface SavedItem {
  id: number;
  user_id: number;
  item_id: number;
  status: SavedItemStatus;
  saved_at: string;
  completed_at: string | null;
  updated_at: string;
  catalog_item: SavedCatalogItem;
}

/** Retrieve the current user's saved items and their catalog summaries. */
export async function getSavedItems(): Promise<SavedItem[]> {
  const result = await apiRequest("/saved-items/");

  if (!Array.isArray(result)) {
    throw new Error("The server returned an unexpected saved-items response.");
  }

  return result as SavedItem[];
}

/** Save an item using its internal numeric catalog ID. */
export async function createSavedItem(itemId: number): Promise<SavedItem> {
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error("A valid catalog item ID is required to save this item.");
  }

  return (await apiRequest("/saved-items/", "POST", {
    item_id: itemId,
  })) as SavedItem;
}

/** Change a saved record to Planned or Completed. */
export async function updateSavedItemStatus(
  savedItemId: number,
  status: SavedItemStatus,
): Promise<SavedItem> {
  return (await apiRequest(`/saved-items/${savedItemId}`, "PATCH", {
    status,
  })) as SavedItem;
}

/** Permanently remove one saved record from the current user's list. */
export async function deleteSavedItem(savedItemId: number): Promise<void> {
  await apiRequest(`/saved-items/${savedItemId}`, "DELETE");
}

/**
 * Resolve an external provider ID to the internal catalog ID required by
 * POST /saved-items/. The detail endpoint stores/returns the local catalog row.
 */
export async function resolveCatalogItemId(
  itemId: number | null | undefined,
  category: CatalogCategory,
  externalId: string,
): Promise<number> {
  if (typeof itemId === "number" && Number.isInteger(itemId) && itemId > 0) {
    return itemId;
  }

  if (!externalId.trim()) {
    throw new Error("This item is missing the information needed to save it.");
  }

  const result = (await apiRequest(
    `/items/${category}/${encodeURIComponent(externalId)}`,
  )) as { data?: { id?: number | null } };

  const resolvedId = result?.data?.id;

  if (typeof resolvedId !== "number" || !Number.isInteger(resolvedId) || resolvedId <= 0) {
    throw new Error("The catalog could not provide an internal ID for this item.");
  }

  return resolvedId;
}
