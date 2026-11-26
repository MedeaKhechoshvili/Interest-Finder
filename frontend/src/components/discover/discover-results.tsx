"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import ItemCard from "@/components/item-card";
import Pagination from "@/components/discover/pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { categoryLabel, discoverUrl, itemsApiPath } from "@/lib/catalog";
import type { DiscoverParams, ItemsResponse } from "@/lib/catalog";

interface DiscoverResultsProps {
  params: DiscoverParams;
}

type Status = "loading" | "error" | "done";

export default function DiscoverResults(props: DiscoverResultsProps) {
  const params = props.params;
  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<ItemsResponse | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const apiPath = itemsApiPath(params);

  useEffect(
    function () {
      // an older search finishing late must not replace newer results
      let current = true;

      apiRequest(apiPath)
        .then(function (data: ItemsResponse) {
          if (current) {
            setResult(data);
            setStatus("done");
          }
        })
        .catch(function (requestError: Error) {
          if (current) {
            setError(requestError.message || "Something went wrong.");
            setStatus("error");
          }
        });

      return function () {
        current = false;
      };
    },
    [apiPath, attempt],
  );

  function retry() {
    setStatus("loading");
    setAttempt(attempt + 1);
  }

  if (status === "loading") {
    return (
      <section className="discover-results" aria-busy="true">
        <p className="discover-summary" role="status">
          Loading results...
        </p>
        <div className="discover-grid" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(function (number) {
            return <div className="discover-skeleton" key={number} />;
          })}
        </div>
      </section>
    );
  }

  if (status === "error" || !result) {
    return (
      <section className="discover-results">
        <Alert variant="destructive" className="discover-error">
          <AlertTitle>We could not load results.</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <p>The catalog service may be busy. Please try again.</p>
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="secondary-button"
          onClick={retry}
        >
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      </section>
    );
  }

  const items = result.data;
  const meta = result.meta;

  if (items.length === 0) {
    let message = "No results found.";

    if (params.q) {
      message = 'No results found for "' + params.q + '".';
    }

    let clearFilters = null;

    if (Object.keys(params.filters).length > 0) {
      clearFilters = (
        <Link
          href={discoverUrl({ ...params, page: 1, filters: {} })}
          className="discover-reset"
        >
          Remove filters
        </Link>
      );
    }

    return (
      <section className="discover-results">
        <div className="discover-empty" role="status">
          <h2>{message}</h2>
          <p>Try different words, another category, or fewer filters.</p>
          {clearFilters}
        </div>
      </section>
    );
  }

  const first = (meta.page - 1) * meta.page_size + 1;
  const last = first + items.length - 1;
  let scope = "all categories";

  if (params.category) {
    scope = categoryLabel(params.category).toLowerCase();
  }

  return (
    <section
      className="discover-results"
      aria-labelledby="discover-results-heading"
    >
      <h2 id="discover-results-heading" className="sr-only">
        Results
      </h2>
      <p className="discover-summary" role="status">
        Showing {first}–{last} of {meta.total.toLocaleString("en-US")} results
        in {scope}
      </p>
      <div className="discover-grid">
        {items.map(function (item, index) {
          return (
            <ItemCard
              key={item.category + ":" + item.external_id}
              item={item}
              eagerImage={index < 4}
            />
          );
        })}
      </div>
      <Pagination params={params} meta={meta} />
    </section>
  );
}
