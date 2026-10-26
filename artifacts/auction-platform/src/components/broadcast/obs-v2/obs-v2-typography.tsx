import {
  createElement,
  forwardRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { OBS_V2 } from "./obs-v2-tokens";

export type ObsV2TextVariant = keyof typeof OBS_V2.typography.scale;

export type ObsV2TextColor =
  | "primary"
  | "secondary"
  | "muted"
  | "disabled"
  | "brand"
  | "brandOn"
  | "info"
  | "danger"
  | "warning"
  | "success";

export interface ObsV2TextProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /** Typography scale tier */
  variant?: ObsV2TextVariant;
  /** Semantic broadcast color */
  color?: ObsV2TextColor;
  /** Enable font-variant-numeric: tabular-nums for scores and figures */
  tabularNums?: boolean;
  /** HTML element override */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Text — Television Broadcast Typography Primitive
 *
 * Enforces:
 * - Bebas Neue for broadcast titles, hero names, and dominant scores.
 * - JetBrains Mono for sub-scores, overs, and tabular counts.
 * - Inter for tactical metadata, labels, and descriptions.
 * - Consistent tracking and line heights across every V2 scene.
 */
export const ObsV2Text = forwardRef<HTMLElement, ObsV2TextProps>(
  function ObsV2Text(
    {
      children,
      variant = "body",
      color = "primary",
      tabularNums = false,
      as,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    const scale = OBS_V2.typography.scale[variant];

    // Resolve color
    let textColor: string = OBS_V2.color.text;
    if (color === "secondary") textColor = OBS_V2.color.textSecondary;
    else if (color === "muted") textColor = OBS_V2.color.textMuted;
    else if (color === "disabled") textColor = OBS_V2.color.textDisabled;
    else if (color === "brand") textColor = OBS_V2.color.brand;
    else if (color === "brandOn") textColor = OBS_V2.color.brandOn;
    else if (color === "info") textColor = OBS_V2.color.info;
    else if (color === "danger") textColor = OBS_V2.color.danger;
    else if (color === "warning") textColor = OBS_V2.color.warning;
    else if (color === "success") textColor = OBS_V2.color.success;

    // Resolve default HTML element based on tier if not explicitly specified
    let element: ElementType = as || "span";
    if (!as) {
      if (variant === "mega" || variant === "score" || variant === "hero") element = "h1";
      else if (variant === "title") element = "h2";
      else if (variant === "headline") element = "h3";
      else if (variant === "body" || variant === "bodySm") element = "p";
      else element = "span";
    }

    const combinedStyle: CSSProperties = {
      fontSize: `${scale.fontSize}px`,
      lineHeight: scale.lineHeight,
      letterSpacing: scale.letterSpacing,
      fontFamily: scale.fontFamily,
      fontWeight: scale.fontWeight,
      textTransform: scale.textTransform,
      color: textColor,
      fontVariantNumeric: tabularNums ? "tabular-nums" : undefined,
      ...style,
    };

    return createElement(
      element,
      {
        ref,
        className: `obs-v2-text ${className}`,
        style: combinedStyle,
        "data-text-variant": variant,
        "data-text-color": color,
        ...rest,
      },
      children,
    );
  },
);

/** Specialized shortcut for dominant display headlines */
export function ObsV2Display(props: ObsV2TextProps) {
  return <ObsV2Text variant="hero" {...props} />;
}

/** Specialized shortcut for primary broadcast score numeral */
export function ObsV2ScoreNum(props: ObsV2TextProps) {
  return <ObsV2Text variant="score" tabularNums {...props} />;
}

/** Specialized shortcut for high-contrast broadcast labels */
export function ObsV2Label(props: ObsV2TextProps) {
  return <ObsV2Text variant="label" color="muted" {...props} />;
}

/** Specialized shortcut for tabular numerical metrics */
export function ObsV2Value(props: ObsV2TextProps) {
  return <ObsV2Text variant="value" tabularNums {...props} />;
}
