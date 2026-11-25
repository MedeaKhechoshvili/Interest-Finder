"use client";

import { goToPage } from "@/lib/navigation";

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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface LoginFormProps {
  next: string;
  registered: boolean;
  expired: boolean;
}

export default function LoginForm(props: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  let passwordType = "password";
  let buttonText = "Log In";
  let errorMessage = null;
  let statusMessage = null;

  if (showPassword) {
    passwordType = "text";
  }

  if (loading) {
    buttonText = "Logging in...";
  }

  if (error) {
    errorMessage = (
      <Alert className="form-error" variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (props.registered) {
    statusMessage = (
      <Alert className="form-notice" role="status">
        <AlertDescription>
          Your account is ready. You can now log in.
        </AlertDescription>
      </Alert>
    );
  }

  if (props.expired) {
    statusMessage = (
      <Alert className="form-notice" role="status">
        <AlertDescription>Please log in to continue.</AlertDescription>
      </Alert>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      // the next route sends these credentials to fastapi
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }

      // reload the page so the server reads the new session cookie
      goToPage(props.next);
    } catch {
      setError("Could not connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card className="auth-card" role="region" aria-labelledby="login-title">
      <CardHeader>
        <div className="form-logo" aria-hidden="true">
          i
        </div>
        <CardTitle>
          <h1 id="login-title">Welcome Back</h1>
        </CardTitle>
        <CardDescription className="form-intro">
          Continue archiving and curating your quiet spaces.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statusMessage}
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <div className="form-field">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@domain.com"
              value={email}
              required
              disabled={loading}
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
              type={passwordType}
              autoComplete="current-password"
              maxLength={128}
              placeholder="Enter your secure password"
              value={password}
              required
              disabled={loading}
              onChange={function (event) {
                setPassword(event.target.value);
              }}
            />
          </div>

          <div className="checkbox-row">
            <Checkbox
              id="show-password"
              checked={showPassword}
              disabled={loading}
              onCheckedChange={function (checked) {
                if (checked === true) {
                  setShowPassword(true);
                } else {
                  setShowPassword(false);
                }
              }}
            />
            <Label htmlFor="show-password">Show password</Label>
          </div>

          <Accordion type="single" collapsible className="password-help">
            <AccordionItem value="password-help">
              <AccordionTrigger>Forgot Password?</AccordionTrigger>
              <AccordionContent>
                Password reset is not available yet. You can register a new test
                account with another email.
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {errorMessage}
          <Button type="submit" className="primary-button" disabled={loading}>
            {buttonText}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="form-switch">
          Don&apos;t have an account?{" "}
          <Link href={"/register?next=" + encodeURIComponent(props.next)}>
            Sign Up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
