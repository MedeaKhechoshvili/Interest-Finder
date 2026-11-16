import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit cleanup also works when Vitest globals are disabled.
afterEach(() => cleanup());
