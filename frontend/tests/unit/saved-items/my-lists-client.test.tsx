import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyListsClient from "@/components/my-lists-client";
import {
  deleteSavedItem,
  getSavedItems,
  updateSavedItemStatus,
  type SavedItem,
} from "@/lib/saved-items";

vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => <img {...props} />,
}));

vi.mock("@/lib/saved-items", () => ({
  deleteSavedItem: vi.fn(),
  getSavedItems: vi.fn(),
  updateSavedItemStatus: vi.fn(),
}));

const getItems = vi.mocked(getSavedItems);
const updateItem = vi.mocked(updateSavedItemStatus);
const deleteItem = vi.mocked(deleteSavedItem);

function makeSavedItem(
  id: number,
  status: "planned" | "completed" = "planned",
): SavedItem {
  return {
    id,
    user_id: 7,
    item_id: id + 100,
    status,
    saved_at: "2026-11-25T10:00:00Z",
    completed_at: status === "completed" ? "2026-11-25T11:00:00Z" : null,
    updated_at: "2026-11-25T11:00:00Z",
    catalog_item: {
      id: id + 100,
      category: "books",
      provider: "google_books",
      external_id: `book-${id}`,
      title: `Test Book ${id}`,
      description: "A description for the test book.",
      image_url: null,
      year_or_date: "2025",
    },
  };
}

describe("MyListsClient", function () {
  beforeEach(function () {
    getItems.mockReset();
    updateItem.mockReset();
    deleteItem.mockReset();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  });

  it("loads planned items, displays counts, and shows catalog details", async function () {
    getItems.mockResolvedValue([makeSavedItem(1), makeSavedItem(2, "completed")]);

    render(<MyListsClient />);

    expect(await screen.findByRole("heading", { name: "Test Book 1" })).toBeVisible();
    expect(screen.getByText("A description for the test book.")).toBeVisible();
    expect(screen.getByText("Planned (1)")).toBeVisible();
    expect(screen.getByText("Completed (1)")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Test Book 2" })).not.toBeInTheDocument();
  });

  it("shows the empty Planned state", async function () {
    getItems.mockResolvedValue([]);

    render(<MyListsClient />);

    expect(await screen.findByRole("heading", { name: "No planned items yet" })).toBeVisible();
    expect(screen.getByText("Items you save will appear here.")).toBeVisible();
  });

  it("shows the Completed list after selecting its tab", async function () {
    getItems.mockResolvedValue([makeSavedItem(1), makeSavedItem(2, "completed")]);

    render(<MyListsClient />);
    await screen.findByRole("heading", { name: "Test Book 1" });
    await userEvent.click(screen.getByRole("tab", { name: "Completed (1)" }));

    expect(screen.getByRole("heading", { name: "Test Book 2" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Test Book 1" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Completed (1)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("moves a planned item to Completed using the saved-item record ID", async function () {
    const planned = makeSavedItem(1);
    const completed = makeSavedItem(1, "completed");
    getItems.mockResolvedValue([planned]);
    updateItem.mockResolvedValue(completed);

    render(<MyListsClient />);
    await screen.findByRole("heading", { name: "Test Book 1" });
    await userEvent.click(screen.getByRole("button", { name: "Mark as Completed" }));

    await waitFor(function () {
      expect(updateItem).toHaveBeenCalledWith(1, "completed");
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Item moved to Completed.",
    );
    expect(screen.getByText("Planned (0)")).toBeVisible();
    expect(screen.getByText("Completed (1)")).toBeVisible();
  });

  it("moves a completed item back to Planned", async function () {
    const completed = makeSavedItem(2, "completed");
    getItems.mockResolvedValue([completed]);
    updateItem.mockResolvedValue(makeSavedItem(2, "planned"));

    render(<MyListsClient />);
    await userEvent.click(await screen.findByRole("tab", { name: "Completed (1)" }));
    await userEvent.click(screen.getByRole("button", { name: "Move to Planned" }));

    expect(updateItem).toHaveBeenCalledWith(2, "planned");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Item moved to Planned.",
    );
  });

  it("removes a saved item after confirmation using its saved-item record ID", async function () {
    getItems.mockResolvedValue([makeSavedItem(5)]);
    deleteItem.mockResolvedValue(undefined);

    render(<MyListsClient />);
    await screen.findByRole("heading", { name: "Test Book 5" });
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(deleteItem).toHaveBeenCalledWith(5);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Item removed from your lists.",
    );
    expect(screen.getByRole("heading", { name: "No planned items yet" })).toBeVisible();
  });

  it("does not delete when the user cancels confirmation", async function () {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    getItems.mockResolvedValue([makeSavedItem(5)]);

    render(<MyListsClient />);
    await screen.findByRole("heading", { name: "Test Book 5" });
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Test Book 5" })).toBeVisible();
  });

  it("shows a load error and retries successfully", async function () {
    getItems
      .mockRejectedValueOnce(new Error("Could not load saved items"))
      .mockResolvedValueOnce([makeSavedItem(9)]);

    render(<MyListsClient />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load saved items",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Test Book 9" })).toBeVisible();
    expect(getItems).toHaveBeenCalledTimes(2);
  });

  it("shows an update error and leaves the item in the current list", async function () {
  getItems.mockResolvedValue([makeSavedItem(3)]);
  updateItem.mockRejectedValue(new Error("Update failed"));

  render(<MyListsClient />);

  await screen.findByRole("heading", { name: "Test Book 3" });

  await userEvent.click(
    screen.getByRole("button", { name: "Mark as Completed" }),
  );

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Update failed",
  );

  expect(
    screen.getByRole("heading", { name: "Test Book 3" }),
  ).toBeVisible();

  expect(screen.getByText("Planned (1)")).toBeVisible();
  expect(screen.getByText("Completed (0)")).toBeVisible();

  expect(
    screen.getByRole("button", { name: "Mark as Completed" }),
  ).toBeVisible();
});

  it("shows a delete error and keeps the item visible", async function () {
    getItems.mockResolvedValue([makeSavedItem(4)]);
    deleteItem.mockRejectedValue(new Error("Delete failed"));

    render(<MyListsClient />);
    await screen.findByRole("heading", { name: "Test Book 4" });
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Delete failed");
    expect(screen.getByRole("heading", { name: "Test Book 4" })).toBeVisible();
  });

  it("renders a fallback when catalog information is unavailable", async function () {
    const missingCatalog = { ...makeSavedItem(6), catalog_item: null } as unknown as SavedItem;
    getItems.mockResolvedValue([missingCatalog]);

    render(<MyListsClient />);

    expect(
      await screen.findByRole("heading", { name: "Item information unavailable" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove" })).toBeVisible();
  });

  it("shows a placeholder when an item has no image", async function () {
    getItems.mockResolvedValue([makeSavedItem(7)]);

    render(<MyListsClient />);

    expect(await screen.findByRole("img", { name: "No image available" })).toBeVisible();
  });
});
