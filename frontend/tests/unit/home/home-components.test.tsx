import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, describe, expect, vi } from "vitest";
import HomeCatalog from "@/components/home/home-catalog";
import HomeHero from "@/components/home/home-hero";
import HomeItemCard from "@/components/home/home-item-card";
import { AuthPromptProvider } from "@/components/auth-prompt";
import { apiRequest } from "@/lib/api";
import { readHomeSections } from "@/lib/home";
import fixture from "../../fixtures/home/response.json";

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
const book = readHomeSections(fixture)[1].items[0];
function renderCatalog() {
  return render(
    <AuthPromptProvider signedIn={false}>
      <HomeCatalog />
    </AuthPromptProvider>,
  );
}

describe("home catalog", function () {
  it("shows a loading state while the request is pending", function () {
    vi.mocked(apiRequest).mockReturnValue(new Promise(function () {}));
    renderCatalog();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading featured discoveries",
    );
  });
  it("loads backend data and renders two distinct rows", async function () {
    vi.mocked(apiRequest).mockResolvedValue(fixture);
    renderCatalog();
    await screen.findByRole("article", { name: "Cure for Wellness" });
    expect(apiRequest).toHaveBeenCalledWith("/home");
    expect(screen.getAllByRole("article")).toHaveLength(8);
    expect(
      screen.getByRole("heading", { name: "Recommended for You" }),
    ).toBeVisible();
    expect(
      screen.getByText(/not personalized recommendations/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Explore The Silent Forest" }),
    ).toHaveAttribute("href", "/items/books/books-home-1");
  });
  it("keeps available categories visible when a provider returns no items", async function () {
    const partial = structuredClone(fixture);
    partial.data.sections[0].items = [];
    vi.mocked(apiRequest).mockResolvedValue(partial);
    renderCatalog();
    await screen.findByRole("article", { name: "The Silent Forest" });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Some categories are temporarily unavailable",
    );
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });
  it("shows a useful empty state", async function () {
    vi.mocked(apiRequest).mockResolvedValue({ data: { sections: [] } });
    renderCatalog();
    expect(
      await screen.findByText(/No featured discoveries are available/),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Explore Discover" }),
    ).toHaveAttribute("href", "/discover");
  });
  it("handles a sparse response without duplicating popular cards", async function () {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        sections: [
          {
            ...fixture.data.sections[1],
            items: [fixture.data.sections[1].items[0]],
          },
        ],
      },
    });
    renderCatalog();
    expect(
      await screen.findByText(/More discoveries will appear/),
    ).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
  it("shows a request failure and retries successfully", async function () {
    vi.mocked(apiRequest)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(fixture);
    renderCatalog();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not load",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("article", { name: "Cure for Wellness" }),
    ).toBeVisible();
  });
  it("handles malformed success responses as an error", async function () {
    vi.mocked(apiRequest).mockResolvedValue({ data: "invalid" });
    renderCatalog();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We could not load",
    );
  });
});

describe("home controls", function () {
  it("provides a native GET search and supported category destinations", function () {
    render(<HomeHero />);
    const search = screen.getByRole("search");
    expect(search).toHaveAttribute("action", "/discover");
    expect(search).toHaveAttribute("method", "get");
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
    expect(screen.getByRole("link", { name: "Books" })).toHaveAttribute(
      "href",
      "/discover?category=books",
    );
  });
  it("falls back when an image is absent or fails", function () {
    const view = render(
      <AuthPromptProvider signedIn={false}>
        <HomeItemCard item={book} />
      </AuthPromptProvider>,
    );
    fireEvent.error(
      screen.getByRole("img", { name: "The Silent Forest artwork" }),
    );
    expect(
      screen.getByRole("img", {
        name: "No image available for The Silent Forest",
      }),
    ).toBeVisible();
    view.rerender(
      <AuthPromptProvider signedIn={false}>
        <HomeItemCard item={{ ...book, image_url: null }} />
      </AuthPromptProvider>,
    );
    expect(screen.getByText("Image unavailable")).toBeVisible();
  });
  it("opens login for guest bookmarks and preserves the home return path", async function () {
    render(
      <AuthPromptProvider signedIn={false}>
        <HomeItemCard item={book} />
      </AuthPromptProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save The Silent Forest" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Join InterestFinder" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/login?next=%2F",
    );
  });
  it("does not pretend to save for signed in users before the shared control is ready", function () {
    render(
      <AuthPromptProvider signedIn={true}>
        <HomeItemCard item={book} />
      </AuthPromptProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Save The Silent Forest" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save The Silent Forest" }),
    ).toHaveAccessibleDescription("Saving is not available yet.");
    expect(
      screen.getByRole("button", { name: "Save The Silent Forest" }),
    ).toHaveAttribute(
      "title",
      expect.stringContaining("Saving is not available yet"),
    );
  });
  it("labels provider ratings without converting a ten-point score into five stars", function () {
    const item = {
      ...readHomeSections(fixture)[0].items[0],
      community_rating: null,
      source_rating: 8.6,
    };
    render(
      <AuthPromptProvider signedIn={false}>
        <HomeItemCard item={item} />
      </AuthPromptProvider>,
    );
    expect(
      screen.getByLabelText("TMDB rating: 8.6 out of 10"),
    ).toHaveTextContent("8.6/10");
    expect(document.querySelector(".home-rating-stars")).toBeNull();
  });
  it("shows an explicit unrated state instead of an invented score", function () {
    const item = { ...book, community_rating: null, source_rating: null };
    render(
      <AuthPromptProvider signedIn={false}>
        <HomeItemCard item={item} />
      </AuthPromptProvider>,
    );
    expect(screen.getByText("Not rated yet")).toBeVisible();
  });
});
