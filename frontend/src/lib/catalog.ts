// shared catalog types and helpers for discover, home, and detail links

export type Category = "movies" | "books" | "music" | "attractions";

export type FilterName = "year" | "author" | "subject" | "artist" | "city";

// one item in the backend's normalized catalog format
export interface CatalogItem {
  id: number | null;
  category: Category;
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
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
}

// GET /items returns the results inside data and the paging inside meta
export interface ItemsResponse {
  data: CatalogItem[];
  meta: PaginationMeta;
  request_id: string;
}

export interface FilterField {
  name: FilterName;
  label: string;
  placeholder: string;
  numeric: boolean;
}

// the url and the backend use the same parameter names
export interface DiscoverParams {
  q: string;
  category: Category | null;
  page: number;
  filters: Partial<Record<FilterName, string>>;
}

export const pageSize = 20;
export const maxPage = 500;
export const maxQueryLength = 200;
export const maxFilterLength = 100;
export const minYear = 1800;
export const maxYear = 2100;

export const categories: { value: Category; label: string }[] = [
  { value: "movies", label: "Movies" },
  { value: "books", label: "Books" },
  { value: "music", label: "Music" },
  { value: "attractions", label: "Attractions" },
];

// each category only shows the filters its provider supports
export const categoryFilters: Record<Category, FilterField[]> = {
  movies: [
    {
      name: "year",
      label: "Release year",
      placeholder: "e.g. 1999",
      numeric: true,
    },
  ],
  books: [
    {
      name: "author",
      label: "Author",
      placeholder: "e.g. Frank Herbert",
      numeric: false,
    },
    {
      name: "subject",
      label: "Subject",
      placeholder: "e.g. Science fiction",
      numeric: false,
    },
  ],
  music: [
    {
      name: "artist",
      label: "Artist",
      placeholder: "e.g. Radiohead",
      numeric: false,
    },
  ],
  attractions: [
    {
      name: "city",
      label: "City",
      placeholder: "e.g. San Diego",
      numeric: false,
    },
  ],
};

const providerNames: Record<string, string> = {
  tmdb: "TMDB",
  google_books: "Google Books",
  musicbrainz: "MusicBrainz",
  opentripmap: "OpenTripMap",
};

// providers rate on different scales, so the scale is always shown
const providerScales: Record<string, number> = {
  tmdb: 10,
  google_books: 5,
  musicbrainz: 5,
};

export function isCategory(value: unknown): value is Category {
  for (const category of categories) {
    if (category.value === value) {
      return true;
    }
  }

  return false;
}

export function categoryLabel(category: Category) {
  for (const option of categories) {
    if (option.value === category) {
      return option.label;
    }
  }

  return category;
}

export function providerName(provider: string) {
  if (providerNames[provider]) {
    return providerNames[provider];
  }

  return provider;
}

// search params can repeat a key, so only the first value is used
function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    value = value[0];
  }

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function readDiscoverParams(
  search: Record<string, string | string[] | undefined>,
): DiscoverParams {
  const q = firstValue(search.q).slice(0, maxQueryLength);
  const categoryText = firstValue(search.category);
  let category: Category | null = null;
  let page = 1;
  const filters: Partial<Record<FilterName, string>> = {};

  if (isCategory(categoryText)) {
    category = categoryText;
  }

  const pageText = firstValue(search.page);

  if (/^[0-9]+$/.test(pageText)) {
    page = Number(pageText);
  }

  if (page < 1) {
    page = 1;
  }

  if (page > maxPage) {
    page = maxPage;
  }

  // filters from another category, or an invalid year, are ignored
  if (category) {
    for (const field of categoryFilters[category]) {
      const value = firstValue(search[field.name]).slice(0, maxFilterLength);

      if (value && (!field.numeric || yearError(value) === "")) {
        filters[field.name] = value;
      }
    }
  }

  return { q: q, category: category, page: page, filters: filters };
}

function toSearchParams(params: DiscoverParams) {
  const search = new URLSearchParams();

  if (params.q) {
    search.set("q", params.q);
  }

  if (params.category) {
    search.set("category", params.category);

    for (const field of categoryFilters[params.category]) {
      const value = params.filters[field.name];

      if (value) {
        search.set(field.name, value);
      }
    }
  }

  if (params.page > 1) {
    search.set("page", String(params.page));
  }

  return search;
}

// the discover page address for a search
export function discoverUrl(params: DiscoverParams) {
  const search = toSearchParams(params).toString();

  if (!search) {
    return "/discover";
  }

  return "/discover?" + search;
}

// the backend path for a search, sent through apiRequest()
export function itemsApiPath(params: DiscoverParams) {
  const search = toSearchParams(params);
  search.set("page", String(params.page));
  search.set("page_size", String(pageSize));
  return "/items?" + search.toString();
}

// detail pages use the category and the provider's own id
export function itemHref(item: Pick<CatalogItem, "category" | "external_id">) {
  return "/items/" + item.category + "/" + encodeURIComponent(item.external_id);
}

export function yearError(value: string) {
  if (!value) {
    return "";
  }

  if (!/^[0-9]{4}$/.test(value)) {
    return "Enter a four-digit year.";
  }

  const year = Number(value);

  if (year < minYear || year > maxYear) {
    return "Enter a year from " + minYear + " to " + maxYear + ".";
  }

  return "";
}

function textList(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  const parts: string[] = [];

  for (const part of value) {
    if (typeof part === "string" && part) {
      parts.push(part);
    }
  }

  return parts.join(", ");
}

function detailText(item: CatalogItem, key: string) {
  if (!item.details) {
    return "";
  }

  const value = item.details[key];

  if (typeof value === "string") {
    return value;
  }

  return textList(value);
}

export function itemYear(item: CatalogItem) {
  if (!item.year_or_date) {
    return "";
  }

  return item.year_or_date.slice(0, 4);
}

// a short category-specific line such as the author or artist
export function itemSubtitle(item: CatalogItem) {
  let who = "";

  if (item.category === "books") {
    who = detailText(item, "authors");
  }

  if (item.category === "music") {
    who = detailText(item, "artist");
  }

  if (item.category === "attractions") {
    who = detailText(item, "city");
  }

  const parts: string[] = [];

  if (who) {
    parts.push(who);
  }

  if (itemYear(item)) {
    parts.push(itemYear(item));
  }

  return parts.join(" · ");
}

// for example "8.4/10 on TMDB", or empty when there is no provider rating
export function providerRatingText(item: CatalogItem) {
  const scale = providerScales[item.provider];

  if (item.source_rating === null || !scale) {
    return "";
  }

  const rating = Number(item.source_rating.toFixed(1));
  return rating + "/" + scale + " on " + providerName(item.provider);
}
