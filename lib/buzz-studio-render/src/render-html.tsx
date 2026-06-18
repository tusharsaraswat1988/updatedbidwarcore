/**
 * SSR HTML builder for Buzz Studio templates.
 * Uses the same React components as Template Studio — no duplicate templates.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getTemplateById,
  templateExists,
} from "../../../artifacts/auction-platform/src/features/buzz-studio/registry/template-registry.ts";
import { BuzzTemplateType } from "../../../artifacts/auction-platform/src/features/buzz-studio/registry/template-types.ts";
import { resolveRenderDimensions, type RenderDimensions } from "./aspect-ratios.ts";

export const RENDERABLE_TEMPLATE_IDS: readonly BuzzTemplateType[] = [
  BuzzTemplateType.PLAYER_SPOTLIGHT,
  BuzzTemplateType.SOLD_PLAYER,
  BuzzTemplateType.TOP_BUYS,
  BuzzTemplateType.TEAM_REVEAL,
] as const;

export function isRenderableTemplateId(templateId: string): templateId is BuzzTemplateType {
  return templateExists(templateId) && RENDERABLE_TEMPLATE_IDS.includes(templateId as BuzzTemplateType);
}

export interface RenderHtmlInput {
  templateId: string;
  contract: Record<string, unknown>;
  aspectRatio: string;
}

export interface RenderHtmlResult {
  html: string;
  dimensions: RenderDimensions;
}

function buildHtmlDocument(markup: string, dimensions: RenderDimensions): string {
  const { width, height } = dimensions;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${width}, height=${height}" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #020202;
    }
    body {
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }
    #buzz-root {
      width: ${width}px;
      height: ${height}px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      flex: 1;
    }
    #buzz-root > div {
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
    }
  </style>
</head>
<body>
  <div id="buzz-root">${markup}</div>
</body>
</html>`;
}

/**
 * Render a stored creative job contract to a self-contained HTML document
 * suitable for headless browser screenshotting.
 */
export function renderCreativeJobHtml(input: RenderHtmlInput): RenderHtmlResult {
  const { templateId, contract, aspectRatio } = input;

  if (!isRenderableTemplateId(templateId)) {
    throw new Error(`Template "${templateId}" is not supported for PNG rendering.`);
  }

  const entry = getTemplateById(templateId);
  if (!entry?.component) {
    throw new Error(`Template "${templateId}" has no registered React component.`);
  }

  if (templateId === BuzzTemplateType.TOP_BUYS) {
    const entries = (contract as { entries?: unknown[] }).entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("Top Buys contract has no entries — nothing to render.");
    }
  }

  const dimensions = resolveRenderDimensions(aspectRatio);
  const Template = entry.component;
  const markup = renderToStaticMarkup(
    <Template
      {...contract}
      renderMode="export"
      aspectRatio={dimensions.aspectRatio}
      renderWidth={dimensions.width}
      renderHeight={dimensions.height}
    />,
  );
  const html = buildHtmlDocument(markup, dimensions);

  return { html, dimensions };
}
