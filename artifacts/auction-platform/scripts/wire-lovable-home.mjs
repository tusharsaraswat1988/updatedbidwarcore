import fs from "node:fs";

const path = "src/pages/lovable-home.tsx";
let t = fs.readFileSync(path, "utf8");

t = t.replace(/^import \{ createFileRoute \} from "@tanstack\/react-router";\r?\n/, "");
t = t.replace(/export const Route = createFileRoute\("\/"\)\(\{[\s\S]*?\}\);\r?\n\r?\n/, "");

if (!t.includes('from "wouter"')) {
  t = t.replace(
    'import { useEffect, useState } from "react";',
    `import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { HomeSchemaMarkup } from "@/components/schema-markup";
import "@/styles/lovable-homepage.css";`,
  );
}

t = t.replace(
  /function Home\(\) \{/,
  `function Home() {
  const [, navigate] = useLocation();
  const goOrganizer = () => navigate("/organizer");
  const goSignup = () => navigate("/organizer?tab=signup");
  const goBlog = () => navigate("/blog");
  const goAcademy = () => navigate("/academy");`,
);

t = t.replace(
  /<a href="#signin" className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Sign in<\/a>/g,
  '<button type="button" onClick={goOrganizer} className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Sign in</button>',
);
t = t.replace(
  /<a href="#pricing" className="gold-button gold-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Get Started<\/a>/g,
  '<button type="button" onClick={goSignup} className="gold-button gold-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Get Started</button>',
);
t = t.replace(
  /<a href="#blog" className="hover:text-foreground">Blog<\/a>/g,
  '<a href="/blog" onClick={(e) => { e.preventDefault(); goBlog(); }} className="hover:text-foreground">Blog</a>',
);
t = t.replace(
  /<a href="#academy" className="hover:text-foreground">Academy<\/a>/g,
  '<a href="/academy" onClick={(e) => { e.preventDefault(); goAcademy(); }} className="hover:text-foreground">Academy</a>',
);

const mobileNavOld = `{"Features", "Solutions", "Pricing", "Academy", "Blog", "Pay", "Sign in"].map((l) => (
          <a key={l} href={\`#\${l.toLowerCase()}\`} onClick={onClose} className="border-b border-white/5 py-4 tracking-wider hover:text-primary">
            {l}
          </a>
        ))}`;

const mobileNavNew = `[
          { label: "Features", href: "#features" },
          { label: "Solutions", href: "#solutions" },
          { label: "Pricing", href: "#pricing" },
          { label: "Academy", href: "/academy", action: goAcademy },
          { label: "Blog", href: "/blog", action: goBlog },
          { label: "Pay", href: "#pricing" },
          { label: "Sign in", href: "/organizer", action: goOrganizer },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={(e) => {
              if (item.action) {
                e.preventDefault();
                item.action();
              }
              onClose();
            }}
            className="border-b border-white/5 py-4 tracking-wider hover:text-primary"
          >
            {item.label}
          </a>
        ))}`;

if (t.includes(mobileNavOld)) {
  t = t.replace(mobileNavOld, mobileNavNew);
} else {
  console.warn("mobile nav pattern not found — leaving as-is");
}

// Header and MobileDrawer need navigate helpers — they currently only receive onOpenDrawer/onClose.
// Pass go* into Header via props by patching call sites and signatures lightly.
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

// Wrap root
const rootPatterns = [
  'return (\n    <div className="min-h-screen',
  'return (\r\n    <div className="min-h-screen',
];
let wrapped = false;
for (const p of rootPatterns) {
  if (t.includes(p)) {
    t = t.replace(
      p,
      p.replace(
        '<div className="min-h-screen',
        '<>\n      <HomeSchemaMarkup />\n      <div className="lovable-home min-h-screen',
      ),
    );
    wrapped = true;
    break;
  }
}
if (!wrapped) console.warn("root wrap failed");

// Close fragment before end of Home — Home ends just before Header function historically,
// but after our edits Home is first. Find closing of Home by locating ContactDrawer block end.
// Simpler: replace the final `</div>\n  );\n}` that closes Home's outer shell after ContactDrawer.
const closeMarker = `{contactOpen && <ContactDrawer onClose={() => setContactOpen(false)} />}
    </div>
  );
}`;
const closeReplacement = `{contactOpen && <ContactDrawer onClose={() => setContactOpen(false)} />}
      </div>
    </>
  );
}`;
if (t.includes(closeMarker)) {
  t = t.replace(closeMarker, closeReplacement);
} else {
  console.warn("close fragment marker not found");
}

// Patch Header / MobileDrawer usages inside Home
t = t.replace(
  /\{drawerOpen && <MobileDrawer onClose=\{\(\) => setDrawerOpen\(false\)\} \/>\}/,
  `{drawerOpen && (
        <MobileDrawer
          onClose={() => setDrawerOpen(false)}
          goOrganizer={goOrganizer}
          goBlog={goBlog}
          goAcademy={goAcademy}
        />
      )}`,
);
t = t.replace(
  /<Header onOpenDrawer=\{\(\) => setDrawerOpen\(true\)\} \/>/,
  `<Header
        onOpenDrawer={() => setDrawerOpen(true)}
        goOrganizer={goOrganizer}
        goSignup={goSignup}
        goBlog={goBlog}
        goAcademy={goAcademy}
      />`,
);

if (!t.includes("export default")) {
  t += `\n\nexport default function LovableHome() {\n  return <Home />;\n}\n`;
}

fs.writeFileSync(path, t);
console.log("ok", {
  len: t.length,
  fromAuction: t.includes("From Auction"),
  tanstack: t.includes("createFileRoute"),
  lovableHome: t.includes("lovable-home"),
  exportDefault: t.includes("export default"),
  headerProps: t.includes("goSignup={goSignup}"),
});
