import { Link } from "wouter";
export {
  inputClass,
  labelClass,
  HubPageShell,
  FormField,
  DarkSelect,
  FormError,
  FormActions,
  FormModal,
  SearchInput,
  CheckboxRow,
  PickerTrigger,
  BtnPrimary,
  BtnSecondary,
} from "@/components/badminton/form-ui";

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="bg-gradient-to-b from-[#0d1529] to-transparent border-b border-white/5 px-6 py-5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div>
          {backHref && (
            <Link
              href={backHref}
              className="text-[#4fc3f7] text-xs font-semibold hover:underline mb-1.5 inline-block"
            >
              ← Back to Hub
            </Link>
          )}
          <h1 className="text-2xl font-black text-white tracking-tight">{title}</h1>
          {subtitle && <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: string;
  title: string;
  desc: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-white font-bold text-lg">{title}</h3>
      <p className="text-white/40 text-sm mt-1 max-w-sm mx-auto">{desc}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-b from-[#0084ff] to-[#0060d3] text-white font-semibold text-sm shadow-lg shadow-[#0070f3]/20 hover:from-[#0090ff] transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
