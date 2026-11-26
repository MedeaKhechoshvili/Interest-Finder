import { describe, it, expect } from "vitest";
import {
  discoverUrl,
  itemHref,
  itemSubtitle,
  itemsApiPath,
  providerRatingText,
  readDiscoverParams,
  yearError,
} from "@/lib/catalog";
import { makeItem } from "./fixtures";

describe("reading discover url parameters", function () {
  it("defaults to all categories on page 1", function () {
    expect(readDiscoverParams({})).toEqual({
      q: "",
      category: null,
      page: 1,
      filters: {},
    });
  });

  it("reads the search, category, page, and that category's filters", function () {
    expect(
      readDiscoverParams({
        q: "  dune ",
        category: "books",
        page: "3",
        author: "Frank Herbert",
        subject: "science fiction",
      }),
    ).toEqual({
      q: "dune",
      category: "books",
      page: 3,
      filters: { author: "Frank Herbert", subject: "science fiction" },
    });
  });

  it("ignores filters that belong to another category", function () {
    const params = readDiscoverParams({
      category: "movies",
      author: "x",
      city: "y",
    });
    expect(params.filters).toEqual({});
  });

  it("ignores filters when no category is chosen", function () {
    expect(readDiscoverParams({ year: "1999" }).filters).toEqual({});
  });

  it.each([
    ["games", null],
    ["MOVIES", null],
    ["music", "music"],
  ])("accepts only known categories (%s)", function (value, expected) {
    expect(readDiscoverParams({ category: value }).category).toBe(expected);
  });

  it.each([
    ["0", 1],
    ["-2", 1],
    ["abc", 1],
    ["2.5", 1],
    ["7", 7],
    ["9999", 500],
  ])("keeps page %s within the backend limits", function (value, expected) {
    expect(readDiscoverParams({ page: value }).page).toBe(expected);
  });

  it("drops an invalid year from the url", function () {
    expect(
      readDiscoverParams({ category: "movies", year: "12" }).filters,
    ).toEqual({});
    expect(
      readDiscoverParams({ category: "movies", year: "1999" }).filters,
    ).toEqual({ year: "1999" });
  });

  it("uses the first value when a parameter repeats", function () {
    expect(readDiscoverParams({ q: ["first", "second"] }).q).toBe("first");
  });

  it("limits the search length to the backend maximum", function () {
    expect(readDiscoverParams({ q: "a".repeat(300) }).q).toHaveLength(200);
  });
});

describe("building discover and api addresses", function () {
  const params = {
    q: "dune",
    category: "books" as const,
    page: 2,
    filters: { author: "Frank Herbert" },
  };

  it("builds the discover page url", function () {
    expect(discoverUrl(params)).toBe(
      "/discover?q=dune&category=books&author=Frank+Herbert&page=2",
    );
  });

  it("leaves page 1 and empty values out of the url", function () {
    expect(discoverUrl({ q: "", category: null, page: 1, filters: {} })).toBe(
      "/discover",
    );
  });

  it("round-trips through the url", function () {
    const search = Object.fromEntries(
      new URLSearchParams(discoverUrl(params).split("?")[1]),
    );
    expect(readDiscoverParams(search)).toEqual(params);
  });

  it("builds the backend path with page and page size", function () {
    expect(itemsApiPath(params)).toBe(
      "/items?q=dune&category=books&author=Frank+Herbert&page=2&page_size=20",
    );
  });

  it("encodes external ids in detail links", function () {
    expect(itemHref({ category: "books", external_id: "a/b c" })).toBe(
      "/items/books/a%2Fb%20c",
    );
  });
});

describe("item display text", function () {
  it.each([
    ["tmdb", 8.43, "8.4/10 on TMDB"],
    ["google_books", 4, "4/5 on Google Books"],
    ["musicbrainz", 4.6, "4.6/5 on MusicBrainz"],
    ["opentripmap", 7, ""],
  ])("labels the %s rating scale", function (provider, rating, expected) {
    expect(
      providerRatingText(makeItem({ provider, source_rating: rating })),
    ).toBe(expected);
  });

  it("has no rating text when the provider has no rating", function () {
    expect(providerRatingText(makeItem({ source_rating: null }))).toBe("");
  });

  it("shows category-specific subtitles", function () {
    expect(
      itemSubtitle(
        makeItem({
          category: "books",
          year_or_date: "1965",
          details: { authors: ["Frank Herbert", "Someone Else"] },
        }),
      ),
    ).toBe("Frank Herbert, Someone Else · 1965");
    expect(
      itemSubtitle(
        makeItem({ category: "music", details: { artist: "Radiohead" } }),
      ),
    ).toBe("Radiohead · 1999");
    expect(
      itemSubtitle(
        makeItem({
          category: "attractions",
          year_or_date: null,
          details: { city: "San Diego" },
        }),
      ),
    ).toBe("San Diego");
  });

  it("handles missing or oddly typed details", function () {
    expect(itemSubtitle(makeItem({ year_or_date: null, details: null }))).toBe(
      "",
    );
    expect(
      itemSubtitle(
        makeItem({
          category: "books",
          year_or_date: null,
          details: { authors: 5 },
        }),
      ),
    ).toBe("");
  });
});

describe("year validation", function () {
  it.each([
    ["", ""],
    ["1999", ""],
    ["99", "Enter a four-digit year."],
    ["abcd", "Enter a four-digit year."],
    ["1500", "Enter a year from 1800 to 2100."],
  ])("checks %s", function (value, expected) {
    expect(yearError(value)).toBe(expected);
  });
});
