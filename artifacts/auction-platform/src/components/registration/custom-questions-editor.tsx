import { useState } from "react";
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
  Eye,
  CheckCircle2,
  X,
} from "lucide-react";

const QUESTION_TYPE_LABELS: Record<RegistrationQuestionType, string> = {
  short_text: "Short text",
  number: "Number",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
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
  const [newOptionInputs, setNewOptionInputs] = useState<Record<string, string>>({});
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [showPreview, setShowPreview] = useState(true);

  function handleAddQuestion() {
    const newQ: RegistrationCustomQuestion = {
      id: generateQuestionId(),
      label: "",
      type: "short_text",
      required: false,
    };
    onChange([...questions, newQ]);
  }

  function handleUpdateQuestion(index: number, patch: Partial<RegistrationCustomQuestion>) {
    const next = [...questions];
    const current = next[index];
    if (!current) return;

    const updated: RegistrationCustomQuestion = {
      ...current,
      ...patch,
    };

    // If switching to choice-based type, ensure options array exists
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

  function handleAddOption(questionIndex: number, qId: string) {
    const text = (newOptionInputs[qId] || "").trim();
    if (!text) return;

    const q = questions[questionIndex];
    if (!q) return;

    const existingOptions = q.options ?? [];
    if (!existingOptions.includes(text)) {
      handleUpdateQuestion(questionIndex, {
        options: [...existingOptions, text],
      });
    }

    setNewOptionInputs((prev) => ({ ...prev, [qId]: "" }));
  }

  function handleRemoveOption(questionIndex: number, optionIndex: number) {
    const q = questions[questionIndex];
    if (!q || !q.options) return;
    const nextOptions = q.options.filter((_, i) => i !== optionIndex);
    handleUpdateQuestion(questionIndex, { options: nextOptions });
  }

  return (
    <div className="space-y-4">
      {/* Action header */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            Organizer Custom Questions ({questions.length})
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Collect tournament-specific information (e.g. jersey name, dietary preferences, or kit sizes).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {questions.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview((prev) => !prev)}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddQuestion}
            disabled={disabled}
            className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Question
          </Button>
        </div>
      </div>

      {/* Questions list */}
      {questions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 p-6 text-center bg-muted/5">
          <p className="text-xs text-muted-foreground">
            No custom questions configured. Click <strong className="text-foreground">Add Question</strong> to ask participants for details like preferred batting order, previous club, or transport mode.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const isChoiceType =
              q.type === "single_choice" ||
              q.type === "multiple_choice" ||
              q.type === "dropdown";

            return (
              <div
                key={q.id}
                className="rounded-lg border border-border/80 bg-card p-3 shadow-xs space-y-3 transition-colors hover:border-border"
              >
                {/* Question item header */}
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                      #{idx + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5 py-0 px-2 font-medium bg-muted/40">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </Badge>
                    {q.required ? (
                      <Badge variant="destructive" className="text-[9px] h-4.5 px-1.5 py-0">
                        Required
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] h-4.5 px-1.5 py-0 font-normal text-muted-foreground">
                        Optional
                      </Badge>
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground/60 hidden sm:inline">
                      ID: {q.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={disabled || idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      title="Move up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={disabled || idx === questions.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      title="Move down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={disabled}
                      onClick={() => handleDeleteQuestion(idx)}
                      title="Delete question"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Question details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6 space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Question Label
                    </Label>
                    <Input
                      value={q.label}
                      onChange={(e) => handleUpdateQuestion(idx, { label: e.target.value })}
                      placeholder="e.g. Jersey Print Name"
                      disabled={disabled}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Answer Type
                    </Label>
                    <Select
                      value={q.type}
                      onValueChange={(val: RegistrationQuestionType) =>
                        handleUpdateQuestion(idx, { type: val })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REGISTRATION_QUESTION_TYPES.map((typeKey) => (
                          <SelectItem key={typeKey} value={typeKey} className="text-xs">
                            {QUESTION_TYPE_LABELS[typeKey]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between sm:justify-center gap-2 h-8 pb-1">
                    <Label htmlFor={`req-toggle-${q.id}`} className="text-xs font-medium cursor-pointer">
                      Required
                    </Label>
                    <Switch
                      id={`req-toggle-${q.id}`}
                      checked={q.required}
                      onCheckedChange={(checked) =>
                        handleUpdateQuestion(idx, { required: checked })
                      }
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Option editor for choice types */}
                {isChoiceType && (
                  <div className="space-y-2 pt-1 border-t border-border/30">
                    <Label className="text-[11px] font-medium text-muted-foreground">
                      Selectable Options
                    </Label>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {(q.options ?? []).map((opt, optIdx) => (
                        <span
                          key={optIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-muted border border-border/60 text-foreground"
                        >
                          <span>{opt}</span>
                          {!disabled && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(idx, optIdx)}
                              className="text-muted-foreground hover:text-destructive focus:outline-none"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}

                      {!disabled && (
                        <div className="inline-flex items-center gap-1">
                          <Input
                            value={newOptionInputs[q.id] || ""}
                            onChange={(e) =>
                              setNewOptionInputs((prev) => ({
                                ...prev,
                                [q.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddOption(idx, q.id);
                              }
                            }}
                            placeholder="Add option..."
                            className="h-6 w-28 text-[11px] px-2 py-0"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAddOption(idx, q.id)}
                            className="h-6 px-2 text-[10px]"
                          >
                            Add
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Basic interactive live preview */}
      {showPreview && questions.length > 0 && (
        <div className="mt-4 rounded-lg border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
          <div className="flex items-center gap-1.5 border-b border-primary/20 pb-2">
            <Eye className="w-3.5 h-3.5 text-primary" />
            <h5 className="text-xs font-semibold text-foreground">
              Form Preview (How Participants See These Questions)
            </h5>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {questions.map((q) => {
              const val = previewAnswers[q.id];

              return (
                <div key={q.id} className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>
                      {q.label || <span className="italic text-muted-foreground">Untitled Question</span>}
                      {q.required && <span className="text-destructive ml-1">*</span>}
                    </span>
                    {!q.required && (
                      <span className="text-[10px] text-muted-foreground">Optional</span>
                    )}
                  </label>

                  {q.type === "short_text" && (
                    <Input
                      value={val || ""}
                      onChange={(e) =>
                        setPreviewAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="Type your answer..."
                      className="h-8 text-xs bg-background"
                    />
                  )}

                  {q.type === "number" && (
                    <Input
                      type="number"
                      value={val ?? ""}
                      onChange={(e) =>
                        setPreviewAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      placeholder="0"
                      className="h-8 text-xs bg-background"
                    />
                  )}

                  {q.type === "dropdown" && (
                    <Select
                      value={val || ""}
                      onValueChange={(chosen) =>
                        setPreviewAnswers((prev) => ({ ...prev, [q.id]: chosen }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {(q.options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {q.type === "single_choice" && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {(q.options ?? []).map((opt) => {
                        const isSelected = val === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setPreviewAnswers((prev) => ({ ...prev, [q.id]: opt }))
                            }
                            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary font-medium"
                                : "bg-background text-foreground border-border hover:bg-muted/50"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "multiple_choice" && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {(q.options ?? []).map((opt) => {
                        const selectedList = Array.isArray(val) ? val : [];
                        const isSelected = selectedList.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const next = isSelected
                                ? selectedList.filter((x: string) => x !== opt)
                                : [...selectedList, opt];
                              setPreviewAnswers((prev) => ({ ...prev, [q.id]: next }));
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                              isSelected
                                ? "bg-primary/10 text-primary border-primary/40 font-medium"
                                : "bg-background text-foreground border-border hover:bg-muted/50"
                            }`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-muted-foreground/60"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3 h-3" />}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
