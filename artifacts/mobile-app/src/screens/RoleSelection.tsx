import { motion } from "framer-motion";
import { ClipboardList, Users } from "lucide-react";
import { useLocation } from "wouter";
import type { MobileRoleId } from "@workspace/api-base/mobile-app-urls";
import { AppShell, BrandMark } from "@/components/AppShell";
import { setLastSelectedRole } from "@/lib/role-preference";
import { getEnabledRoles, getRoleModule } from "@/roles/registry";

const ICONS: Record<string, typeof ClipboardList> = {
  organizer: ClipboardList,
  "team-owner": Users,
};

export function RoleSelectionScreen() {
  const [, setLocation] = useLocation();
  const roles = getEnabledRoles();

  function selectRole(roleId: MobileRoleId) {
    const mod = getRoleModule(roleId);
    if (!mod) return;
    setLastSelectedRole(roleId);
    setLocation(mod.loginRoute);
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-4">
            <BrandMark />
            <div>
              <p className="font-display font-black text-4xl text-amber-400 tracking-wide">
                BidWar
              </p>
              <h1 className="font-display font-black text-2xl text-white mt-3">
                Welcome to BidWar
              </h1>
              <p className="text-[#71717a] text-base mt-2 leading-relaxed">
                Choose how you want to continue. Authentication stays separate for each role.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {roles.map((role, i) => {
              const Icon = ICONS[role.id] ?? Users;
              return (
                <motion.button
                  key={role.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectRole(role.id)}
                  className="w-full text-left px-5 py-5 rounded-2xl border border-[#3f3f46] bg-[#18181b] hover:border-amber-400/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-400/15 border border-amber-400/30 shrink-0">
                      <Icon className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-xl text-white">{role.label}</p>
                      <p className="text-[#71717a] text-sm mt-1 leading-relaxed">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
