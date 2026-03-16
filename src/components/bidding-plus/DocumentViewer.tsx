import React, { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DocContent =
  | { type: "empty" }
  | { type: "loading"; progress?: string }
  | { type: "html"; html: string; plainText: string }
  | { type: "images"; pages: string[]; plainText: string }
  | { type: "pdf"; data: ArrayBuffer; plainText: string };

interface DocumentViewerProps {
  content: DocContent;
  onAddFromSelection: (selectedText: string) => void;
}

/** Renders a single PDF page: canvas + transparent text layer for selection */
function PdfPage({ pdf, pageNum }: { pdf: any; pageNum: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      const scale = 2;
      const viewport = page.getViewport({ scale });

      if (cancelled || !containerRef.current) return;

      // Clear previous renders
      containerRef.current.innerHTML = "";

      // Canvas layer
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (cancelled || !containerRef.current) return;
      containerRef.current.appendChild(canvas);

      // Text layer for selection
      const textContent = await page.getTextContent();
      const textDiv = document.createElement("div");
      textDiv.style.position = "absolute";
      textDiv.style.left = "0";
      textDiv.style.top = "0";
      textDiv.style.right = "0";
      textDiv.style.bottom = "0";
      textDiv.style.overflow = "hidden";
      textDiv.style.lineHeight = "1";

      // We need to scale text layer to match the displayed size
      // The canvas is rendered at `scale` but displayed at 100% width
      // So the text layer coords need to be scaled by (1/scale) relative to viewport
      const pdfjsLib = await import("pdfjs-dist");
      // @ts-ignore - TextLayer API
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textDiv,
        viewport: page.getViewport({ scale: 1 }),
      });
      await textLayer.render();

      // Scale the text div to match actual display size
      // Viewport at scale=1 gives us the "CSS pixel" dimensions of the PDF page
      const vp1 = page.getViewport({ scale: 1 });
      textDiv.style.width = vp1.width + "px";
      textDiv.style.height = vp1.height + "px";
      textDiv.style.transformOrigin = "top left";
      // The container will be sized by the canvas at 100% width
      // So we need to scale the text layer to fill that same space
      // We'll use a ResizeObserver to adjust

      if (cancelled || !containerRef.current) return;
      containerRef.current.appendChild(textDiv);

      // Adjust text layer scale to match canvas display size
      const adjustScale = () => {
        if (!containerRef.current || !canvas) return;
        const displayWidth = canvas.getBoundingClientRect().width;
        const ratio = displayWidth / vp1.width;
        textDiv.style.transform = `scale(${ratio})`;
      };
      adjustScale();

      const observer = new ResizeObserver(adjustScale);
      observer.observe(containerRef.current);

      // Cleanup
      const cleanup = () => observer.disconnect();
      (containerRef.current as any).__cleanup = cleanup;
    })();

    return () => {
      cancelled = true;
      if (containerRef.current && (containerRef.current as any).__cleanup) {
        (containerRef.current as any).__cleanup();
      }
    };
  }, [pdf, pageNum]);

  return (
    <div
      ref={containerRef}
      className="relative border border-border rounded-sm overflow-hidden shadow-sm mb-2 select-text"
      style={{ userSelect: "text" }}
    />
  );
}

export default function DocumentViewer({ content, onAddFromSelection }: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floatingBtn, setFloatingBtn] = useState<{ x: number; y: number; text: string } | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);

  // Load PDF document when content changes
  useEffect(() => {
    if (content.type !== "pdf") {
      setPdfDoc(null);
      setPdfPageCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const pdf = await pdfjsLib.getDocument({ data: content.data.slice(0) }).promise;
      if (!cancelled) {
        setPdfDoc(pdf);
        setPdfPageCount(pdf.numPages);
      }
    })();
    return () => { cancelled = true; };
  }, [content]);

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

      {content.type === "pdf" && pdfDoc && (
        <div className="p-4 space-y-2">
          {Array.from({ length: pdfPageCount }, (_, i) => (
            <PdfPage key={i} pdf={pdfDoc} pageNum={i + 1} />
          ))}
        </div>
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
