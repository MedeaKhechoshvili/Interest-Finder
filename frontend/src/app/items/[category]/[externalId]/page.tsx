
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type CatalogItem = {
  id: number | null;
  category: string;
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

function formatDetail(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const values = value.filter(
      (v) => typeof v === "string" || typeof v === "number"
    );
    return values.length ? values.join(", ") : null;
  }

  return null;
}

export default function ItemDetailPage() {
  const params = useParams<{
    category: string;
    externalId: string;
  }>();

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadItem() {
      setLoading(true);
      setError("");
      setItem(null);

      try {
        const category = params.category;
        const externalId = params.externalId;

        const result = (await apiRequest(
          `/items/${encodeURIComponent(category)}/${encodeURIComponent(externalId)}`
        )) as ItemResponse;

        if (active) {
          setItem(result.data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load item."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadItem();

    return () => {
      active = false;
    };
  }, [params.category, params.externalId]);

  if (loading) {
    return <main className="p-8 text-center">Loading item...</main>;
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8 text-center">
        <p role="alert" className="mb-4 text-red-600">{error}</p>
        <Link href="/discover" className="underline">
          Back to Discover
        </Link>
      </main>
    );
  }

  if (!item) {
    return <main className="p-8 text-center">Item not found.</main>;
  }

  const details = Object.entries(item.details ?? {})
    .map(([key, value]) => [key, formatDetail(value)] as const)
    .filter((entry): entry is readonly [string, string] =>
      entry[1] !== null
    );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/discover" className="mb-6 inline-block underline">
        ← Back to Discover
      </Link>

      <Card className="w-full min-w-0">
        <CardHeader>
          <p className="text-sm capitalize text-muted-foreground">
            {item.category}
          </p>
          <CardTitle className="text-3xl">{item.title}</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              {item.image_url && !imageFailed ? (
                <img
  src={item.image_url}
  alt={item.title}
  onError={() => setImageFailed(true)}
  className="w-full rounded-lg object-cover"
/>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                  No image available
                </div>
              )}
            </div>

            <div className="space-y-5 md:col-span-2">
              {item.year_or_date && (
                <p><strong>Date:</strong> {item.year_or_date}</p>
              )}

              <section>
                <h2 className="mb-2 text-xl font-semibold">
                  Description
                </h2>
                <p className="leading-relaxed">
                  {item.description || "No description available."}
                </p>
              </section>

              <section>
                <h2 className="mb-2 text-xl font-semibold">Ratings</h2>
                <p>
                  Source Rating: {item.source_rating ?? "Not rated"}
                </p>
                <p>
                  Community Rating: {item.community_rating ?? "Not rated"}
                </p>
                <p>
                  Community Reviews: {item.community_review_count}
                </p>
              </section>

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
    </main>
  );
}
