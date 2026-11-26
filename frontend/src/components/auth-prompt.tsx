"use client";

import Link from "next/link";
import { useState, useRef, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getReturnPath } from "@/lib/return-path";

interface AuthPromptContextValue {
  signedIn: boolean;
  requireAuth: (next: string) => boolean;
}

interface AuthPromptProviderProps {
  signedIn: boolean;
  children: ReactNode;
}

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null);

export function AuthPromptProvider(props: AuthPromptProviderProps) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("/account");
  const trigger = useRef<HTMLElement | null>(null);

  function requireAuth(destination: string) {
    if (props.signedIn) {
      return true;
    }

    // the server still checks the session before any private action
    if (document.activeElement instanceof HTMLElement) {
      trigger.current = document.activeElement;
    }
    setNext(getReturnPath(destination));
    setOpen(true);
    return false;
  }

  function closePrompt() {
    setOpen(false);
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    if (trigger.current) {
      trigger.current.focus();
    }
  }

  return (
    <AuthPromptContext.Provider
      value={{ requireAuth: requireAuth, signedIn: props.signedIn }}
    >
      {props.children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="auth-prompt" onCloseAutoFocus={restoreFocus}>
          <span className="auth-prompt-logo" aria-hidden="true">
            i
          </span>
          <DialogTitle className="auth-prompt-title">
            Join InterestFinder
          </DialogTitle>
          <DialogDescription className="auth-prompt-description">
            Log in or sign up to save items, curate custom lists, rate cinema or
            literature, and share thoughtful reviews with curators.
          </DialogDescription>
          <div className="auth-prompt-actions">
            <Button asChild className="auth-prompt-login">
              <Link
                href={"/login?next=" + encodeURIComponent(next)}
                onClick={closePrompt}
              >
                Log In
              </Link>
            </Button>
            <Button asChild variant="outline" className="auth-prompt-register">
              <Link
                href={"/register?next=" + encodeURIComponent(next)}
                onClick={closePrompt}
              >
                Create Account
              </Link>
            </Button>
          </div>
          <p className="auth-prompt-footer">
            Experience digital discovery, curated thoughtfully.
          </p>
        </DialogContent>
      </Dialog>
    </AuthPromptContext.Provider>
  );
}

export function useAuthPrompt() {
  const context = useContext(AuthPromptContext);

  if (!context) {
    throw new Error("useAuthPrompt must be used inside AuthPromptProvider.");
  }

  return context;
}
