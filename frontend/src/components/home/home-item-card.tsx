"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, Bookmark, ImageOff, Star } from "lucide-react";
import { useAuthPrompt } from "@/components/auth-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useHydrated } from "@/lib/use-hydrated";
import {
  getCategoryLabel,
  getHomeImageUrl,
  getHomeMetadata,
  getHomeRating,
  getItemPath,
} from "@/lib/home";
import type { HomeItem } from "@/lib/home";
import { createSavedItem, resolveCatalogItemId } from "@/lib/saved-items";

interface HomeItemCardProps {
  item: HomeItem;
  // true when the signed in user already has this item in My Lists
  saved?: boolean;
}

interface HomeBookmarkProps {
  item: HomeItem;
  saved: boolean;
}

function HomeBookmark(props: HomeBookmarkProps) {
  const { requireAuth, signedIn } = useAuthPrompt();
  const hydrated = useHydrated();
  const descriptionId = useId();
  const [savedHere, setSavedHere] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const saved = props.saved || savedHere;

  let description = "Log in to save items.";
  if (signedIn) {
    description = "Save to your Planned list.";
  }
  if (saved) {
    description = "Saved in My Lists.";
  }

  async function handleClick() {
    // guests see the shared login prompt and come back to home afterward
    if (!requireAuth("/")) {
      return;
    }
    if (saving || saved) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      // saving needs the local catalog id, not the provider id
      const itemId = await resolveCatalogItemId(
        props.item.id,
        props.item.category,
        props.item.external_id,
      );
      let result = "Added to your Planned list.";

      try {
        await createSavedItem(itemId);
      } catch (error) {
        // the backend answers with a conflict when the item is already saved
        if (!(error instanceof Error) || !/already saved/i.test(error.message)) {
          throw error;
        }
        result = "This item is already in your list.";
      }

      setSavedHere(true);
      setMessage(result);
    } catch (error) {
      if (error instanceof Error && error.message) {
        setMessage(error.message);
      } else {
        setMessage("We could not save this item. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  let pressed;
  if (signedIn) {
    pressed = saved;
  }

  // only signed in users can save, so guests do not get an empty status region
  let status = null;
  if (signedIn) {
    let messageClass = "sr-only";
    if (message) {
      messageClass = "home-save-message";
    }
    status = (
      <p className={messageClass} role="status">
        {message}
      </p>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="home-bookmark"
        aria-label={"Save " + props.item.title}
        title={description}
        aria-describedby={descriptionId}
        aria-pressed={pressed}
        aria-busy={saving}
        disabled={!hydrated || saving || saved}
        onClick={handleClick}
      >
        <Bookmark aria-hidden="true" fill={saved ? "currentColor" : "none"} />
      </Button>
      <span id={descriptionId} className="sr-only">
        {description}
      </span>
      {status}
    </>
  );
}

export default function HomeItemCard(props: HomeItemCardProps) {
  const item = props.item;
  const imageUrl = getHomeImageUrl(item.image_url);
  const [failedImage, setFailedImage] = useState("");
  const path = getItemPath(item);
  const rating = getHomeRating(item);
  let artwork = (
    <div
      className="home-image-fallback"
      role="img"
      aria-label={"No image available for " + item.title}
    >
      <ImageOff aria-hidden="true" />
      <span>Image unavailable</span>
    </div>
  );
  if (imageUrl && failedImage !== imageUrl) {
    artwork = (
      <img
        src={imageUrl}
        alt={item.title + " artwork"}
        width={600}
        height={440}
        loading="lazy"
        onError={function () {
          setFailedImage(imageUrl);
        }}
      />
    );
  }

  let ratingContent = <span className="home-no-rating">Not rated yet</span>;
  if (rating) {
    const stars = [];
    for (let number = 1; number <= 5; number += 1) {
      let className = "home-rating-star";
      if (number <= rating.value) {
        className += " home-rating-star-filled";
      }
      stars.push(
        <Star key={number} className={className} aria-hidden="true" />,
      );
    }
    let maximum = null;
    if (rating.maximum !== 5) {
      maximum = <span>/{rating.maximum}</span>;
    }
    let desktopStars = null;
    if (rating.maximum === 5) {
      desktopStars = <span className="home-rating-stars">{stars}</span>;
    }
    ratingContent = (
      <span
        className="home-rating"
        aria-label={
          rating.source +
          " rating: " +
          rating.value.toFixed(1) +
          " out of " +
          rating.maximum
        }
        title={rating.source + " rating"}
      >
        {desktopStars}
        <span className="home-rating-number">
          <Star aria-hidden="true" />
          {rating.value.toFixed(1)}
          {maximum}
        </span>
      </span>
    );
  }

  return (
    <Card className="home-item-card" role="article" aria-label={item.title}>
      <div className="home-item-picture">
        <Link href={path} aria-label={"View details for " + item.title}>
          {artwork}
        </Link>
        <HomeBookmark item={item} saved={props.saved === true} />
      </div>
      <div className="home-item-body">
        <div className="home-item-kicker">
          <span className="home-category-label">
            {getCategoryLabel(item.category)}
          </span>
          <span className="home-item-metadata">{getHomeMetadata(item)}</span>
        </div>
        <h3>{item.title}</h3>
        <div className="home-item-bottom">
          {ratingContent}
          <Link
            className="home-item-explore"
            href={path}
            aria-label={"Explore " + item.title}
          >
            Explore <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </Card>
  );
}
