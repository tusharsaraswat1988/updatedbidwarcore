import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  Bold,
  Columns2,
  Heading1,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Palette,
  RectangleHorizontal,
  Table,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TOOLBAR_BTN_CLASS =
  "h-8 w-8 shrink-0 cursor-pointer bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:scale-[0.98]";

type ToolbarBtnProps = {
  onClick: () => void;
  onMouseDown: (event: MouseEvent) => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

function ToolbarBtn({ onClick, onMouseDown, title, children, className }: ToolbarBtnProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(TOOLBAR_BTN_CLASS, className)}
      onMouseDown={onMouseDown}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

const MERGE_VARS = [
  "{{team_name}}",
  "{{owner_name}}",
  "{{player_name}}",
  "{{tournament_name}}",
  "{{auction_name}}",
  "{{auction_date}}",
  "{{match_date}}",
  "{{login_link}}",
  "{{email}}",
  "{{phone}}",
  "{{payment_link}}",
  "{{support_number}}",
  "{{organiser_name}}",
  "{{organiser_phone}}",
  "{{organiser_email}}",
  "{{amount}}",
  "{{current_year}}",
  "{{bidwar_logo}}",
  "{{tournament_logo}}",
  "{{sport_name}}",
  "{{registration_id}}",
  "{{registration_date}}",
  "{{venue}}",
  "{{tournament_dates}}",
];

const EMAIL_TEXT_COLORS = [
  { label: "Dark", value: "#111111" },
  { label: "Body", value: "#444444" },
  { label: "BidWar Gold", value: "#F4B400" },
  { label: "Muted", value: "#777777" },
  { label: "White", value: "#FFFFFF" },
  { label: "Link Blue", value: "#2563eb" },
  { label: "Success", value: "#16a34a" },
  { label: "Red", value: "#dc2626" },
] as const;

type EmailRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  previewHtml?: string;
  previewSubject?: string;
};

export function EmailRichEditor({ value, onChange, previewHtml, previewSubject }: EmailRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const lastHtmlRef = useRef(value);
  const isInternalChangeRef = useRef(false);
  const initializedRef = useRef(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [colorOpen, setColorOpen] = useState(false);
  const [customTextColor, setCustomTextColor] = useState("#111111");

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (
      selection &&
      selection.rangeCount > 0 &&
      editorRef.current?.contains(selection.anchorNode)
    ) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const selection = window.getSelection();
    const range = savedSelectionRef.current;
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const syncHtml = useCallback(
    (html: string) => {
      isInternalChangeRef.current = true;
      lastHtmlRef.current = html;
      onChange(html);
    },
    [onChange],
  );

  const exec = useCallback(
    (command: string, val?: string) => {
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand(command, false, val);
      if (editorRef.current) syncHtml(editorRef.current.innerHTML);
    },
    [restoreSelection, syncHtml],
  );

  const handleToolbarMouseDown = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      saveSelection();
    },
    [saveSelection],
  );

  useEffect(() => {
    if (!editorRef.current) return;

    if (!initializedRef.current) {
      editorRef.current.innerHTML = value;
      lastHtmlRef.current = value;
      initializedRef.current = true;
      return;
    }

    if (value !== lastHtmlRef.current && !isInternalChangeRef.current) {
      editorRef.current.innerHTML = value;
    }
    lastHtmlRef.current = value;
    isInternalChangeRef.current = false;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) syncHtml(editorRef.current.innerHTML);
  };

  const insertMergeVar = (variable: string) => {
    exec("insertText", variable);
  };

  const insertTable = () => {
    const table = `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><tr><td style="border:1px solid #e5e7eb;padding:8px;">Cell 1</td><td style="border:1px solid #e5e7eb;padding:8px;">Cell 2</td></tr><tr><td style="border:1px solid #e5e7eb;padding:8px;">Cell 3</td><td style="border:1px solid #e5e7eb;padding:8px;">Cell 4</td></tr></table>`;
    exec("insertHTML", table);
  };

  const insertColumns = () => {
    const cols = `<table style="width:100%;border-collapse:collapse;"><tr><td style="width:50%;vertical-align:top;padding:8px;">Column 1</td><td style="width:50%;vertical-align:top;padding:8px;">Column 2</td></tr></table>`;
    exec("insertHTML", cols);
  };

  const insertImage = () => {
    saveSelection();
    const url = prompt("Image URL:");
    if (url) exec("insertHTML", `<img src="${url}" alt="" style="max-width:100%;height:auto;" />`);
  };

  const insertDivider = () => {
    exec("insertHTML", `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`);
  };

  const insertButton = () => {
    exec(
      "insertHTML",
      `<a href="{{login_link}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Click Here</a>`,
    );
  };

  const applyTextColor = (color: string) => {
    exec("foreColor", color);
    setCustomTextColor(color);
    setColorOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/40 p-2">
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("underline")} title="Underline">
          <Underline className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("formatBlock", "<h1>")} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("formatBlock", "<h2>")} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("insertUnorderedList")} title="Bullet list">
          <List className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("insertOrderedList")} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("justifyLeft")} title="Align left">
          <AlignLeft className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={() => exec("justifyCenter")} title="Align center">
          <AlignCenter className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn
          onMouseDown={handleToolbarMouseDown}
          onClick={() => {
            saveSelection();
            setLinkOpen(true);
          }}
          title="Link"
        >
          <Link className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={insertImage} title="Image">
          <Image className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={insertTable} title="Table">
          <Table className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={insertColumns} title="Columns">
          <Columns2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={insertDivider} title="Divider">
          <Minus className="h-4 w-4" />
        </ToolbarBtn>
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={TOOLBAR_BTN_CLASS}
              onMouseDown={handleToolbarMouseDown}
              title="Text color"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Text color</p>
            <div className="grid grid-cols-4 gap-2">
              {EMAIL_TEXT_COLORS.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  title={swatch.label}
                  className="h-8 w-8 cursor-pointer rounded-md border shadow-xs transition-transform hover:scale-105 active:scale-95"
                  style={{ backgroundColor: swatch.value }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyTextColor(swatch.value)}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Label htmlFor="email-editor-text-color" className="shrink-0 text-xs">
                Custom
              </Label>
              <input
                id="email-editor-text-color"
                type="color"
                value={customTextColor}
                onChange={(event) => applyTextColor(event.target.value)}
                className="h-8 w-full cursor-pointer rounded border bg-background"
              />
            </div>
          </PopoverContent>
        </Popover>
        <ToolbarBtn onMouseDown={handleToolbarMouseDown} onClick={insertButton} title="Insert button">
          <RectangleHorizontal className="h-4 w-4" />
        </ToolbarBtn>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 cursor-pointer bg-background px-2.5 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground active:scale-[0.98]"
          onMouseDown={handleToolbarMouseDown}
          onClick={() => exec("backColor", "#fef3c7")}
          title="Highlight selected text"
        >
          Highlight
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {MERGE_VARS.map((v) => (
          <button
            key={v}
            type="button"
            className="cursor-pointer rounded border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary shadow-xs transition-colors hover:border-primary/40 hover:bg-primary/20 active:scale-[0.98]"
            onMouseDown={handleToolbarMouseDown}
            onClick={() => insertMergeVar(v)}
          >
            {v}
          </button>
        ))}
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Editor</TabsTrigger>
          <TabsTrigger value="preview">HTML Preview</TabsTrigger>
          <TabsTrigger value="desktop">Desktop Preview</TabsTrigger>
          <TabsTrigger value="mobile">Mobile Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <div
            ref={editorRef}
            contentEditable
            className="min-h-[320px] rounded-lg border bg-background p-4 text-sm prose prose-sm dark:prose-invert max-w-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            onInput={handleInput}
            onBlur={saveSelection}
            suppressContentEditableWarning
          />
        </TabsContent>
        <TabsContent value="preview">
          <pre className="max-h-[400px] overflow-auto rounded-lg border bg-muted/30 p-4 text-xs">
            {value}
          </pre>
        </TabsContent>
        <TabsContent value="desktop">
          <div className="mx-auto max-w-[640px] rounded-lg border bg-white p-6 text-black shadow-lg">
            {previewSubject && <p className="mb-4 text-xs text-gray-500">Subject: {previewSubject}</p>}
            <div dangerouslySetInnerHTML={{ __html: previewHtml ?? value }} />
          </div>
        </TabsContent>
        <TabsContent value="mobile">
          <div className="mx-auto w-[375px] rounded-2xl border-4 border-gray-800 bg-white p-4 text-black shadow-xl">
            {previewSubject && <p className="mb-3 text-[10px] text-gray-500">Subject: {previewSubject}</p>}
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: previewHtml ?? value }} />
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                exec("createLink", linkUrl);
                setLinkOpen(false);
              }}
            >
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
