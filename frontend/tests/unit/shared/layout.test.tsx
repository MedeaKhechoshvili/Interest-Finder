import React from "react";
import { renderToString } from "react-dom/server";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Header from "@/components/header";
import Footer from "@/components/footer";
import RootLayout from "@/app/layout";
import { getCurrentUser } from "@/lib/session";
import { usePathname } from "next/navigation";

vi.mock("next/link", function () {
  return {
    default: function Link(props: React.ComponentProps<"a">) {
      // jsdom cannot navigate, so only the click handler runs
      return (
        <a
          {...props}
          onClick={function (event) {
            event.preventDefault();
            if (props.onClick) {
              props.onClick(event);
            }
          }}
        />
      );
    },
  };
});
vi.mock("next/navigation", function () {
  return { usePathname: vi.fn() };
});
vi.mock("@/lib/session", function () {
  return { getCurrentUser: vi.fn() };
});

const reader = {
  id: 1,
  full_name: "Reader Name",
  email: "reader@example.com",
  is_active: true,
};

beforeEach(function () {
  vi.mocked(usePathname).mockReturnValue("/");
  vi.mocked(getCurrentUser).mockReset();
});

describe("header", function () {
  it("shows guests the public links and the log in and sign up links", function () {
    render(<Header signedIn={false} />);
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(main).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      within(main).getByRole("link", { name: "Discover" }),
    ).toHaveAttribute("href", "/discover");
    expect(within(main).queryByRole("link", { name: "My Lists" })).toBeNull();

    const account = screen.getByRole("navigation", {
      name: "Account navigation",
    });
    expect(
      within(account).getByRole("link", { name: "Log In" }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(account).getByRole("link", { name: "Sign Up" }),
    ).toHaveAttribute("href", "/register");
    expect(
      within(account).queryByRole("link", { name: "My Account" }),
    ).toBeNull();
  });

  it("shows signed in users my lists and their account instead", function () {
    render(<Header signedIn={true} />);
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(main).getByRole("link", { name: "My Lists" }),
    ).toHaveAttribute("href", "/my-lists");

    const account = screen.getByRole("navigation", {
      name: "Account navigation",
    });
    expect(
      within(account).getByRole("link", { name: "My Account" }),
    ).toHaveAttribute("href", "/account");
    expect(within(account).queryByRole("link", { name: "Log In" })).toBeNull();
    expect(within(account).queryByRole("link", { name: "Sign Up" })).toBeNull();
  });

  it("marks the current page in the main navigation", function () {
    vi.mocked(usePathname).mockReturnValue("/discover");
    render(<Header signedIn={false} />);
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(main).getByRole("link", { name: "Discover" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(main).getByRole("link", { name: "Home" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks home as the current page on the home page", function () {
    render(<Header signedIn={false} />);
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(main).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens the mobile menu and closes it when a link is chosen", async function () {
    render(<Header signedIn={true} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    const menu = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(screen.getByRole("dialog", { name: "InterestFinder" })).toBeVisible();
    for (const name of ["Home", "Discover", "My Lists", "My Account"]) {
      expect(within(menu).getByRole("link", { name: name })).toBeVisible();
    }

    await userEvent.click(within(menu).getByRole("link", { name: "Discover" }));
    expect(
      screen.queryByRole("dialog", { name: "InterestFinder" }),
    ).toBeNull();
  });

  it("offers guests log in and sign up in the mobile menu", async function () {
    render(<Header signedIn={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    const menu = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(menu).getByRole("link", { name: "Log In" })).toBeVisible();
    expect(within(menu).getByRole("link", { name: "Sign Up" })).toBeVisible();
    expect(within(menu).queryByRole("link", { name: "My Lists" })).toBeNull();
  });

  it("closes the mobile menu with escape", async function () {
    render(<Header signedIn={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("dialog", { name: "InterestFinder" })).toBeVisible();

    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "InterestFinder" }),
    ).toBeNull();
  });
});

describe("footer", function () {
  it("links each explore entry to its discover category", function () {
    render(<Footer />);
    const explore = screen.getByRole("navigation", { name: "Explore" });
    const expected = [
      ["Cinema", "/discover?category=movies"],
      ["Literature", "/discover?category=books"],
      ["Audio & Sound", "/discover?category=music"],
      ["Local Escapes", "/discover?category=attractions"],
    ];
    for (const [name, href] of expected) {
      expect(within(explore).getByRole("link", { name: name })).toHaveAttribute(
        "href",
        href,
      );
    }
  });

  it("links to the privacy policy and terms", function () {
    render(<Footer />);
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(
      within(legal).getByRole("link", { name: "Privacy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(within(legal).getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  it("shows the current year in the copyright", function () {
    render(<Footer />);
    const year = String(new Date().getFullYear());
    expect(
      screen.getByText(/InterestFinder Platform\. Designed for intentional/),
    ).toHaveTextContent(year);
  });
});

describe("root layout", function () {
  async function renderLayout() {
    const page = await RootLayout({
      children: <main id="main">Page content</main>,
    });
    return renderToString(page);
  }

  it("renders the skip link, header, page, and footer for a guest", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const html = await renderLayout();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('href="#main"');
    expect(html).toContain("Skip to content");
    expect(html).toContain("Page content");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/account"');
    expect(html).toContain("site-footer");
  });

  it("shows the signed in navigation when the session is valid", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(reader);
    const html = await renderLayout();
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/my-lists"');
  });

  it("still renders as a guest when the account service is unavailable", async function () {
    vi.mocked(getCurrentUser).mockRejectedValue(
      new Error("The account service is unavailable."),
    );
    const html = await renderLayout();
    expect(html).toContain("Page content");
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/account"');
  });
});
