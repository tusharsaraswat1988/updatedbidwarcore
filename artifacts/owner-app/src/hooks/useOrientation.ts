import { useEffect, useState } from "react";

export type Orientation = "portrait" | "landscape";

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() =>
    window.innerWidth > window.innerHeight ? "landscape" : "portrait",
  );

  useEffect(() => {
    function update() {
      setOrientation(window.innerWidth > window.innerHeight ? "landscape" : "portrait");
    }

    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return orientation;
}
