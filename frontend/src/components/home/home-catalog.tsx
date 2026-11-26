"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/api";
import { getHomeRows, homeCategories, readHomeSections } from "@/lib/home";
import type { HomeItem, HomeSection } from "@/lib/home";
import HomeItemCard from "./home-item-card";

function HomeRow(props: {
  title: string;
  id: string;
  items: HomeItem[];
  recommended?: boolean;
}) {
  let desktopLink = "View All Popular";
  let mobileLink = "View all";
  let description = null;
  if (props.recommended) {
    desktopLink = "Refine Preferences";
    mobileLink = "Refine";
    description = (
      <p className="sr-only" id="home-suggestions-description">
        General suggestions from the featured catalog. These are not
        personalized recommendations.
      </p>
    );
  }
  let content = (
    <p className="home-row-empty">
      More discoveries will appear here soon. You can explore the catalog in
      Discover.
    </p>
  );
  if (props.items.length > 0) {
    content = (
      <ul className="home-card-grid" aria-label={props.title}>
        {props.items.map(function (item) {
          return (
            <li key={item.category + ":" + item.external_id}>
              <HomeItemCard item={item} />
            </li>
          );
        })}
      </ul>
    );
  }
  let describedBy;
  if (props.recommended) {
    describedBy = "home-suggestions-description";
  }
  return (
    <section
      className="home-row"
      aria-labelledby={props.id}
      aria-describedby={describedBy}
    >
      <div className="home-row-heading">
        <h2 id={props.id}>{props.title}</h2>
        <Link href="/discover">
          <span className="home-row-link-desktop">{desktopLink}</span>
          <span className="home-row-link-mobile">{mobileLink}</span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      {description}
      {content}
    </section>
  );
}

function HomeLoading() {
  return (
    <div className="home-catalog" aria-busy="true">
      <p className="sr-only" role="status">
        Loading featured discoveries...
      </p>
      {["Popular Right Now", "Recommended for You"].map(function (title) {
        return (
          <section className="home-row" key={title} aria-label={title}>
            <div className="home-row-heading">
              <h2>{title}</h2>
            </div>
            <ul className="home-card-grid" aria-hidden="true">
              {homeCategories.map(function (category) {
                return (
                  <li className="home-card-skeleton" key={category.value}>
                    <div />
                    <span />
                    <span />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function HomeCatalog() {
  const [sections, setSections] = useState<HomeSection[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(
    function () {
      let cancelled = false;
      async function loadHome() {
        setSections(null);
        setError("");
        try {
          const result: unknown = await apiRequest("/home");
          const loaded = readHomeSections(result);
          if (!cancelled) {
            setSections(loaded);
          }
        } catch {
          if (!cancelled) {
            setError(
              "We could not load the featured discoveries. Please try again.",
            );
          }
        }
      }
      loadHome();
      return function () {
        cancelled = true;
      };
    },
    [attempt],
  );

  function retry() {
    setAttempt(function (previous) {
      return previous + 1;
    });
  }

  if (error) {
    return (
      <div className="home-catalog">
        <Alert className="home-load-error" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
          <Button type="button" variant="outline" onClick={retry}>
            Try again
          </Button>
        </Alert>
      </div>
    );
  }
  if (sections === null) {
    return <HomeLoading />;
  }
  const rows = getHomeRows(sections);
  let availabilityMessage = null;
  if (rows.unavailable.length > 0 && rows.popular.length > 0) {
    availabilityMessage = (
      <p className="home-availability" role="status">
        Some categories are temporarily unavailable. You can still explore the
        others.
      </p>
    );
  }
  if (rows.popular.length === 0) {
    return (
      <div className="home-catalog">
        <section className="home-empty" aria-labelledby="home-empty-title">
          <h2 id="home-empty-title">Popular Right Now</h2>
          <p>
            No featured discoveries are available right now. Please check back
            soon.
          </p>
          <Button asChild variant="outline">
            <Link href="/discover">Explore Discover</Link>
          </Button>
        </section>
      </div>
    );
  }
  return (
    <div className="home-catalog" aria-busy="false">
      {availabilityMessage}
      <HomeRow
        title="Popular Right Now"
        id="home-popular-title"
        items={rows.popular}
      />
      <HomeRow
        title="Recommended for You"
        id="home-recommended-title"
        items={rows.recommended}
        recommended
      />
    </div>
  );
}
