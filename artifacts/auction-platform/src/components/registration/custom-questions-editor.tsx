import { useState, useRef, useEffect } from "react";
import {
  type RegistrationCustomQuestion,
  type RegistrationQuestionType,
  REGISTRATION_QUESTION_TYPES,
} from "@workspace/api-base/registration-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  Copy,
  CircleDot,
  SquareCheck,
  Sparkles,
} from "lucide-react";

const QUESTION_TYPE_LABELS: Record<RegistrationQuestionType, string> = {
  short_text: "Short text",
  number: "Number",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
};

const QUESTION_TYPE_DESCRIPTIONS: Record<RegistrationQuestionType, string> = {
  short_text: "Free-form single line answer (e.g. Jersey print name, nickname)",
  number: "Numeric entry only (e.g. Previous season runs, wickets)",
  single_choice: "Radio buttons where player can select only one option",
  multiple_choice: "Checkboxes allowing player to pick one or more options",
  dropdown: "Select dropdown with pre-defined list of options",
};

function generateQuestionId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

interface CustomQuestionsEditorProps {
  questions: RegistrationCustomQuestion[];
  onChange: (questions: RegistrationCustomQuestion[]) => void;
  disabled?: boolean;
}

export function CustomQuestionsEditor({
  questions,
  onChange,
  disabled = false,
}: CustomQuestionsEditorProps) {
  const [focusTarget, setFocusTarget] = useState<{ qIdx: number; optIdx: number } | null>(null);
  const optionInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Focus newly added option input when requested
  useEffect(() => {
    if (focusTarget) {
      const key = `${focusTarget.qIdx}-${focusTarget.optIdx}`;
      const el = optionInputRefs.current.get(key);
      if (el) {
        el.focus();
        el.select();
      }
      setFocusTarget(null);
    }
  }, [focusTarget]);

  function handleAddQuestion() {
    const newQ: RegistrationCustomQuestion = {
      id: generateQuestionId(),
      label: "",
      type: "short_text",
      required: false,
    };
    onChange([...questions, newQ]);
  }

  function handleDuplicateQuestion(index: number) {
    const current = questions[index];
    if (!current) return;

    const duplicated: RegistrationCustomQuestion = {
      ...current,
      id: generateQuestionId(),
      label: current.label ? `${current.label} (Copy)` : "",
      options: current.options ? [...current.options] : undefined,
    };

    const next = [...questions];
    next.splice(index + 1, 0, duplicated);
    onChange(next);
  }

  function handleUpdateQuestion(index: number, patch: Partial<RegistrationCustomQuestion>) {
    const next = [...questions];
    const current = next[index];
    if (!current) return;

    const updated: RegistrationCustomQuestion = {
      ...current,
      ...patch,
    };

    // If switching to choice-based type, ensure initial options exist
    if (
      (updated.type === "single_choice" ||
        updated.type === "multiple_choice" ||
        updated.type === "dropdown") &&
      (!updated.options || updated.options.length === 0)
    ) {
      updated.options = ["Option 1", "Option 2"];
    }

    next[index] = updated;
    onChange(next);
  }

  function handleDeleteQuestion(index: number) {
    const next = questions.filter((_, i) => i !== index);
    onChange(next);
  }

  function handleMoveUp(index: number) {
    if (index <= 0) return;
    const next = [...questions];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  }

  function handleMoveDown(index: number) {
    if (index >= questions.length - 1) return;
    const next = [...questions];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  }

  // --- Options Management (Inline Editable) ---
  function handleUpdateOption(questionIndex: number, optionIndex: number, newText: string) {
    const q = questions[questionIndex];
    if (!q || !q.options) return;
    const nextOptions = [...q.options];
    nextOptions[optionIndex] = newText;
    handleUpdateQuestion(questionIndex, { options: nextOptions });
  }

  function handleAddOption(questionIndex: number, insertAfterIndex?: number) {
    const q = questions[questionIndex];
    if (!q) return;

    const currentOptions = q.options ?? [];
    const nextOptions = [...currentOptions];
    const newOptionText = `Option ${nextOptions.length + 1}`;

    let targetIdx = nextOptions.length;
    if (typeof insertAfterIndex === "number" && insertAfterIndex >= 0) {
      targetIdx = insertAfterIndex + 1;
      nextOptions.splice(targetIdx, 0, newOptionText);
    } else {
      nextOptions.push(newOptionText);
    }

    handleUpdateQuestion(questionIndex, { options: nextOptions });
    setFocusTarget({ qIdx: questionIndex, optIdx: targetIdx });
  }

  function handleRemoveOption(questionIndex: number, optionIndex: number) {
    const q = questions[questionIndex];
    if (!q || !q.options) return;
    const nextOptions = q.options.filter((_, i) => i !== optionIndex);
    handleUpdateQuestion(questionIndex, { options: nextOptions });
  }

  function handleMoveOption(questionIndex: number, optionIndex: number, direction: "up" | "down") {
    const q = questions[questionIndex];
    if (!q || !q.options) return;

    const targetIdx = direction === "up" ? optionIndex - 1 : optionIndex + 1;
    if (targetIdx < 0 || targetIdx >= q.options.length) return;

    const nextOptions = [...q.options];
    const temp = nextOptions[targetIdx];
    nextOptions[targetIdx] = nextOptions[optionIndex];
    nextOptions[optionIndex] = temp;
    handleUpdateQuestion(questionIndex, { options: nextOptions });
  }

  return (
    <div className="space-y-4">
      {/* Action header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border/40">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            Organizer Custom Questions ({questions.length})
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Collect tournament-specific details from players during registration (e.g. jersey name, dietary preferences, or kit sizes).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleAddQuestion}
            disabled={disabled}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center bg-muted/10 space-y-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <p className="text-xs font-semibold text-foreground">No custom questions added</p>
            <p className="text-[11px] text-muted-foreground">
              Add custom questions to collect specific information from participants like kit sizes, batting preference, food choices, or previous club history.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddQuestion}
            disabled={disabled}
            className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Question
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const isChoiceType =
              q.type === "single_choice" ||
              q.type === "multiple_choice" ||
              q.type === "dropdown";

            const isChoiceWithoutOptions = isChoiceType && (!q.options || q.options.length === 0);

            return (
              <div
                key={q.id}
                className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3.5 transition-all hover:border-border"
              >
                {/* Question item header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-muted/50 font-semibold text-foreground">
                      #{idx + 1}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px] h-5 py-0 px-2 font-medium">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </Badge>
                    {q.required ? (
                      <Badge variant="destructive" className="text-[10px] h-4.5 px-2 py-0 font-semibold uppercase tracking-wider">
                        Required
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] h-4.5 px-2 py-0 font-normal text-muted-foreground">
                        Optional
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      disabled={disabled || idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      title="Move question up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      disabled={disabled || idx === questions.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      title="Move question down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      disabled={disabled}
                      onClick={() => handleDuplicateQuestion(idx)}
                      title="Duplicate question"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={disabled}
                      onClick={() => handleDeleteQuestion(idx)}
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Question details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-start">
                  <div className="sm:col-span-6 space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/90">
                      Question Label <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={q.label}
                      onChange={(e) => handleUpdateQuestion(idx, { label: e.target.value })}
                      placeholder="e.g. Jersey Print Name, Preferred Batting Order"
                      disabled={disabled}
                      className="h-9 text-xs bg-background"
                    />
                    {!q.label.trim() && (
                      <p className="text-[10px] text-amber-500">
                        Question label cannot be empty.
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-4 space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/90">
                      Answer Type
                    </Label>
                    <Select
                      value={q.type}
                      onValueChange={(val: RegistrationQuestionType) =>
                        handleUpdateQuestion(idx, { type: val })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark">
                        {REGISTRATION_QUESTION_TYPES.map((typeKey) => (
                          <SelectItem key={typeKey} value={typeKey} className="text-xs">
                            {QUESTION_TYPE_LABELS[typeKey]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {QUESTION_TYPE_DESCRIPTIONS[q.type]}
                    </p>
                  </div>

                  <div className="sm:col-span-2 space-y-1.5 flex flex-col justify-end">
                    <Label htmlFor={`req-toggle-${q.id}`} className="text-xs font-medium text-foreground/90">
                      Mandatory
                    </Label>
                    <div className="flex items-center gap-2 h-9">
                      <Switch
                        id={`req-toggle-${q.id}`}
                        checked={q.required}
                        onCheckedChange={(checked) =>
                          handleUpdateQuestion(idx, { required: checked })
                        }
                        disabled={disabled}
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {q.required ? "Required" : "Optional"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Option editor for choice types (Direct Inline Editable List) */}
                {isChoiceType && (
                  <div className="space-y-2.5 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span>Selectable Options</span>
                        <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 py-0 font-mono">
                          {q.options?.length ?? 0}
                        </Badge>
                      </Label>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        Click option text to edit. Press <kbd className="px-1 py-0.5 rounded bg-muted border text-[9px] font-mono">Enter</kbd> to add next option.
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(q.options ?? []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <span className="text-muted-foreground shrink-0 w-5 flex items-center justify-center">
                            {q.type === "single_choice" && (
                              <CircleDot className="w-3.5 h-3.5 text-muted-foreground/70" />
                            )}
                            {q.type === "multiple_choice" && (
                              <SquareCheck className="w-3.5 h-3.5 text-muted-foreground/70" />
                            )}
                            {q.type === "dropdown" && (
                              <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                                {optIdx + 1}.
                              </span>
                            )}
                          </span>

                          <Input
                            ref={(el) => {
                              const key = `${idx}-${optIdx}`;
                              if (el) optionInputRefs.current.set(key, el);
                              else optionInputRefs.current.delete(key);
                            }}
                            value={opt}
                            onChange={(e) => handleUpdateOption(idx, optIdx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddOption(idx, optIdx);
                              }
                            }}
                            placeholder={`Option ${optIdx + 1}`}
                            disabled={disabled}
                            className="h-8 text-xs flex-1 bg-background"
                          />

                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              disabled={disabled || optIdx === 0}
                              onClick={() => handleMoveOption(idx, optIdx, "up")}
                              title="Move option up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              disabled={disabled || optIdx === (q.options?.length ?? 0) - 1}
                              onClick={() => handleMoveOption(idx, optIdx, "down")}
                              title="Move option down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={disabled || (q.options?.length ?? 0) <= 1}
                              onClick={() => handleRemoveOption(idx, optIdx)}
                              title={(q.options?.length ?? 0) <= 1 ? "At least one option is required" : "Remove option"}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="pt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddOption(idx)}
                          disabled={disabled}
                          className="h-7 text-xs gap-1 border-dashed text-primary hover:bg-primary/10"
                        >
                          <Plus className="w-3 h-3" />
                          Add Option
                        </Button>
                        {isChoiceWithoutOptions && (
                          <p className="text-[11px] text-destructive">
                            At least one option is required for this question.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Add Question Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleAddQuestion}
            disabled={disabled}
            className="w-full h-10 text-xs gap-1.5 border-dashed border-border/80 hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Another Question
          </Button>
        </div>
      )}
    </div>
  );
}
