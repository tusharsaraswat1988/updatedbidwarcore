import { useEffect } from "react";
import { setOperatorPinGetter } from "@workspace/api-client-react";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { resolveLocalOperatorPin } from "@/lib/local-operator-pin";

export function LocalOperatorPinEffects() {
  useEffect(() => {
    if (!isBidWarLocalHost()) return;
    setOperatorPinGetter(() => resolveLocalOperatorPin());
    return () => setOperatorPinGetter(null);
  }, []);
  return null;
}
