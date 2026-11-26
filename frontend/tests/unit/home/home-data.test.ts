import { describe, it, expect } from "vitest";
import fixture from "../../fixtures/home/response.json";
import {
  readHomeSections,
  getHomeRows,
  getCategoryLabel,
  getItemPath,
  getHomeImageUrl,
  getHomeRating,
  getHomeMetadata,
} from "@/lib/home";
import type { HomeItem } from "@/lib/home";

const sections = readHomeSections(fixture);
const movie = sections[0].items[0];
const book = sections[1].items[0];

describe("home response validation", function () {
  it("reads real home response fields and preserves the four categories", function () {
    expect(sections).toHaveLength(4);
    expect(sections[0].items[0].title).toBe("Cure for Wellness");
  });
  it.each([
    undefined,
    null,
    [],
    {},
    { data: null },
    { data: { sections: "wrong" } },
  ])("rejects an invalid response %j", function (value) {
    expect(function () {
      readHomeSections(value);
    }).toThrow("expected format");
  });
  it("rejects invalid and duplicate sections", function () {
    expect(function () {
      readHomeSections({
        data: {
          sections: [{ category: "unknown", title: "Unknown", items: [] }],
        },
      });
    }).toThrow();
    expect(function () {
      readHomeSections({
        data: { sections: [{ category: "books", items: [] }] },
      });
    }).toThrow();
    expect(function () {
      readHomeSections({ data: { sections: [sections[0], sections[0]] } });
    }).toThrow("repeated category");
  });
  const invalidItems = [
    null,
    { ...movie, title: " " },
    { ...movie, external_id: 2 },
    { ...movie, category: "unknown" },
    { ...movie, provider: "google_books" },
    { ...movie, image_url: 4 },
    { ...movie, year_or_date: false },
    { ...movie, source_rating: "4" },
    { ...movie, community_rating: NaN },
    { ...movie, details: [] },
  ];
  it.each(invalidItems)("rejects a malformed item %j", function (item) {
    expect(function () {
      readHomeSections({
        data: { sections: [{ ...sections[0], items: [item] }] },
      });
    }).toThrow();
  });
  it("rejects an item placed in another category's section", function () {
    expect(function () {
      readHomeSections({
        data: { sections: [{ ...sections[0], items: [book] }] },
      });
    }).toThrow();
  });
});

describe("home row selection", function () {
  it("picks different featured items for each row in design category order", function () {
    const rows = getHomeRows([...sections].reverse());
    expect(
      rows.popular.map(function (item) {
        return item.category;
      }),
    ).toEqual(["movies", "books", "music", "attractions"]);
    expect(
      rows.recommended.map(function (item) {
        return item.title;
      }),
    ).toEqual([
      "Midnight Express",
      "Lost In Stone",
      "Symphony No. 9",
      "Lofoten Archways",
    ]);
    expect(rows.unavailable).toEqual([]);
  });
  it("handles missing, empty, and single-item categories without inventing items", function () {
    const rows = getHomeRows([
      { ...sections[0], items: [movie] },
      { ...sections[1], items: [] },
    ]);
    expect(rows.popular).toEqual([movie]);
    expect(rows.recommended).toEqual([]);
    expect(rows.unavailable).toEqual(["books", "music", "attractions"]);
    expect(getHomeRows([]).popular).toEqual([]);
  });
});

describe("home card formatting", function () {
  it("uses category and encoded external id for detail links", function () {
    expect(getItemPath({ ...book, external_id: "id with/slash?" })).toBe(
      "/items/books/id%20with%2Fslash%3F",
    );
    expect(getCategoryLabel("books")).toBe("Books");
  });
  it.each([
    null,
    undefined,
    "",
    "javascript:alert(1)",
    "data:image/png;base64,abc",
    "//other.example/a.png",
    "not-a-url",
  ])("rejects unsafe or missing artwork %s", function (url) {
    expect(getHomeImageUrl(url)).toBeNull();
  });
  it("accepts local and provider image urls", function () {
    expect(getHomeImageUrl("/cover.webp")).toBe("/cover.webp");
    expect(getHomeImageUrl("https://example.com/cover.jpg")).toBe(
      "https://example.com/cover.jpg",
    );
    expect(getHomeImageUrl("http://example.com/cover.jpg")).toBe(
      "http://example.com/cover.jpg",
    );
  });
  it("keeps provider rating scales separate from community stars", function () {
    expect(getHomeRating(movie)).toEqual({
      value: 4.3,
      maximum: 5,
      source: "InterestFinder",
    });
    expect(
      getHomeRating({ ...movie, community_rating: null, source_rating: 8.6 }),
    ).toEqual({ value: 8.6, maximum: 10, source: "TMDB" });
    expect(getHomeRating({ ...book, community_rating: null })).toEqual({
      value: 4.1,
      maximum: 5,
      source: "Google Books",
    });
    expect(
      getHomeRating({ ...sections[2].items[0], community_rating: null })
        ?.source,
    ).toBe("MusicBrainz");
    expect(
      getHomeRating({ ...sections[3].items[0], community_rating: null }),
    ).toBeNull();
  });
  it("does not show invalid or absent ratings", function () {
    expect(
      getHomeRating({ ...book, community_rating: null, source_rating: null }),
    ).toBeNull();
    expect(
      getHomeRating({ ...book, community_rating: NaN, source_rating: 6 }),
    ).toBeNull();
    expect(
      getHomeRating({ ...book, community_rating: null, source_rating: 0 }),
    ).toBeNull();
  });
  it("formats available category-specific metadata", function () {
    expect(getHomeMetadata(movie)).toBe("2024 · Film");
    expect(getHomeMetadata(book)).toBe("Novel");
    expect(getHomeMetadata(sections[2].items[0])).toBe("LP · Ambient");
    expect(getHomeMetadata(sections[3].items[0])).toBe("Nature · Japan");
    expect(
      getHomeMetadata({ ...movie, details: null, year_or_date: null }),
    ).toBe("Film");
    expect(getHomeMetadata({ ...book, details: {} })).toBe("Book");
    expect(getHomeMetadata({ ...sections[2].items[0], details: null })).toBe(
      "Album",
    );
    expect(
      getHomeMetadata({ ...sections[3].items[0], details: { city: "Kyoto" } }),
    ).toBe("Kyoto");
    const item: HomeItem = { ...sections[3].items[0], details: null };
    expect(getHomeMetadata(item)).toBe("");
  });
});
