import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, describe, expect, vi, beforeEach } from "vitest";
import HomeCatalog from "@/components/home/home-catalog";
import HomeHero from "@/components/home/home-hero";
import HomeItemCard from "@/components/home/home-item-card";
import HomePage from "@/app/page";
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

// a saved-item response in the shape returned by GET /saved-items/
const savedBook = {
  id: 7,
  user_id: 3,
  item_id: 42,
  status: "planned",
  saved_at: "2026-11-25T10:00:00Z",
  completed_at: null,
  updated_at: "2026-11-25T10:00:00Z",
  catalog_item: {
    id: 42,
    category: "books",
    provider: "google_books",
    external_id: "books-home-1",
    title: "The Silent Forest",
    description: null,
    image_url: null,
    year_or_date: null,
  },
};

beforeEach(function () {
  vi.mocked(apiRequest).mockReset();
});

function renderSignedInCard() {
  return render(
    <AuthPromptProvider signedIn={true}>
      <HomeItemCard item={book} />
    </AuthPromptProvider>,
  );
}

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

describe("home catalog for signed in users", function () {
  it("marks items the user already saved when home loads", async function () {
    vi.mocked(apiRequest).mockImplementation(async function (path) {
      if (path === "/home") {
        return fixture;
      }
      return [savedBook];
    });
    render(
      <AuthPromptProvider signedIn={true}>
        <HomeCatalog />
      </AuthPromptProvider>,
    );
    const savedBookmark = await screen.findByRole("button", {
      name: "Save The Silent Forest",
    });
    await vi.waitFor(function () {
      expect(savedBookmark).toHaveAttribute("aria-pressed", "true");
    });
    expect(apiRequest).toHaveBeenCalledWith("/saved-items/");
    expect(
      screen.getByRole("button", { name: "Save Lost In Stone" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
  it("still shows home when the saved list cannot be loaded", async function () {
    vi.mocked(apiRequest).mockImplementation(async function (path) {
      if (path === "/home") {
        return fixture;
      }
      throw new Error("The account service is unavailable.");
    });
    render(
      <AuthPromptProvider signedIn={true}>
        <HomeCatalog />
      </AuthPromptProvider>,
    );
    expect(await screen.findAllByRole("article")).toHaveLength(8);
    expect(
      screen.getByRole("button", { name: "Save The Silent Forest" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});

describe("home page", function () {
  it("puts the hero and the featured rows in the main landmark", async function () {
    vi.mocked(apiRequest).mockResolvedValue(fixture);
    render(
      <AuthPromptProvider signedIn={false}>
        <HomePage />
      </AuthPromptProvider>,
    );
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(screen.getByRole("search")).toBeVisible();
    expect(await screen.findAllByRole("article")).toHaveLength(8);
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
    // guests never reach the saved-items api
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it("saves a signed in user's bookmark to the planned list", async function () {
    vi.mocked(apiRequest).mockImplementation(async function (path) {
      if (path === "/items/books/books-home-1") {
        return { data: { ...book, id: 42 }, request_id: "detail" };
      }
      return savedBook;
    });
    renderSignedInCard();
    const bookmark = screen.getByRole("button", {
      name: "Save The Silent Forest",
    });
    expect(bookmark).toHaveAccessibleDescription("Save to your Planned list.");
    expect(bookmark).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(bookmark);

    expect(
      await screen.findByText("Added to your Planned list."),
    ).toBeVisible();
    expect(apiRequest).toHaveBeenCalledWith("/items/books/books-home-1");
    expect(apiRequest).toHaveBeenCalledWith("/saved-items/", "POST", {
      item_id: 42,
    });
    expect(bookmark).toHaveAttribute("aria-pressed", "true");
    expect(bookmark).toBeDisabled();
    expect(bookmark).toHaveAccessibleDescription("Saved in My Lists.");
    expect(
      screen.queryByRole("dialog", { name: "Join InterestFinder" }),
    ).toBeNull();
  });
  it("uses the local catalog id directly when home already has it", async function () {
    vi.mocked(apiRequest).mockResolvedValue(savedBook);
    render(
      <AuthPromptProvider signedIn={true}>
        <HomeItemCard item={{ ...book, id: 42 }} />
      </AuthPromptProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save The Silent Forest" }),
    );
    expect(
      await screen.findByText("Added to your Planned list."),
    ).toBeVisible();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/saved-items/", "POST", {
      item_id: 42,
    });
  });
  it("tells the user when the item is already in their list", async function () {
    vi.mocked(apiRequest).mockImplementation(async function (path) {
      if (path === "/items/books/books-home-1") {
        return { data: { ...book, id: 42 }, request_id: "detail" };
      }
      throw new Error("Item is already saved");
    });
    renderSignedInCard();
    const bookmark = screen.getByRole("button", {
      name: "Save The Silent Forest",
    });
    await userEvent.click(bookmark);
    expect(
      await screen.findByText("This item is already in your list."),
    ).toBeVisible();
    expect(bookmark).toHaveAttribute("aria-pressed", "true");
  });
  it("shows a save failure and lets the user try again", async function () {
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new Error("Could not reach the backend. Please try again."),
    );
    renderSignedInCard();
    const bookmark = screen.getByRole("button", {
      name: "Save The Silent Forest",
    });
    await userEvent.click(bookmark);
    expect(
      await screen.findByText("Could not reach the backend. Please try again."),
    ).toBeVisible();
    expect(bookmark).toHaveAttribute("aria-pressed", "false");
    expect(bookmark).toBeEnabled();

    vi.mocked(apiRequest).mockImplementation(async function (path) {
      if (path === "/items/books/books-home-1") {
        return { data: { ...book, id: 42 }, request_id: "detail" };
      }
      return savedBook;
    });
    await userEvent.click(bookmark);
    expect(
      await screen.findByText("Added to your Planned list."),
    ).toBeVisible();
  });
  it("shows a general message when the error has no text", async function () {
    vi.mocked(apiRequest).mockRejectedValueOnce("network down");
    renderSignedInCard();
    await userEvent.click(
      screen.getByRole("button", { name: "Save The Silent Forest" }),
    );
    expect(
      await screen.findByText("We could not save this item. Please try again."),
    ).toBeVisible();
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
