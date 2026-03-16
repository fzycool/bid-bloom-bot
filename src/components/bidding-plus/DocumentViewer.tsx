import React, { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DocContent =
  | { type: "empty" }
  | { type: "loading"; progress?: string }
  | { type: "html"; html: string; plainText: string }
  | { type: "images"; pages: string[]; plainText: string };

interface DocumentViewerProps {
  content: DocContent;
  onAddFromSelection: (selectedText: string) => void;
}

export default function DocumentViewer({ content, onAddFromSelection }: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floatingBtn, setFloatingBtn] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setTimeout(() => setFloatingBtn(null), 200);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || !containerRef.current) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setFloatingBtn({
      x: Math.min(rect.right - containerRect.left, containerRect.width - 130),
      y: rect.top - containerRect.top - 36 + containerRef.current.scrollTop,
      text: selectedText,
    });
  }, []);

  const handleAdd = useCallback(() => {
    if (floatingBtn) {
      onAddFromSelection(floatingBtn.text);
      setFloatingBtn(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [floatingBtn, onAddFromSelection]);

  if (content.type === "empty") {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <p>请上传招标文件以开始</p>
      </div>
    );
  }

  if (content.type === "loading") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p>{content.progress || "正在解析文件..."}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-auto"
      onMouseUp={handleMouseUp}
    >
      {content.type === "html" && (
        <div
          className="p-6 select-text doc-html-content"
          dangerouslySetInnerHTML={{ __html: content.html }}
        />
      )}

      {content.type === "images" && (
        <div className="p-4 space-y-2 select-text">
          {content.pages.map((src, i) => (
            <div key={i} className="border border-border rounded-sm overflow-hidden shadow-sm">
              <img
                src={src}
                alt={`第 ${i + 1} 页`}
                className="w-full h-auto"
                draggable={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* Floating "+" button on text selection */}
      {floatingBtn && (
        <div
          className="absolute z-20 animate-in fade-in zoom-in-95 duration-150"
          style={{ left: floatingBtn.x, top: floatingBtn.y }}
        >
          <Button
            size="sm"
            className="h-7 px-2.5 shadow-lg gap-1 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleAdd}
          >
            <Plus className="w-3.5 h-3.5" />
            添加为目录项
          </Button>
        </div>
      )}
    </div>
  );
}
