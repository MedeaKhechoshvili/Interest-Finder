
"use client";

import { useState } from "react";
import {
  createSavedItem,
  getSavedItems,
  resolveCatalogItemId,
  type CatalogCategory,
} from "@/lib/saved-items";

export interface SaveButtonProps {
  /** Internal catalog ID, when the calling page already has one. */
  itemId: number | null;
  /** Category and provider ID let the button resolve an item when itemId is null. */
  category: CatalogCategory;
  externalId: string;
  /** Optional saved state supplied by the parent item card or Detail page. */
  isSaved?: boolean;
  /** Lets the parent keep its own item-card state in sync after a save. */
  onSavedChange?: (isSaved: boolean) => void;
}

/** Reusable save control for Discover cards and the Item Detail page. */
export default function SaveButton({
  itemId,
  category,
  externalId,
  isSaved = false,
  onSavedChange,
}: SaveButtonProps) {
  const [savedLocally, setSavedLocally] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // The parent can supply saved state, while this component remembers
  // a successful save made through this button.
  const saved = isSaved || savedLocally;

  async function handleSave() {
    if (saving || saved) return;

    setSaving(true);
    setMessage("");

    try {
      const catalogItemId = await resolveCatalogItemId(
        itemId,
        category,
        externalId,
      );

      let alreadySaved = false;

      try {
        await createSavedItem(catalogItemId);
      } catch (error) {
        const isDuplicate =
          error instanceof Error && /already saved/i.test(error.message);

        if (!isDuplicate) throw error;

        const currentItems = await getSavedItems();

        if (!currentItems.some((item) => item.item_id === catalogItemId)) {
          throw error;
        }

        alreadySaved = true;
      }

      setSavedLocally(true);
      onSavedChange?.(true);

      setMessage(
        alreadySaved
          ? "This item is already in your list."
          : "Added to your Planned list.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We couldn't save this item. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="save-control">
      <button
        type="button"
        className={saved ? "save-button is-saved" : "save-button"}
        onClick={handleSave}
        disabled={saving || saved}
        aria-pressed={saved}
        aria-label={saved ? "Item saved to My Lists" : "Save item to My Lists"}
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save to My Lists"}
      </button>

      <p className="save-button-message" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
