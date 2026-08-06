import { useEffect, useMemo } from "react";
import type { ModuleSnapshot } from "@/components/tournament-hub/module-registry";
import { useModuleRegistry } from "@/components/tournament-hub/module-registry";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";

export function useRegisterModuleSnapshot(snapshot: ModuleSnapshot) {
  const { register } = useModuleRegistry();

  useEffect(() => {
    register(snapshot);
  }, [register, snapshot]);
}

export function useModuleWorkspaceRef(id: ModuleWorkspaceId) {
  const { setModuleRef } = useModuleRegistry();
  return (node: HTMLElement | null) => setModuleRef(id, node);
}

export function useModuleSnapshots() {
  const { snapshots } = useModuleRegistry();
  return snapshots;
}

export function useScrollToModule() {
  const { scrollToModule } = useModuleRegistry();
  return scrollToModule;
}
