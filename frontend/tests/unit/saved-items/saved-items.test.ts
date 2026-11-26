import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import {
  createSavedItem,
  deleteSavedItem,
  getSavedItems,
  resolveCatalogItemId,
  updateSavedItemStatus,
} from "@/lib/saved-items";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

const request = vi.mocked(apiRequest);

const savedItem = {
  id: 31,
  user_id: 7,
  item_id: 12,
  status: "planned" as const,
  saved_at: "2026-11-25T10:00:00Z",
  completed_at: null,
  updated_at: "2026-11-25T10:00:00Z",
  catalog_item: {
    id: 12,
    category: "books" as const,
    provider: "google_books" as const,
    external_id: "book-12",
    title: "Test Book",
    description: null,
    image_url: null,
    year_or_date: "2025",
  },
};

describe("saved-items API helpers", function () {
  beforeEach(function () {
    request.mockReset();
  });

  it("retrieves an array of saved items", async function () {
    request.mockResolvedValue([savedItem]);

    await expect(getSavedItems()).resolves.toEqual([savedItem]);
    expect(request).toHaveBeenCalledWith("/saved-items/");
  });

  it("rejects an unexpected saved-items response", async function () {
    request.mockResolvedValue({ data: [savedItem] });

    await expect(getSavedItems()).rejects.toThrow(
      "The server returned an unexpected saved-items response.",
    );
  });

  it("creates a saved item with the numeric catalog ID", async function () {
    request.mockResolvedValue(savedItem);

    await expect(createSavedItem(12)).resolves.toEqual(savedItem);
    expect(request).toHaveBeenCalledWith("/saved-items/", "POST", {
      item_id: 12,
    });
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects invalid catalog ID %s before making a request",
    async function (itemId) {
      await expect(createSavedItem(itemId)).rejects.toThrow(
        "A valid catalog item ID is required to save this item.",
      );
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("updates by saved-item record ID, not catalog ID", async function () {
    const completed = { ...savedItem, status: "completed" as const };
    request.mockResolvedValue(completed);

    await expect(updateSavedItemStatus(31, "completed")).resolves.toEqual(
      completed,
    );
    expect(request).toHaveBeenCalledWith("/saved-items/31", "PATCH", {
      status: "completed",
    });
  });

  it("deletes by saved-item record ID", async function () {
    request.mockResolvedValue(null);

    await expect(deleteSavedItem(31)).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith("/saved-items/31", "DELETE");
  });

  it("uses an existing positive local catalog ID without a detail request", async function () {
    await expect(resolveCatalogItemId(12, "books", "external-book")).resolves.toBe(
      12,
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("resolves a missing local ID through the category and encoded external ID", async function () {
    request.mockResolvedValue({ data: { id: 44 } });

    await expect(
      resolveCatalogItemId(null, "books", "book/with spaces"),
    ).resolves.toBe(44);
    expect(request).toHaveBeenCalledWith(
      "/items/books/book%2Fwith%20spaces",
    );
  });

  it("rejects a missing external ID without making a request", async function () {
    await expect(resolveCatalogItemId(null, "books", "  ")).rejects.toThrow(
      "This item is missing the information needed to save it.",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it.each([null, 0, -4, 3.2, "44", undefined])(
    "rejects an invalid local ID returned by the detail endpoint: %s",
    async function (id) {
      request.mockResolvedValue({ data: { id } });

      await expect(resolveCatalogItemId(null, "books", "external-book")).rejects.toThrow(
        "The catalog could not provide an internal ID for this item.",
      );
    },
  );
});
