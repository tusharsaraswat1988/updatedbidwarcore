import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";
import type { PlatformHealth } from "@/components/platform/health-badge";
import type { AttentionItem } from "@/components/platform/attention-center";
import type { PlatformValidationIssue } from "@/components/platform/types";

export type ModulePeekSummary = {
  title: string;
  lines: string[];
};

export type ModuleSnapshot = {
  id: ModuleWorkspaceId;
  health: PlatformHealth;
  locked?: boolean;
  readiness?: string;
  errorCount: number;
  warningCount: number;
  validationIssues: PlatformValidationIssue[];
  recommendations: string[];
  attentionItems: AttentionItem[];
  peekSummary: ModulePeekSummary;
  entityCount: number;
  lockedCount: number;
  loading: boolean;
};

type ModuleRegistryContextValue = {
  snapshots: Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>;
  register: (snapshot: ModuleSnapshot) => void;
  scrollToModule: (id: ModuleWorkspaceId) => void;
  setModuleRef: (id: ModuleWorkspaceId, node: HTMLElement | null) => void;
};

const ModuleRegistryContext = createContext<ModuleRegistryContextValue | null>(null);

export function ModuleRegistryProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<Partial<Record<ModuleWorkspaceId, ModuleSnapshot>>>(
    {},
  );
  const refs = useRef<Partial<Record<ModuleWorkspaceId, HTMLElement | null>>>({});

  const register = useCallback((snapshot: ModuleSnapshot) => {
    setSnapshots((prev) => {
      const existing = prev[snapshot.id];
      if (
        existing &&
        existing.health === snapshot.health &&
        existing.errorCount === snapshot.errorCount &&
        existing.warningCount === snapshot.warningCount &&
        existing.entityCount === snapshot.entityCount &&
        existing.lockedCount === snapshot.lockedCount &&
        existing.loading === snapshot.loading &&
        existing.readiness === snapshot.readiness &&
        existing.locked === snapshot.locked
      ) {
        return prev;
      }
      return { ...prev, [snapshot.id]: snapshot };
    });
  }, []);

  const setModuleRef = useCallback((id: ModuleWorkspaceId, node: HTMLElement | null) => {
    refs.current[id] = node;
  }, []);

  const scrollToModule = useCallback((id: ModuleWorkspaceId) => {
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const value = useMemo(
    () => ({ snapshots, register, scrollToModule, setModuleRef }),
    [snapshots, register, scrollToModule, setModuleRef],
  );

  return (
    <ModuleRegistryContext.Provider value={value}>{children}</ModuleRegistryContext.Provider>
  );
}

export function useModuleRegistry() {
  const ctx = useContext(ModuleRegistryContext);
  if (!ctx) {
    throw new Error("useModuleRegistry must be used within ModuleRegistryProvider");
  }
  return ctx;
}

export function useOptionalModuleRegistry() {
  return useContext(ModuleRegistryContext);
}
