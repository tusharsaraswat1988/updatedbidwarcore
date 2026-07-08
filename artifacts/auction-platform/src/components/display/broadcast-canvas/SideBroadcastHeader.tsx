import { useBranding } from "@/hooks/use-branding";

import { getBrandLogoAlt, getObsBroadcastLogoSrc } from "@/lib/brand-assets";

import { SIDE_LED_LAYOUT } from "@/lib/broadcast-canvas/constants";



function tournamentTitleSize(name: string): number {

  const len = name.trim().length;

  if (len <= 22) return SIDE_LED_LAYOUT.tournamentNameSize;

  if (len <= 36) return 72;

  return 64;

}



function profileTitleSize(name: string): number {
  const len = name.trim().length;
  if (len <= 42) return SIDE_LED_LAYOUT.profileTitleSize;
  if (len <= 56) return 52;
  return 46;
}



type SideBroadcastHeaderVariant = "profile" | "sponsor";



/** Shared top header — BidWar logo + tournament name, canvas-absolute. */

export function SideBroadcastHeader({

  tournamentName,

  variant = "sponsor",

  showLiveDot = false,

}: {

  tournamentName: string;

  variant?: SideBroadcastHeaderVariant;

  showLiveDot?: boolean;

}) {

  const { logos, brandName, iconVersion } = useBranding();

  const logoSrc = getObsBroadcastLogoSrc(logos, iconVersion);

  const logoAlt = getBrandLogoAlt(brandName);



  if (variant === "profile") {

    const titleSize = profileTitleSize(tournamentName);



    return (

      <>

        {showLiveDot ? (

          <div

            aria-hidden

            style={{

              position: "absolute",

              top: SIDE_LED_LAYOUT.profileLiveDotTop,

              right: SIDE_LED_LAYOUT.profileLiveDotRight,

              width: 20,

              height: 20,

              borderRadius: "50%",

              backgroundColor: "var(--accent)",

              boxShadow: "0 0 16px rgba(212, 175, 55, 0.55)",

            }}

          />

        ) : null}

        {logoSrc ? (

          <img

            src={logoSrc}

            alt={logoAlt}

            className="broadcast-logo-premium"

            loading="eager"

            decoding="async"

            style={{

              position: "absolute",

              left: "50%",

              top: SIDE_LED_LAYOUT.profileLogoTop,

              transform: "translateX(-50%)",

              maxHeight: SIDE_LED_LAYOUT.profileLogoMaxHeight,

              maxWidth: SIDE_LED_LAYOUT.profileLogoMaxWidth,

              width: "auto",

              height: "auto",

              objectFit: "contain",

            }}

          />

        ) : null}

        <h1

          style={{

            position: "absolute",

            left: "50%",

            top: logoSrc

              ? SIDE_LED_LAYOUT.profileTitleTopWithLogo

              : SIDE_LED_LAYOUT.profileTitleTopNoLogo,

            transform: "translateX(-50%)",

            width: SIDE_LED_LAYOUT.profileTitleMaxWidth,

            margin: 0,

            padding: "0 48px",

            textAlign: "center",

            fontFamily: '"Bebas Neue", sans-serif',

            fontSize: titleSize,

            fontWeight: 400,

            lineHeight: 1.04,

            letterSpacing: "0.08em",

            textTransform: "uppercase",

            color: "#fff",

            overflow: "hidden",

            display: "-webkit-box",

            WebkitLineClamp: 2,

            WebkitBoxOrient: "vertical",

          }}

        >

          {tournamentName}

        </h1>

      </>

    );

  }



  const titleSize = tournamentTitleSize(tournamentName);



  return (

    <>

      {logoSrc ? (

        <img

          src={logoSrc}

          alt={logoAlt}

          className="broadcast-logo-premium"

          loading="eager"

          decoding="async"

          style={{

            position: "absolute",

            left: "50%",

            top: SIDE_LED_LAYOUT.headerLogoTop,

            transform: "translateX(-50%)",

            maxHeight: SIDE_LED_LAYOUT.headerLogoMaxHeight,

            maxWidth: SIDE_LED_LAYOUT.headerLogoMaxWidth,

            width: "auto",

            height: "auto",

            objectFit: "contain",

          }}

        />

      ) : null}

      <h1

        className="broadcast-tournament-name"

        style={{

          position: "absolute",

          left: "50%",

          top: logoSrc

            ? SIDE_LED_LAYOUT.tournamentNameTop

            : SIDE_LED_LAYOUT.headerLogoTop,

          transform: "translateX(-50%)",

          width: SIDE_LED_LAYOUT.tournamentNameMaxWidth,

          margin: 0,

          textAlign: "center",

          fontSize: titleSize,

          lineHeight: 0.92,

          overflow: "hidden",

          display: "-webkit-box",

          WebkitLineClamp: 2,

          WebkitBoxOrient: "vertical",

        }}

      >

        {tournamentName}

      </h1>

    </>

  );

}

