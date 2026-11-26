import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DiscoverForm from "@/components/discover/discover-form";
import type { DiscoverParams } from "@/lib/catalog";

const push = vi.fn();

vi.mock("next/navigation", function () {
  return {
    useRouter: function () {
      return { push: push };
    },
  };
});
vi.mock("next/link", function () {
  return {
    default: function Link(props: React.ComponentProps<"a">) {
      return <a {...props} />;
    },
  };
});

function params(changes: Partial<DiscoverParams> = {}): DiscoverParams {
  return { q: "", category: null, page: 1, filters: {}, ...changes };
}

beforeEach(function () {
  push.mockReset();
});

describe("discover search form", function () {
  it("submits the search on page 1 and trims the text", async function () {
    render(<DiscoverForm initial={params({ page: 4 })} />);
    await userEvent.type(screen.getByLabelText("Search"), "  dune  ");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith("/discover?q=dune");
  });

  it("starts from the search in the url", function () {
    render(
      <DiscoverForm initial={params({ q: "batman", category: "movies" })} />,
    );
    expect(screen.getByLabelText("Search")).toHaveValue("batman");
    expect(screen.getByRole("button", { name: "Movies" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("changes category right away, keeping the text and dropping filters", async function () {
    render(
      <DiscoverForm
        initial={params({
          q: "x",
          category: "books",
          filters: { author: "A" },
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Music" }));
    expect(push).toHaveBeenCalledWith("/discover?q=x&category=music");
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(push).toHaveBeenLastCalledWith("/discover?q=x");
  });

  it.each([
    ["movies", ["Release year"]],
    ["books", ["Author", "Subject"]],
    ["music", ["Artist"]],
    ["attractions", ["City"]],
  ] as const)("shows only the %s filters", function (category, labels) {
    render(<DiscoverForm initial={params({ category: category })} />);
    for (const label of labels) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    const all = ["Release year", "Author", "Subject", "Artist", "City"];
    for (const label of all) {
      if (!(labels as readonly string[]).includes(label)) {
        expect(screen.queryByLabelText(label)).toBeNull();
      }
    }
  });

  it("shows no filters when searching all categories", function () {
    render(<DiscoverForm initial={params()} />);
    expect(screen.queryByLabelText("City")).toBeNull();
    expect(screen.queryByLabelText("Release year")).toBeNull();
  });

  it("submits filters with the search", async function () {
    render(<DiscoverForm initial={params({ category: "books" })} />);
    await userEvent.type(screen.getByLabelText("Author"), " Frank Herbert ");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith(
      "/discover?category=books&author=Frank+Herbert",
    );
  });

  it("blocks an invalid year and explains why", async function () {
    render(<DiscoverForm initial={params({ category: "movies" })} />);
    const year = screen.getByLabelText("Release year");
    await userEvent.type(year, "99");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a four-digit year.")).toBeInTheDocument();
    expect(year).toHaveAttribute("aria-invalid", "true");
    expect(year).toHaveAttribute("aria-describedby", "filter-year-error");

    await userEvent.clear(year);
    await userEvent.type(year, "1999");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith("/discover?category=movies&year=1999");
    expect(screen.queryByText("Enter a four-digit year.")).toBeNull();
  });

  it("links to a cleared search", function () {
    render(<DiscoverForm initial={params({ q: "x" })} />);
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/discover",
    );
  });

  it("follows the url when it changes, such as with the back button", function () {
    const { rerender } = render(
      <DiscoverForm initial={params({ q: "old" })} />,
    );
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "typed but not sent" },
    });
    rerender(<DiscoverForm initial={params({ q: "new" })} />);
    expect(screen.getByLabelText("Search")).toHaveValue("new");
  });

  it("keeps typed text when only the page changes", function () {
    const { rerender } = render(
      <DiscoverForm initial={params({ q: "same" })} />,
    );
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "still typing" },
    });
    rerender(<DiscoverForm initial={params({ q: "same", page: 2 })} />);
    expect(screen.getByLabelText("Search")).toHaveValue("still typing");
  });
});
