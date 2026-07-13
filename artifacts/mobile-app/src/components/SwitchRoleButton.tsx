import { useLocation } from "wouter";

type Props = {
  className?: string;
  label?: string;
};

/** Small control on every login screen and Settings to switch roles anytime. */
export function SwitchRoleButton({ className = "", label = "Switch Role" }: Props) {
  const [, setLocation] = useLocation();

  return (
    <button
      type="button"
      onClick={() => setLocation("/select-role")}
      className={
        className ||
        "text-sm font-semibold text-[#a1a1aa] hover:text-amber-400 transition-colors underline-offset-4 hover:underline"
      }
    >
      {label}
    </button>
  );
}
