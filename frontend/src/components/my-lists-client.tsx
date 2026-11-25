
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  deleteSavedItem,
  getSavedItems,
  updateSavedItemStatus,
  type SavedItem,
  type SavedItemStatus,
} from "@/lib/saved-items";

type ListTab = SavedItemStatus;

export default function MyListsClient() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [activeTab, setActiveTab] = useState<ListTab>("planned");
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Fetch data without changing component state inside this function.
  const fetchItems = useCallback(() => getSavedItems(), []);

  // Load the saved items when the component first appears.
  useEffect(() => {
    let cancelled = false;

    fetchItems()
      .then((savedItems) => {
        if (cancelled) return;

        setItems(savedItems);
        setHasLoaded(true);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "We couldn't load your lists. Please try again."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchItems]);

  // Separate saved items into Planned and Completed lists.
  const plannedItems = useMemo(
    () => items.filter((item) => item.status === "planned"),
    [items]
  );

  const completedItems = useMemo(
    () => items.filter((item) => item.status === "completed"),
    [items]
  );

  const visibleItems =
    activeTab === "planned" ? plannedItems : completedItems;

  // Retry loading the lists after an error.
  async function handleRetry() {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const savedItems = await fetchItems();

      setItems(savedItems);
      setHasLoaded(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "We couldn't load your lists. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // Change an item's status between Planned and Completed.
  async function handleStatusChange(
    savedItemId: number,
    newStatus: SavedItemStatus
  ) {
    if (busyId !== null) return;

    setBusyId(savedItemId);
    setError("");
    setNotice("");

    try {
      const updatedItem = await updateSavedItemStatus(
        savedItemId,
        newStatus
      );

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === savedItemId
            ? updatedItem
            : item
        )
      );

      setNotice(
        newStatus === "completed"
          ? "Item moved to Completed."
          : "Item moved to Planned."
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "We couldn't update this item. Please try again."
      );
    } finally {
      setBusyId(null);
    }
  }

  // Permanently remove a saved item.
  async function handleDelete(savedItemId: number) {
    if (busyId !== null) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this item from your lists?"
    );

    if (!confirmed) return;

    setBusyId(savedItemId);
    setError("");
    setNotice("");

    try {
      await deleteSavedItem(savedItemId);

      setItems((currentItems) =>
        currentItems.filter(
          (item) => item.id !== savedItemId
        )
      );

      setNotice("Item removed from your lists.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "We couldn't remove this item. Please try again."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="my-lists-section">
      <div className="my-lists-heading">
        <div>
          <h1>My Lists</h1>
          <p className="my-lists-intro">Keep track of the things you want to explore.</p>
        </div>

        <div className="my-lists-summary" aria-label="Saved item totals">
          <div className="my-lists-summary-card">
            <span className="my-lists-summary-number">{plannedItems.length}</span>
            <span className="my-lists-summary-label">Planned</span>
          </div>
          <div className="my-lists-summary-card">
            <span className="my-lists-summary-number">{completedItems.length}</span>
            <span className="my-lists-summary-label">Completed</span>
          </div>
        </div>
      </div>

      <div
        className="my-lists-tabs"
        role="tablist"
        aria-label="Saved item lists"
      >
        <button
          type="button"
          role="tab"
          id="planned-tab"
          aria-selected={activeTab === "planned"}
          aria-controls="my-lists-panel"
          className={`my-lists-tab${activeTab === "planned" ? " active" : ""}`}
          onClick={() => setActiveTab("planned")}
        >
          Planned ({plannedItems.length})
        </button>

        <button
          type="button"
          role="tab"
          id="completed-tab"
          aria-selected={activeTab === "completed"}
          aria-controls="my-lists-panel"
          className={`my-lists-tab${activeTab === "completed" ? " active" : ""}`}
          onClick={() => setActiveTab("completed")}
        >
          Completed ({completedItems.length})
        </button>
      </div>

      {error && (
        <div className="my-lists-alert my-lists-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={loading}
          >
            {loading ? "Retrying..." : "Try again"}
          </button>
        </div>
      )}

      {notice && (
        <p className="my-lists-alert my-lists-notice" role="status">
          {notice}
        </p>
      )}

      <div
        id="my-lists-panel"
        role="tabpanel"
        aria-labelledby={
          activeTab === "planned" ? "planned-tab" : "completed-tab"
        }
        className="saved-items-panel"
      >
        {loading && !hasLoaded ? (
          <p className="my-lists-state" role="status">Loading your lists...</p>
        ) : !hasLoaded && error ? (
          <p>Your lists could not be loaded.</p>
        ) : visibleItems.length === 0 ? (
          <div className="my-lists-empty">
            <h2>
              {activeTab === "planned"
                ? "No planned items yet"
                : "No completed items yet"}
            </h2>

            <p>
              {activeTab === "planned"
                ? "Items you save will appear here."
                : "Items you mark as completed will appear here."}
            </p>
          </div>
        ) : (
          <div className="saved-items-list">
            {visibleItems.map((item) => {
              const catalogItem = item.catalog_item;

              if (!catalogItem) {
                return (
                  <article
                    key={item.id}
                    className="saved-item-card"
                  >
                    <div className="saved-item-main">
                      <h2>Item information unavailable</h2>
                      <p>
                        This saved item could not be displayed.
                      </p>

                      <button
                        type="button"
                        className="saved-item-action remove"
                        onClick={() =>
                          void handleDelete(item.id)
                        }
                        disabled={busyId !== null}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              }

              const isBusy = busyId === item.id;

              return (
                <article
                  key={item.id}
                  className="saved-item-card"
                >
                  {catalogItem.image_url ? (
                    <Image
                      className="saved-item-image"
                      src={catalogItem.image_url}
                      alt={`${catalogItem.title} cover`}
                      width={120}
                      height={160}
                      unoptimized
                    />
                  ) : (
                    <div
                      className="saved-item-image saved-item-image-placeholder"
                      aria-label="No image available"
                      role="img"
                    >
                      No image
                    </div>
                  )}

                  <div className="saved-item-main">
                    <h2>{catalogItem.title}</h2>

                    {catalogItem.category && (
                      <p className="saved-item-category">{catalogItem.category}</p>
                    )}

                    {catalogItem.description && (
                      <p className="saved-item-description">{catalogItem.description}</p>
                    )}

                    {catalogItem.year_or_date && (
                      <p>{catalogItem.year_or_date}</p>
                    )}

                    <div className="saved-item-actions">
                      {activeTab === "planned" ? (
                        <button
                          type="button"
                          className="saved-item-action primary"
                          onClick={() =>
                            void handleStatusChange(
                              item.id,
                              "completed"
                            )
                          }
                          disabled={isBusy || busyId !== null}
                        >
                          {isBusy
                            ? "Updating..."
                            : "Mark as Completed"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="saved-item-action primary"
                          onClick={() =>
                            void handleStatusChange(
                              item.id,
                              "planned"
                            )
                          }
                          disabled={isBusy || busyId !== null}
                        >
                          {isBusy
                            ? "Updating..."
                            : "Move to Planned"}
                        </button>
                      )}

                      <button
                        type="button"
                        className="saved-item-action remove"
                        onClick={() =>
                          void handleDelete(item.id)
                        }
                        disabled={isBusy || busyId !== null}
                      >
                        {isBusy ? "Please wait..." : "Remove"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
