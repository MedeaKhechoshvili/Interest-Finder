"use client";

import { goToPage } from "@/lib/navigation";
import { useHydrated } from "@/lib/use-hydrated";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RegisterFormProps {
  next: string;
}

export default function RegisterForm(props: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hydrated = useHydrated();
  const disabled = !hydrated || loading;

  let buttonText = "Sign Up";
  let errorMessage = null;

  if (loading) {
    buttonText = "Creating account...";
  }

  if (error) {
    errorMessage = (
      <Alert className="form-error" variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (disabled) {
      return;
    }

    setError("");

    if (name.trim().length < 2) {
      setError("Enter at least 2 characters for your name.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!termsAccepted) {
      setError("Please accept the terms and privacy policy.");
      return;
    }

    setLoading(true);

    try {
      const registration = {
        full_name: name,
        email: email,
        password: password,
        confirm_password: confirmPassword,
        terms_accepted: termsAccepted,
      };

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      // registration creates the account but does not log the user in
      goToPage("/login?registered=1&next=" + encodeURIComponent(props.next));
    } catch {
      setError("Could not connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="auth-card" role="region" aria-labelledby="register-title">
      <CardHeader>
        <div className="form-logo" aria-hidden="true">
          i
        </div>
        <CardTitle>
          <h1 id="register-title">Create Your Account</h1>
        </CardTitle>
        <CardDescription className="form-intro">
          <span className="desktop-copy">
            Begin your journey of analog pacing and elegant discovery.
          </span>
          <span className="mobile-copy">
            Begin a more intentional way to discover and keep track.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
            <div className="form-field">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="full_name"
                autoComplete="name"
                placeholder="e.g. Eleanor Vance"
                minLength={2}
                maxLength={100}
                value={name}
                required
                disabled={disabled}
                onChange={function (event) {
                  setName(event.target.value);
                }}
              />
            </div>

            <div className="form-field">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="eleanor@vance.com"
                maxLength={254}
                value={email}
                required
                disabled={disabled}
                onChange={function (event) {
                  setEmail(event.target.value);
                }}
              />
            </div>

            <div className="form-field">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Create a secure password"
                minLength={8}
                maxLength={128}
                value={password}
                required
                disabled={disabled}
                onChange={function (event) {
                  setPassword(event.target.value);
                }}
              />
            </div>

            <div className="form-field">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat your password"
                maxLength={128}
                value={confirmPassword}
                required
                disabled={disabled}
                onChange={function (event) {
                  setConfirmPassword(event.target.value);
                }}
              />
            </div>

            <div className="checkbox-row">
              <Checkbox
                id="terms"
                name="terms_accepted"
                checked={termsAccepted}
                required
                disabled={disabled}
                onCheckedChange={function (checked) {
                  if (checked === true) {
                    setTermsAccepted(true);
                  } else {
                    setTermsAccepted(false);
                  }
                }}
              />
              <Label htmlFor="terms" className="terms-label">
                <span>
                  I agree to the <Link href="/terms">Terms of Service</Link> and{" "}
                  <Link href="/privacy">Privacy Policy</Link> of InterestFinder.
                </span>
              </Label>
            </div>

            {errorMessage}
            <Button
              type="submit"
              className="primary-button"
              disabled={disabled}
            >
              {buttonText}
            </Button>
          </fieldset>
        </form>
      </CardContent>
      <CardFooter>
        <p className="form-switch">
          Already have an account?{" "}
          <Link href={"/login?next=" + encodeURIComponent(props.next)}>
            Log In
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
