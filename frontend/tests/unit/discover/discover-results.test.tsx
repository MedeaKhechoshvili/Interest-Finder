import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import DiscoverResults from "@/components/discover/discover-results";
import { apiRequest } from "@/lib/api";
import type { DiscoverParams } from "@/lib/catalog";
import { makeItem, makeResponse } from "./fixtures";

vi.mock("@/lib/api", function () {
  return { apiRequest: vi.fn() };
});
vi.mock("next/link", function () {
  return {
    default: function Link(props: React.ComponentProps<"a">) {
      return <a {...props} />;
    },
  };
});

const request = vi.mocked(apiRequest);

function params(changes: Partial<DiscoverParams> = {}): DiscoverParams {
  return { q: "", category: null, page: 1, filters: {}, ...changes };
}

function manyItems(count: number) {
  const items = [];
  for (let number = 0; number < count; number++) {
    items.push(
      makeItem({ external_id: String(number), title: "Movie " + number }),
    );
  }
  return items;
}

describe("discover results", function () {
  it("requests the search through the shared api helper", async function () {
    request.mockResolvedValue(makeResponse([makeItem()]));
    render(
      <DiscoverResults
        params={params({
          q: "fight",
          category: "movies",
          filters: { year: "1999" },
        })}
      />,
    );
    await screen.findByText("Fight Club");
    expect(request).toHaveBeenCalledWith(
      "/items?q=fight&category=movies&year=1999&page=1&page_size=20",
    );
  });

  it("shows a loading state until results arrive", async function () {
    let finish: (value: unknown) => void = function () {};
    request.mockReturnValue(
      new Promise(function (resolve) {
        finish = resolve;
      }),
    );
    render(<DiscoverResults params={params()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results...");
    finish(makeResponse([makeItem()]));
    await screen.findByText("Fight Club");
    expect(screen.queryByText("Loading results...")).toBeNull();
  });

  it("shows result cards and a summary", async function () {
    request.mockResolvedValue(
      makeResponse(manyItems(20), { total: 1234, has_next: true }),
    );
    render(<DiscoverResults params={params({ category: "movies" })} />);
    expect(
      await screen.findByText("Showing 1–20 of 1,234 results in movies"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(20);
  });

  it("explains an empty search and offers to remove filters", async function () {
    request.mockResolvedValue(makeResponse([]));
    render(
      <DiscoverResults
        params={params({
          q: "zzz",
          category: "books",
          filters: { author: "Nobody" },
        })}
      />,
    );
    expect(
      await screen.findByRole("heading", {
        name: 'No results found for "zzz".',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Remove filters" }),
    ).toHaveAttribute("href", "/discover?q=zzz&category=books");
  });

  it("has no remove-filters link when there are no filters", async function () {
    request.mockResolvedValue(makeResponse([]));
    render(<DiscoverResults params={params()} />);
    await screen.findByRole("heading", { name: "No results found." });
    expect(screen.queryByRole("link", { name: "Remove filters" })).toBeNull();
  });

  it("shows the provider error and recovers on retry", async function () {
    request.mockRejectedValueOnce(new Error("Google Books returned an error."));
    request.mockResolvedValueOnce(makeResponse([makeItem()]));
    render(<DiscoverResults params={params({ category: "books" })} />);
    expect(
      await screen.findByText("We could not load results."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Google Books returned an error."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Fight Club")).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("uses a general message when the error has none", async function () {
    request.mockRejectedValue(new Error(""));
    render(<DiscoverResults params={params()} />);
    expect(
      await screen.findByText("Something went wrong."),
    ).toBeInTheDocument();
  });

  it("ignores a response that arrives after the search changed", async function () {
    let finishOld: (value: unknown) => void = function () {};
    request.mockReturnValueOnce(
      new Promise(function (resolve) {
        finishOld = resolve;
      }),
    );
    request.mockResolvedValueOnce(
      makeResponse([makeItem({ title: "New search" })]),
    );
    const { rerender } = render(
      <DiscoverResults params={params({ q: "old" })} />,
    );
    rerender(<DiscoverResults params={params({ q: "new" })} />);
    await screen.findByText("New search");
    finishOld(makeResponse([makeItem({ title: "Old search" })]));
    await waitFor(function () {
      expect(screen.queryByText("Old search")).toBeNull();
    });
  });
});

describe("pagination", function () {
  it("links to the next page and disables previous on page 1", async function () {
    request.mockResolvedValue(
      makeResponse(manyItems(20), { total: 45, has_next: true }),
    );
    render(
      <DiscoverResults params={params({ q: "batman", category: "movies" })} />,
    );
    const nav = await screen.findByRole("navigation", {
      name: "Search results pages",
    });
    expect(nav).toHaveTextContent("Page 1 of 3");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/discover?q=batman&category=movies&page=2",
    );
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(
      screen.getByText("Previous").closest("[aria-disabled]"),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("links back and disables next on the last page", async function () {
    request.mockResolvedValue(
      makeResponse(manyItems(5), { page: 3, total: 45, has_next: false }),
    );
    render(<DiscoverResults params={params({ q: "batman", page: 3 })} />);
    await screen.findByText("Showing 41–45 of 45 results in all categories");
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/discover?q=batman&page=2",
    );
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });

  it("is hidden when everything fits on one page", async function () {
    request.mockResolvedValue(makeResponse([makeItem()]));
    render(<DiscoverResults params={params()} />);
    await screen.findByText("Fight Club");
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("never offers pages past the backend limit", async function () {
    request.mockResolvedValue(
      makeResponse(manyItems(20), { page: 500, total: 100000, has_next: true }),
    );
    render(<DiscoverResults params={params({ page: 500 })} />);
    await screen.findByText("Page 500 of 500");
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });
});
