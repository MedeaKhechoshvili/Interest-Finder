export type HomeCategory = "movies" | "books" | "music" | "attractions";
export type HomeProvider =
  "tmdb" | "google_books" | "musicbrainz" | "opentripmap";

interface HomeItemDetails {
  [name: string]: unknown;
}

export interface HomeItem {
  category: HomeCategory;
  provider: HomeProvider;
  external_id: string;
  title: string;
  image_url?: string | null;
  year_or_date?: string | null;
  source_rating?: number | null;
  community_rating?: number | null;
  details?: HomeItemDetails | null;
}

export interface HomeSection {
  category: HomeCategory;
  title: string;
  items: HomeItem[];
}

export interface HomeRating {
  value: number;
  maximum: number;
  source: string;
}

export const homeCategories: { value: HomeCategory; label: string }[] = [
  { value: "movies", label: "Movies" },
  { value: "books", label: "Books" },
  { value: "music", label: "Music" },
  { value: "attractions", label: "Attractions" },
];

function isObject(value: unknown): value is { [name: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is HomeCategory {
  return (
    value === "movies" ||
    value === "books" ||
    value === "music" ||
    value === "attractions"
  );
}

function isHomeItem(value: unknown): value is HomeItem {
  if (!isObject(value) || !isCategory(value.category)) {
    return false;
  }
  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    typeof value.external_id !== "string" ||
    !value.external_id.trim()
  ) {
    return false;
  }
  const providers = {
    movies: "tmdb",
    books: "google_books",
    music: "musicbrainz",
    attractions: "opentripmap",
  };
  if (value.provider !== providers[value.category]) {
    return false;
  }
  for (const field of ["image_url", "year_or_date"]) {
    if (
      value[field] !== undefined &&
      value[field] !== null &&
      typeof value[field] !== "string"
    ) {
      return false;
    }
  }
  for (const field of ["source_rating", "community_rating"]) {
    if (
      value[field] !== undefined &&
      value[field] !== null &&
      (typeof value[field] !== "number" || !Number.isFinite(value[field]))
    ) {
      return false;
    }
  }
  return (
    value.details === undefined ||
    value.details === null ||
    isObject(value.details)
  );
}

export function readHomeSections(value: unknown): HomeSection[] {
  if (
    !isObject(value) ||
    !isObject(value.data) ||
    !Array.isArray(value.data.sections)
  ) {
    throw new Error("The home response was not in the expected format.");
  }
  const sections: HomeSection[] = [];
  for (const section of value.data.sections) {
    if (
      !isObject(section) ||
      !isCategory(section.category) ||
      typeof section.title !== "string" ||
      !Array.isArray(section.items)
    ) {
      throw new Error("A home section was not in the expected format.");
    }
    const items: HomeItem[] = [];
    for (const item of section.items) {
      if (!isHomeItem(item) || item.category !== section.category) {
        throw new Error("A home item was not in the expected format.");
      }
      items.push(item);
    }
    if (
      sections.some(function (previous) {
        return previous.category === section.category;
      })
    ) {
      throw new Error("The home response contains a repeated category.");
    }
    sections.push({
      category: section.category,
      title: section.title,
      items: items,
    });
  }
  return sections;
}

export function getHomeRows(sections: HomeSection[]) {
  const popular: HomeItem[] = [];
  const recommended: HomeItem[] = [];
  const unavailable: HomeCategory[] = [];
  for (const category of homeCategories) {
    const section = sections.find(function (entry) {
      return entry.category === category.value;
    });
    if (!section || section.items.length === 0) {
      unavailable.push(category.value);
      continue;
    }
    popular.push(section.items[0]);
    if (section.items.length > 1) {
      recommended.push(section.items[1]);
    }
  }
  return {
    popular: popular,
    recommended: recommended,
    unavailable: unavailable,
  };
}

export function getCategoryLabel(category: HomeCategory) {
  for (const entry of homeCategories) {
    if (entry.value === category) {
      return entry.label;
    }
  }
  return category;
}

export function getItemPath(item: HomeItem) {
  return "/items/" + item.category + "/" + encodeURIComponent(item.external_id);
}

export function getHomeImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

export function getHomeRating(item: HomeItem): HomeRating | null {
  const community = item.community_rating;
  if (
    typeof community === "number" &&
    Number.isFinite(community) &&
    community > 0 &&
    community <= 5
  ) {
    return { value: community, maximum: 5, source: "InterestFinder" };
  }
  let maximum = 5;
  let source = "Google Books";
  if (item.provider === "opentripmap") {
    return null;
  }
  if (item.provider === "tmdb") {
    maximum = 10;
    source = "TMDB";
  }
  if (item.provider === "musicbrainz") {
    source = "MusicBrainz";
  }
  const rating = item.source_rating;
  if (
    typeof rating !== "number" ||
    !Number.isFinite(rating) ||
    rating <= 0 ||
    rating > maximum
  ) {
    return null;
  }
  return { value: rating, maximum: maximum, source: source };
}

function detailText(item: HomeItem, name: string) {
  const value = item.details?.[name];
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim();
  }
  return "";
}

export function getHomeMetadata(item: HomeItem) {
  const parts: string[] = [];
  if (item.year_or_date && /^\d{4}/.test(item.year_or_date)) {
    parts.push(item.year_or_date.slice(0, 4));
  }
  let description = "";
  if (item.category === "movies") {
    description = detailText(item, "genres") || "Film";
  }
  if (item.category === "books") {
    description = detailText(item, "categories") || "Book";
  }
  if (item.category === "music") {
    description = detailText(item, "release_type") || "Album";
    const genre = detailText(item, "genres");
    if (genre) {
      description += " · " + genre;
    }
  }
  if (item.category === "attractions") {
    description = detailText(item, "attraction_type").replaceAll("_", " ");
    const city = detailText(item, "city");
    if (description && city) {
      description += " · " + city;
    } else if (city) {
      description = city;
    }
  }
  if (description) {
    parts.push(description);
  }
  return parts.join(" · ");
}
