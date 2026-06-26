import { useCallback, useRef, useState } from "react";
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
  Table,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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
  "{{amount}}",
  "{{current_year}}",
];

type EmailRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  previewHtml?: string;
  previewSubject?: string;
};

export function EmailRichEditor({ value, onChange, previewHtml, previewSubject }: EmailRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-2">
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("underline")} title="Underline">
          <Underline className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("formatBlock", "h1")} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("formatBlock", "h2")} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("insertUnorderedList")} title="Bullet list">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("insertOrderedList")} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("justifyLeft")} title="Align left">
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("justifyCenter")} title="Align center">
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLinkOpen(true)} title="Link">
          <Link className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={insertImage} title="Image">
          <Image className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={insertTable} title="Table">
          <Table className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={insertColumns} title="Columns">
          <Columns2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={insertDivider} title="Divider">
          <Minus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={insertButton} title="Button">
          <Palette className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => exec("backColor", "#fef3c7")}
        >
          Highlight
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {MERGE_VARS.map((v) => (
          <button
            key={v}
            type="button"
            className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary hover:bg-primary/20"
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
            dangerouslySetInnerHTML={{ __html: value }}
            onInput={handleInput}
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
