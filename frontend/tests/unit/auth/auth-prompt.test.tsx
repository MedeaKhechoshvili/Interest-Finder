import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { AuthPromptProvider, useAuthPrompt } from "@/components/auth-prompt";
import AuthPromptDemo from "@/components/auth-prompt-demo";

vi.mock("next/link", function () {
  return {
    default: function Link(props: React.ComponentProps<"a">) {
      return <a {...props} />;
    },
  };
});

function UnsafeDestination() {
  const { requireAuth } = useAuthPrompt();
  return (
    <button
      onClick={function () {
        requireAuth("https://other.example");
      }}
    >
      Try unsafe destination
    </button>
  );
}

describe("shared guest login prompt", function () {
  it("opens for a guest and preserves the requested page in both links", async function () {
    render(
      <AuthPromptProvider signedIn={false}>
        <AuthPromptDemo />
      </AuthPromptProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Try private action" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Join InterestFinder" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/login?next=%2Fauth-prompt-demo%3Freturned%3D1",
    );
    expect(
      screen.getByRole("link", { name: "Create Account" }),
    ).toHaveAttribute(
      "href",
      "/register?next=%2Fauth-prompt-demo%3Freturned%3D1",
    );
    expect(screen.getByText(/Experience digital discovery/)).toBeVisible();
    expect(
      screen.queryByText(/The private action can continue/),
    ).not.toBeInTheDocument();
  });

  it("closes with the close button or escape and returns focus", async function () {
    render(
      <AuthPromptProvider signedIn={false}>
        <AuthPromptDemo />
      </AuthPromptProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Try private action" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(function () {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    await waitFor(function () {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("allows signed in users to continue without opening the prompt", async function () {
    render(
      <AuthPromptProvider signedIn={true}>
        <AuthPromptDemo />
      </AuthPromptProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Try private action" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The private action can continue.",
    );
  });

  it("replaces external return destinations with the account page", async function () {
    render(
      <AuthPromptProvider signedIn={false}>
        <UnsafeDestination />
      </AuthPromptProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Try unsafe destination" }),
    );
    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/login?next=%2Faccount",
    );
  });
});
