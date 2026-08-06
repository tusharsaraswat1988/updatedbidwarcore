/**
 * OperatorForm primitives
 * Auction: organizer form field patterns
 * Badminton: FormField / FormError / FormActions / input tokens (form-ui.tsx)
 *
 * Phase 1: re-export canonical badminton form primitives under platform name.
 * Progressive rewire can import from here; form-ui remains the implementation
 * until a later extract moves the function bodies.
 */
export {
  FormField,
  FormError,
  FormActions,
  inputClass,
  labelClass,
  DarkSelect,
} from "@/components/badminton/form-ui";
