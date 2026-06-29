import type { Plugin } from "vite";

/** Removes Next.js `"use client"` directives from shadcn UI files in Vite builds. */
export function stripUseClientDirective(): Plugin {
  return {
    name: "strip-use-client-directive",
    enforce: "pre",
    transform(code, id) {
      if (!/\.(?:tsx?|jsx?)$/.test(id)) return null;
      if (!/^["']use client["'];?\s*\n/.test(code)) return null;
      return {
        code: code.replace(/^["']use client["'];?\s*\n/, ""),
        map: null,
      };
    },
  };
}
