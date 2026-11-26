import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import AccountPage from "@/app/account/page";
import ErrorPage from "@/app/error";
import NotFoundPage from "@/app/not-found";
import LoadingPage from "@/app/loading";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

vi.mock("next/link", function () {
  return {
    default: function Link(props: React.ComponentProps<"a">) {
      return <a {...props} />;
    },
  };
});
vi.mock("next/navigation", function () {
  return {
    // the real redirect stops rendering by throwing, so this one does too
    redirect: vi.fn(function () {
      throw new Error("NEXT_REDIRECT");
    }),
  };
});
vi.mock("@/lib/session", function () {
  return { getCurrentUser: vi.fn() };
});

// the forms have their own tests, so these stand-ins only show their props
vi.mock("@/components/login-form", function () {
  return {
    default: function LoginForm(props: {
      next: string;
      registered: boolean;
      expired: boolean;
    }) {
      return (
        <div
          data-testid="login-form"
          data-next={props.next}
          data-registered={String(props.registered)}
          data-expired={String(props.expired)}
        />
      );
    },
  };
});
vi.mock("@/components/register-form", function () {
  return {
    default: function RegisterForm(props: { next: string }) {
      return <div data-testid="register-form" data-next={props.next} />;
    },
  };
});
vi.mock("@/components/logout-button", function () {
  return {
    default: function LogoutButton() {
      return <button type="button">Log Out</button>;
    },
  };
});

const reader = {
  id: 1,
  full_name: "Reader Name",
  email: "reader@example.com",
  is_active: true,
};

beforeEach(function () {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(redirect).mockClear();
});

function searchParams<T>(values: T) {
  return Promise.resolve(values);
}

describe("login page", function () {
  it("shows the form to guests with the requested return page and messages", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    render(
      await LoginPage({
        searchParams: searchParams({ next: "/my-lists", registered: "1" }),
      }),
    );
    const form = screen.getByTestId("login-form");
    expect(form).toHaveAttribute("data-next", "/my-lists");
    expect(form).toHaveAttribute("data-registered", "true");
    expect(form).toHaveAttribute("data-expired", "false");
    expect(screen.getByText("Your lists and reviews stay yours.")).toBeVisible();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("passes the expired session message to the form", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    render(
      await LoginPage({
        searchParams: searchParams({ next: "/account", expired: "1" }),
      }),
    );
    expect(screen.getByTestId("login-form")).toHaveAttribute(
      "data-expired",
      "true",
    );
  });

  it("replaces an outside return address with the account page", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    render(
      await LoginPage({
        searchParams: searchParams({ next: "https://other.example/steal" }),
      }),
    );
    expect(screen.getByTestId("login-form")).toHaveAttribute(
      "data-next",
      "/account",
    );
  });

  it("sends a signed in user straight to the requested page", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(reader);
    await expect(
      LoginPage({ searchParams: searchParams({ next: "/discover" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/discover");
  });
});

describe("register page", function () {
  it("shows the form to guests with the requested return page", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    render(
      await RegisterPage({ searchParams: searchParams({ next: "/my-lists" }) }),
    );
    expect(screen.getByTestId("register-form")).toHaveAttribute(
      "data-next",
      "/my-lists",
    );
  });

  it("sends a signed in user to their account by default", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(reader);
    await expect(
      RegisterPage({ searchParams: searchParams({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/account");
  });
});

describe("account page", function () {
  it("sends guests to login and back to the account afterward", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?expired=1&next=%2Faccount");
  });

  it("greets the signed in user and offers log out", async function () {
    vi.mocked(getCurrentUser).mockResolvedValue(reader);
    render(await AccountPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome, Reader Name" }),
    ).toBeVisible();
    expect(screen.getByText("reader@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Log Out" })).toBeVisible();
  });
});

describe("status and information pages", function () {
  it("lets the user retry after a page error", async function () {
    const reset = vi.fn();
    render(<ErrorPage reset={reset} />);
    expect(
      screen.getByRole("heading", { name: "We could not load this page." }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("explains a missing page and links back to login", function () {
    render(<NotFoundPage />);
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("announces that the page is loading", function () {
    render(<LoadingPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading InterestFinder...",
    );
  });

  it("shows the privacy policy and terms of service", function () {
    const privacy = render(<PrivacyPage />);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    privacy.unmount();

    render(<TermsPage />);
    expect(
      screen.getByRole("heading", { name: "Terms of Service" }),
    ).toBeVisible();
  });
});
