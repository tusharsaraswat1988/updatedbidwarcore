export type BroadcastTemplateBinding = {
  id: number;
  name: string;
  details: string;
};

export type BroadcastTemplateBindState = {
  selectedTemplateId: number | null;
  replaceTemplateId: number | null;
};

/**
 * A selected template means the draft still matches it.
 * The moment the operator types a different name or details, that template
 * moves to replaceTemplateId. Save then creates a new row. Update stays
 * available only as an explicit action against the previous template.
 */
export function bindBroadcastTemplateDraft(
  state: BroadcastTemplateBindState,
  draft: { name: string; details: string },
  templates: BroadcastTemplateBinding[],
): BroadcastTemplateBindState {
  const trimmedName = draft.name.trim();
  const trimmedDetails = draft.details.trim();
  const matches = (template: BroadcastTemplateBinding) =>
    trimmedName === template.name && trimmedDetails === template.details;

  if (state.selectedTemplateId != null) {
    const loaded = templates.find((template) => template.id === state.selectedTemplateId);
    if (!loaded || matches(loaded)) return state;
    return { selectedTemplateId: null, replaceTemplateId: loaded.id };
  }

  if (state.replaceTemplateId != null) {
    const target = templates.find((template) => template.id === state.replaceTemplateId);
    if (target && matches(target)) {
      return { selectedTemplateId: target.id, replaceTemplateId: null };
    }
  }

  return state;
}
