import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DiscoverPage from "@/app/discover/page";

vi.mock("@/components/discover/discover-form", function () {
  return {
    default: function Form(props: { initial: unknown }) {
      return <pre data-testid="form">{JSON.stringify(props.initial)}</pre>;
    },
  };
});
vi.mock("@/components/discover/discover-results", function () {
  return {
    default: function Results(props: { params: unknown }) {
      return <pre data-testid="results">{JSON.stringify(props.params)}</pre>;
    },
  };
});

describe("discover page", function () {
  it("passes the url search to the form and results", async function () {
    const page = await DiscoverPage({
      searchParams: Promise.resolve({
        q: "dune",
        category: "books",
        page: "2",
      }),
    });
    render(page);
    expect(
      screen.getByRole("heading", { name: "Discover" }),
    ).toBeInTheDocument();
    const expected = JSON.stringify({
      q: "dune",
      category: "books",
      page: 2,
      filters: {},
    });
    expect(screen.getByTestId("form")).toHaveTextContent(expected);
    expect(screen.getByTestId("results")).toHaveTextContent(expected);
  });
});
