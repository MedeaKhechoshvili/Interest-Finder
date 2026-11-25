import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import LoginForm from "@/components/login-form";
import RegisterForm from "@/components/register-form";
import LogoutButton from "@/components/logout-button";
import { goToPage } from "@/lib/navigation";

vi.mock("@/lib/navigation", function () {
  return { goToPage: vi.fn() };
});
vi.mock("next/link", function () {
  return {
    default: function Link(props: React.ComponentProps<"a">) {
      return <a {...props} />;
    },
  };
});

function fillRegistration() {
  fireEvent.change(screen.getByLabelText("Full Name"), {
    target: { value: "Reader Name" },
  });
  fireEvent.change(screen.getByLabelText("Email Address"), {
    target: { value: "reader@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: "valid-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm Password"), {
    target: { value: "valid-password" },
  });
}

describe("login form", function () {
  it("sends credentials and navigates to the requested page", async function () {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ user: { id: 1 } }));
    vi.stubGlobal("fetch", fetcher);
    render(<LoginForm next="/my-lists" registered={false} expired={false} />);
    await userEvent.type(
      screen.getByLabelText("Email Address"),
      "reader@example.com",
    );
    await userEvent.type(
      screen.getByLabelText("Password", { exact: true }),
      "valid-password",
    );
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));
    await waitFor(function () {
      expect(goToPage).toHaveBeenCalledWith("/my-lists");
    });
    expect(fetcher.mock.calls[0][0]).toBe("/api/auth/login");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      email: "reader@example.com",
      password: "valid-password",
    });
  });

  it("shows incorrect credentials and lets the user retry", async function () {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: "Incorrect email or password" },
            { status: 401 },
          ),
        ),
    );
    render(<LoginForm next="/account" registered={false} expired={false} />);
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "reader@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "wrong" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect email or password",
    );
    expect(goToPage).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Log In" })).toBeEnabled();
  });

  it("shows connection failures and session messages", async function () {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LoginForm next="/account" registered={false} expired={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Please log in");
    fireEvent.submit(
      screen.getByRole("button", { name: "Log In" }).closest("form")!,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not connect",
    );
  });

  it("shows registration success and toggles password visibility", async function () {
    render(<LoginForm next="/account" registered={true} expired={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your account is ready",
    );
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Show password" }),
    );
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
  });

  it("prevents duplicate submissions while a request is pending", async function () {
    const fetcher = vi.fn().mockReturnValue(new Promise(function () {}));
    vi.stubGlobal("fetch", fetcher);
    render(<LoginForm next="/account" registered={false} expired={false} />);
    const form = screen
      .getByRole("button", { name: "Log In" })
      .closest("form")!;
    fireEvent.submit(form);
    expect(
      await screen.findByRole("button", { name: "Logging in..." }),
    ).toBeDisabled();
    fireEvent.submit(form);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("registration form", function () {
  it("checks the name, confirmation, and consent before sending data", async function () {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<RegisterForm next="/account" />);
    const form = screen
      .getByRole("button", { name: "Sign Up" })
      .closest("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "at least 2 characters",
    );
    fillRegistration();
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "different" },
    });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Passwords do not match",
    );
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "valid-password" },
    });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("accept the terms");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("submits registration and returns to login", async function () {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({}, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    render(<RegisterForm next="/my-lists" />);
    fillRegistration();
    await userEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    await waitFor(function () {
      expect(goToPage).toHaveBeenCalledWith(
        "/login?registered=1&next=%2Fmy-lists",
      );
    });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      full_name: "Reader Name",
      confirm_password: "valid-password",
      terms_accepted: true,
    });
  });

  it("shows duplicate account errors", async function () {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "Email already exists" }, { status: 409 }),
        ),
    );
    render(<RegisterForm next="/account" />);
    fillRegistration();
    await userEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email already exists",
    );
    expect(goToPage).not.toHaveBeenCalled();
  });

  it("handles offline registration and shows both passwords", async function () {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<RegisterForm next="/account" />);
    fillRegistration();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Show passwords" }),
    );
    expect(screen.getByLabelText("Confirm Password")).toHaveAttribute(
      "type",
      "text",
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /I agree/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not connect",
    );
  });
});

describe("logout control", function () {
  it("removes the session through the logout route and navigates to login", async function () {
    const fetcher = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetcher);
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Log Out" }));
    await waitFor(function () {
      expect(goToPage).toHaveBeenCalledWith("/login");
    });
    expect(fetcher).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });

  it.each(["server", "network"])(
    "allows retry after a %s failure",
    async function (failure) {
      const fetcher = vi.fn();
      if (failure === "server")
        fetcher.mockResolvedValue(new Response(null, { status: 503 }));
      else fetcher.mockRejectedValue(new Error("offline"));
      vi.stubGlobal("fetch", fetcher);
      render(<LogoutButton />);
      await userEvent.click(screen.getByRole("button", { name: "Log Out" }));
      expect(await screen.findByRole("alert")).toBeVisible();
      expect(screen.getByRole("button", { name: "Log Out" })).toBeEnabled();
      expect(goToPage).not.toHaveBeenCalled();
    },
  );
});
