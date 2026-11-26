"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Film, MapPin, Music } from "lucide-react";
import {
  categoryLabel,
  itemHref,
  itemSubtitle,
  providerRatingText,
} from "@/lib/catalog";
import type { CatalogItem, Category } from "@/lib/catalog";
import "./item-card.css";

interface ItemCardProps {
  item: CatalogItem;
  // optional controls such as the shared save button
  actions?: ReactNode;
  // the first cards on a page can load their images right away
  eagerImage?: boolean;
}

const placeholderIcons: Record<Category, typeof Film> = {
  movies: Film,
  books: BookOpen,
  music: Music,
  attractions: MapPin,
};

export default function ItemCard(props: ItemCardProps) {
  const item = props.item;
  const [imageFailed, setImageFailed] = useState(false);
  const subtitle = itemSubtitle(item);
  const rating = providerRatingText(item);
  const PlaceholderIcon = placeholderIcons[item.category];

  let image = (
    <div className="item-card-placeholder" data-testid="image-placeholder">
      <PlaceholderIcon aria-hidden="true" />
      <span>No image available</span>
    </div>
  );

  if (item.image_url && !imageFailed) {
    image = (
      // provider images come from many hosts, so a plain img is used
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.image_url}
        alt=""
        loading={props.eagerImage ? "eager" : "lazy"}
        onError={function () {
          setImageFailed(true);
        }}
      />
    );
  }

  let actions = null;

  if (props.actions) {
    actions = <div className="item-card-actions">{props.actions}</div>;
  }

  return (
    <article className="item-card">
      <div className="item-card-image">
        {image}
        <span className="item-card-category">
          {categoryLabel(item.category)}
        </span>
      </div>
      <div className="item-card-body">
        <h3 className="item-card-title">
          <Link href={itemHref(item)} className="item-card-link">
            {item.title}
          </Link>
        </h3>
        {subtitle ? <p className="item-card-subtitle">{subtitle}</p> : null}
        {rating ? <p className="item-card-rating">{rating}</p> : null}
        {item.description ? (
          <p className="item-card-description">{item.description}</p>
        ) : null}
        {actions}
      </div>
    </article>
  );
}
