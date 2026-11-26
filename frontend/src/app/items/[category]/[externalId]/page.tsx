
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { apiRequest } from "@/lib/api";
import SaveButton from "@/components/save-button";
import ReviewPanel from "@/components/reviews/review-panel";
import {
  getSavedItems,
  type CatalogCategory,
} from "@/lib/saved-items";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

type CatalogItem = {
  id: number | null;
  category: CatalogCategory;
  provider: string;
  external_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  year_or_date: string | null;
  source_rating: number | null;
  source_rating_count: number | null;
  community_rating: number | null;
  community_review_count: number;
  details: Record<string, unknown> | null;
};

type ItemResponse = {
  data: CatalogItem;
  request_id: string;
};

type SessionResponse = {
  user: { id: number } | null;
};

type SavedLookup = {
  itemKey: string;
  userId: number;
  isSaved: boolean;
  error: boolean;
};

function formatDetail(value: unknown): string | null {
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const values = value.filter(
      (v) =>
        typeof v === "string" ||
        typeof v === "number"
    );

    return values.length ? values.join(", ") : null;
  }

  return null;
}

function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    musicbrainz: "MusicBrainz",
    tmdb: "TMDB",
    google_books: "Google Books",
    opentripmap: "OpenTripMap",
  };

  return names[provider] ?? provider;
}

function formatRating(
  rating: number | null,
  provider: string
): string {
  if (rating === null) {
    return "Not rated";
  }

  const value = rating.toFixed(2);

  if (provider === "tmdb") {
    return `${value}/10`;
  }

  if (provider === "google_books") {
    return `${value}/5`;
  }

  return value;
}

export default function ItemDetailPage() {
  const params = useParams<{
    category: string;
    externalId: string;
  }>();

  // Item information
  const [item, setItem] = useState<CatalogItem | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  // Login information
  const [currentUserId, setCurrentUserId] = useState<
    number | null
  >(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Current saved-item status
  const [savedLookup, setSavedLookup] =
    useState<SavedLookup | null>(null);

  // Load item from FastAPI
  useEffect(() => {
    let active = true;

    async function loadItem() {
      setLoading(true);
      setError("");
      setItem(null);
      setImageFailed(false);

      try {
        const result = (await apiRequest(
          `/items/${encodeURIComponent(
            params.category
          )}/${encodeURIComponent(params.externalId)}`
        )) as ItemResponse;

        if (active) {
          setItem(result.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load item."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadItem();

    return () => {
      active = false;
    };
  }, [params.category, params.externalId]);

  // Check login session
  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch(
          "/api/auth/session",
          {
            credentials: "same-origin",
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          if (active) setCurrentUserId(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Session unavailable.");
        }

        const result =
          (await response.json()) as SessionResponse;

        if (active) {
          setCurrentUserId(
            typeof result.user?.id === "number"
              ? result.user.id
              : null
          );
        }
      } catch {
        if (active) {
          setCurrentUserId(null);
        }
      } finally {
        if (active) {
          setSessionLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  // Check whether this item is already saved
  useEffect(() => {
    if (!item || sessionLoading || currentUserId === null) {
      return;
    }

    let active = true;
    const currentItem = item;
    const userId = currentUserId;
    const itemKey =
      `${currentItem.category}:${currentItem.external_id}`;

    async function checkSavedStatus() {
      try {
        const savedItems = await getSavedItems();

        const alreadySaved = savedItems.some(
          (saved) =>
            (currentItem.id !== null &&
              saved.item_id === currentItem.id) ||
            (saved.catalog_item?.category ===
              currentItem.category &&
              saved.catalog_item?.external_id ===
                currentItem.external_id)
        );

        if (active) {
          setSavedLookup({
            itemKey,
            userId,
            isSaved: alreadySaved,
            error: false,
          });
        }
      } catch {
        if (active) {
          setSavedLookup({
            itemKey,
            userId,
            isSaved: false,
            error: true,
          });
        }
      }
    }

    checkSavedStatus();

    return () => {
      active = false;
    };
  }, [item, currentUserId, sessionLoading]);

  // Loading state
  if (loading) {
    return (
      <main className="p-8 text-center">
        Loading item...
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-center">
        <p role="alert" className="mb-4 text-red-600">
          {error}
        </p>

        <Link href="/discover" className="underline">
          Back to Discover
        </Link>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="p-8 text-center">
        Item not found.
      </main>
    );
  }

  const details = Object.entries(item.details ?? {})
    .map(
      ([key, value]) =>
        [key, formatDetail(value)] as const
    )
    .filter(
      (entry): entry is readonly [string, string] =>
        entry[1] !== null
    );

  const itemKey = `${item.category}:${item.external_id}`;

  const savedStatusReady =
    !sessionLoading &&
    (currentUserId === null ||
      (savedLookup?.itemKey === itemKey &&
        savedLookup.userId === currentUserId));

  const isSaved =
    savedLookup?.itemKey === itemKey &&
    savedLookup.userId === currentUserId &&
    savedLookup.isSaved;

  const savedStatusError =
    currentUserId !== null &&
    savedLookup?.itemKey === itemKey &&
    savedLookup.userId === currentUserId &&
    savedLookup.error;

  function handleSavedChange(saved: boolean) {
    if (currentUserId === null) return;

    setSavedLookup({
      itemKey,
      userId: currentUserId,
      isSaved: saved,
      error: false,
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link
        href="/discover"
        className="mb-6 inline-block underline"
      >
        ← Back to Discover
      </Link>

      <Card className="w-full min-w-0">
        <CardHeader>
          <p className="text-sm capitalize text-muted-foreground">
            {item.category}
          </p>

          {/* Proper accessible page heading */}
          <h1 className="text-3xl font-semibold tracking-tight">
            {item.title}
          </h1>

          {/* Sivan's Save button */}
          <div
            className="mt-4
              [&_button]:rounded-md
              [&_button]:bg-primary
              [&_button]:px-4
              [&_button]:py-2
              [&_button]:text-primary-foreground
              [&_button]:hover:opacity-90
              [&_button]:disabled:opacity-60
              [&_button]:focus-visible:outline-2
              [&_button]:focus-visible:outline-offset-2
              [&_button]:focus-visible:outline-ring
              [&_p]:mt-2
              [&_p]:text-sm
              [&_p]:text-muted-foreground"
          >
            {!savedStatusReady ? (
              <p>Checking saved status...</p>
            ) : savedStatusError ? (
              <p role="alert">
                Could not check saved status. Refresh to retry.
              </p>
            ) : (
              <SaveButton
                key={`${itemKey}-${currentUserId ?? "guest"}`}
                itemId={item.id}
                category={item.category}
                externalId={item.external_id}
                isSaved={Boolean(isSaved)}
                onSavedChange={handleSavedChange}
              />
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-8 md:grid-cols-3">
            {/* Item image */}
            <div>
              {item.image_url && !imageFailed ? (
                <img
                  src={item.image_url}
                  alt={item.title}
                  onError={() => setImageFailed(true)}
                  className="w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg bg-muted p-4 text-center">
                  No image available
                </div>
              )}
            </div>

            {/* Item information */}
            <div className="space-y-5 md:col-span-2">
              {item.year_or_date && (
                <p>
                  <strong>Date:</strong>{" "}
                  {item.year_or_date}
                </p>
              )}

              <section>
                <h2 className="mb-2 text-xl font-semibold">
                  Description
                </h2>

                <p className="leading-relaxed">
                  {item.description ||
                    "No description available."}
                </p>
              </section>

              {/* Ratings */}
              <section>
                <h2 className="mb-2 text-xl font-semibold">
                  Ratings
                </h2>

                <div className="space-y-1">
                  <p>
                    <strong>
                      {getProviderName(item.provider)} Rating:
                    </strong>{" "}
                    {formatRating(
                      item.source_rating,
                      item.provider
                    )}
                  </p>

                  <p>
                    <strong>Community Rating:</strong>{" "}
                    {item.community_rating !== null
                      ? `${item.community_rating.toFixed(2)}/5`
                      : "Not rated"}
                  </p>

                  <p>
                    <strong>Community Reviews:</strong>{" "}
                    {item.community_review_count}
                  </p>
                </div>
              </section>

              {/* Additional category information */}
              {details.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xl font-semibold">
                    Additional Details
                  </h2>

                  <div className="space-y-2">
                    {details.map(([key, value]) => (
                      <p key={key}>
                        <strong className="capitalize">
                          {key.replaceAll("_", " ")}:
                        </strong>{" "}
                        {value}
                      </p>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yousuf's ReviewPanel */}
      <div className="mt-8">
        {item.id !== null ? (
          sessionLoading ? (
            <p>Checking login status...</p>
          ) : (
            <ReviewPanel
              key={item.id}
              itemId={item.id}
              currentUserId={currentUserId}
            />
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Reviews are currently unavailable for this item.
          </p>
        )}
      </div>
    </main>
  );
}
