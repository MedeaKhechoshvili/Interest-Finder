
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSavedItem,
  getSavedItems,
  resolveCatalogItemId,
} = vi.hoisted(() => ({
  createSavedItem: vi.fn(),
  getSavedItems: vi.fn(),
  resolveCatalogItemId: vi.fn(),
}));

vi.mock("@/lib/saved-items", () => ({
  createSavedItem,
  getSavedItems,
  resolveCatalogItemId,
}));

import SaveButton from "@/components/save-button";

const defaultProps = {
  itemId: 123,
  category: "books" as const,
  externalId: "google-books-123",
};

describe("SaveButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    resolveCatalogItemId.mockResolvedValue(123);
    createSavedItem.mockResolvedValue({
      id: 10,
      user_id: 1,
      item_id: 123,
      status: "planned",
    });
    getSavedItems.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("saves with the resolved local ID and announces success", async () => {
    const user = userEvent.setup();
    const onSavedChange = vi.fn();

    render(
      <SaveButton
        {...defaultProps}
        onSavedChange={onSavedChange}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Save item to My Lists",
      }),
    );

    expect(resolveCatalogItemId).toHaveBeenCalledWith(
      123,
      "books",
      "google-books-123",
    );

    expect(createSavedItem).toHaveBeenCalledWith(123);

    expect(onSavedChange).toHaveBeenCalledWith(true);

    expect(
      await screen.findByText("Added to your Planned list."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Item saved to My Lists",
      }),
    ).toBeDisabled();
  });

  it("supports resolving a null local ID before saving", async () => {
    const user = userEvent.setup();

    resolveCatalogItemId.mockResolvedValue(456);

    render(
      <SaveButton
        {...defaultProps}
        itemId={null}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Save item to My Lists",
      }),
    );

    expect(resolveCatalogItemId).toHaveBeenCalledWith(
      null,
      "books",
      "google-books-123",
    );

    expect(createSavedItem).toHaveBeenCalledWith(456);

    expect(
      await screen.findByText("Added to your Planned list."),
    ).toBeInTheDocument();
  });

  it("treats a duplicate as already saved when it appears in the current list", async () => {
    const user = userEvent.setup();

    createSavedItem.mockRejectedValue(
      new Error("Item already saved"),
    );

    getSavedItems.mockResolvedValue([
      {
        id: 10,
        user_id: 1,
        item_id: 123,
        status: "planned",
      },
    ]);

    render(<SaveButton {...defaultProps} />);

    await user.click(
      screen.getByRole("button", {
        name: "Save item to My Lists",
      }),
    );

    expect(getSavedItems).toHaveBeenCalledOnce();

    expect(
      await screen.findByText("This item is already in your list."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Item saved to My Lists",
      }),
    ).toBeDisabled();
  });

  it("shows the duplicate error if the item is not actually in the returned list", async () => {
    const user = userEvent.setup();

    createSavedItem.mockRejectedValue(
      new Error("Item already saved"),
    );

    getSavedItems.mockResolvedValue([
      {
        id: 11,
        user_id: 1,
        item_id: 999,
        status: "planned",
      },
    ]);

    render(<SaveButton {...defaultProps} />);

    await user.click(
      screen.getByRole("button", {
        name: "Save item to My Lists",
      }),
    );

    expect(
      await screen.findByText("Item already saved"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Save item to My Lists",
      }),
    ).toBeEnabled();
  });

  it("shows a readable error when the save request fails", async () => {
    const user = userEvent.setup();

    createSavedItem.mockRejectedValue(
      new Error("The server is unavailable"),
    );

    render(<SaveButton {...defaultProps} />);

    await user.click(
      screen.getByRole("button", {
        name: "Save item to My Lists",
      }),
    );

    expect(
      await screen.findByText("The server is unavailable"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Save item to My Lists",
      }),
    ).toBeEnabled();
  });

  it("does not allow saving again when the parent says the item is already saved", async () => {
    const user = userEvent.setup();

    render(
      <SaveButton
        {...defaultProps}
        isSaved={true}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Item saved to My Lists",
    });

    expect(button).toBeDisabled();

    await user.click(button);

    expect(resolveCatalogItemId).not.toHaveBeenCalled();
    expect(createSavedItem).not.toHaveBeenCalled();
  });

  it("prevents a second request while a save is pending", async () => {
    const user = userEvent.setup();

    let resolvePendingSave!: (value: unknown) => void;

    createSavedItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePendingSave = resolve;
        }),
    );

    render(<SaveButton {...defaultProps} />);

    const button = screen.getByRole("button", {
      name: "Save item to My Lists",
    });

    // First click starts the save request.
    await user.click(button);

    // The accessible name stays the same because the component
    // uses aria-label. The visible text changes to "Saving…".
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Saving…");

    // A second click must not start another request.
    await user.click(button);

    expect(createSavedItem).toHaveBeenCalledOnce();

    // Finish the pending request.
    resolvePendingSave({
      id: 10,
      user_id: 1,
      item_id: 123,
      status: "planned",
    });

    expect(
      await screen.findByText("Added to your Planned list."),
    ).toBeInTheDocument();
  });
});
