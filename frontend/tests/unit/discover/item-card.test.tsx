import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ItemCard from "@/components/item-card";
import { makeItem } from "./fixtures";

vi.mock("next/link", function () {
  return {
    default: function Link(props: React.ComponentProps<"a">) {
      return <a {...props} />;
    },
  };
});

describe("item card", function () {
  it("links the title to the detail page", function () {
    render(<ItemCard item={makeItem()} />);
    expect(screen.getByRole("link", { name: "Fight Club" })).toHaveAttribute(
      "href",
      "/items/movies/550",
    );
  });

  it("shows the category, year, rating scale, and description", function () {
    render(<ItemCard item={makeItem()} />);
    expect(screen.getByText("Movies")).toBeInTheDocument();
    expect(screen.getByText("1999")).toBeInTheDocument();
    expect(screen.getByText("8.4/10 on TMDB")).toBeInTheDocument();
    expect(
      screen.getByText("An insomniac and a soap salesman."),
    ).toBeInTheDocument();
  });

  it("renders descriptions as plain text", function () {
    const { container } = render(
      <ItemCard item={makeItem({ description: "<b>bold</b>" })} />,
    );
    expect(screen.getByText("<b>bold</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });

  it("shows the image when there is one", function () {
    const { container } = render(<ItemCard item={makeItem()} />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/poster.jpg",
    );
    expect(screen.queryByTestId("image-placeholder")).toBeNull();
  });

  it("shows a placeholder when there is no image", function () {
    render(<ItemCard item={makeItem({ image_url: null })} />);
    expect(screen.getByText("No image available")).toBeInTheDocument();
  });

  it("switches to the placeholder when the image fails to load", function () {
    const { container } = render(<ItemCard item={makeItem()} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("No image available")).toBeInTheDocument();
  });

  it("leaves out empty fields", function () {
    render(
      <ItemCard
        item={makeItem({
          description: null,
          source_rating: null,
          year_or_date: null,
        })}
      />,
    );
    expect(screen.queryByText(/on TMDB/)).toBeNull();
    expect(screen.queryByText("1999")).toBeNull();
  });

  it("renders extra controls such as a save button", function () {
    render(<ItemCard item={makeItem()} actions={<button>Save</button>} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("loads the first images eagerly and later ones lazily", function () {
    const { container, rerender } = render(
      <ItemCard item={makeItem()} eagerImage />,
    );
    expect(container.querySelector("img")).toHaveAttribute("loading", "eager");
    rerender(<ItemCard item={makeItem()} />);
    expect(container.querySelector("img")).toHaveAttribute("loading", "lazy");
  });
});
