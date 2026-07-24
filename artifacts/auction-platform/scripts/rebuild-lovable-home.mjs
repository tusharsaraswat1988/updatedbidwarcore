/**
 * Rebuild lovable-home.tsx from the Lovable export with ONLY:
 * - strip TanStack route
 * - wrap root with lovable-home + schema
 * - wire Sign in / Get Started / Blog / Academy to BidWar routes
 * No markup/class redesign.
 */
import fs from "node:fs";

const SRC = new URL("../../../tmp/bbs/src/routes/index.tsx", import.meta.url);
const DST = new URL("../src/pages/lovable-home.tsx", import.meta.url);

let t = fs.readFileSync(SRC, "utf8");

t = t.replace(/^import \{ createFileRoute \} from "@tanstack\/react-router";\r?\n/, "");
t = t.replace(/export const Route = createFileRoute\("\/"\)\(\{[\s\S]*?\}\);\r?\n\r?\n/, "");

t = t.replace(
  'import { useEffect, useState } from "react";',
  `import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { HomeSchemaMarkup } from "@/components/schema-markup";
import "@/styles/lovable-homepage.css";`,
);

// Inject navigation helpers into Home only
t = t.replace(
  /function Home\(\) \{\r?\n  const \[drawerOpen, setDrawerOpen\] = useState\(false\);\r?\n  const \[contactOpen, setContactOpen\] = useState\(false\);/,
  `function Home() {
  const [, navigate] = useLocation();
  const goOrganizer = () => navigate("/organizer");
  const goSignup = () => navigate("/organizer?tab=signup");
  const goBlog = () => navigate("/blog");
  const goAcademy = () => navigate("/academy");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);`,
);

// Header signature + props for route wiring (visual markup unchanged)
t = t.replace(
  /function Header\(\{ onOpenDrawer \}: \{ onOpenDrawer: \(\) => void \}\)/,
  `function Header({ onOpenDrawer, goOrganizer, goSignup, goBlog, goAcademy }: {
  onOpenDrawer: () => void;
  goOrganizer: () => void;
  goSignup: () => void;
  goBlog: () => void;
  goAcademy: () => void;
})`,
);

t = t.replace(
  /function MobileDrawer\(\{ onClose \}: \{ onClose: \(\) => void \}\)/,
  `function MobileDrawer({ onClose, goOrganizer, goBlog, goAcademy }: {
  onClose: () => void;
  goOrganizer: () => void;
  goBlog: () => void;
  goAcademy: () => void;
})`,
);

// Functional wiring only — keep classNames identical
t = t.replace(
  `<a href="#academy" className="hover:text-foreground">Academy</a>
          <a href="#blog" className="hover:text-foreground">Blog</a>`,
  `<a href="/academy" onClick={(e) => { e.preventDefault(); goAcademy(); }} className="hover:text-foreground">Academy</a>
          <a href="/blog" onClick={(e) => { e.preventDefault(); goBlog(); }} className="hover:text-foreground">Blog</a>`,
);

t = t.replace(
  `<a href="#signin" className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Sign in</a>
          <a href="#pricing" className="gold-button gold-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Get Started</a>`,
  `<button type="button" onClick={goOrganizer} className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Sign in</button>
          <button type="button" onClick={goSignup} className="gold-button gold-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Get Started</button>`,
);

// Mobile drawer items — preserve classes, wire Academy/Blog/Sign in
t = t.replace(
  `{["Features", "Solutions", "Pricing", "Academy", "Blog", "Pay", "Sign in"].map((l) => (
          <a key={l} href={\`#\${l.toLowerCase()}\`} onClick={onClose} className="border-b border-white/5 py-4 tracking-wider hover:text-primary">
            {l}
          </a>
        ))}`,
  `{([
          { label: "Features", href: "#features" },
          { label: "Solutions", href: "#solutions" },
          { label: "Pricing", href: "#pricing" },
          { label: "Academy", href: "/academy", action: goAcademy },
          { label: "Blog", href: "/blog", action: goBlog },
          { label: "Pay", href: "#pricing" },
          { label: "Sign in", href: "/organizer", action: goOrganizer },
        ] as const).map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={(e) => {
              if ("action" in item && item.action) {
                e.preventDefault();
                item.action();
              }
              onClose();
            }}
            className="border-b border-white/5 py-4 tracking-wider hover:text-primary"
          >
            {item.label}
          </a>
        ))}`,
);

// Wrap root: exact Lovable outer classes + lovable-home scope + schema
t = t.replace(
  `return (
    <div className="min-h-screen text-foreground">
      <Header onOpenDrawer={() => setDrawerOpen(true)} />
      {drawerOpen && <MobileDrawer onClose={() => setDrawerOpen(false)} />}`,
  `return (
    <>
      <HomeSchemaMarkup />
      <div className="lovable-home min-h-screen text-foreground">
      <Header
        onOpenDrawer={() => setDrawerOpen(true)}
        goOrganizer={goOrganizer}
        goSignup={goSignup}
        goBlog={goBlog}
        goAcademy={goAcademy}
      />
      {drawerOpen && (
        <MobileDrawer
          onClose={() => setDrawerOpen(false)}
          goOrganizer={goOrganizer}
          goBlog={goBlog}
          goAcademy={goAcademy}
        />
      )}`,
);

t = t.replace(
  `{contactOpen && <ContactDrawer onClose={() => setContactOpen(false)} />}
    </div>
  );
}`,
  `{contactOpen && <ContactDrawer onClose={() => setContactOpen(false)} />}
      </div>
    </>
  );
}`,
);

if (!t.includes("export default")) {
  t += `\n\nexport default function LovableHome() {\n  return <Home />;\n}\n`;
}

fs.writeFileSync(DST, t);
console.log("rebuilt", DST.pathname, "bytes", Buffer.byteLength(t));
console.log({
  fromAuction: t.includes("From Auction"),
  textHero: t.includes("text-hero"),
  tanstack: t.includes("createFileRoute"),
  lovableHome: t.includes("lovable-home"),
});
