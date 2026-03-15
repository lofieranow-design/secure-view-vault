import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FREE_PREVIEW_PAGES = 3;

interface PdfViewerProps {
  url: string;
  watermarkText: string;
}

export default function PdfViewer({ url, watermarkText }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const isLocked = currentPage > FREE_PREVIEW_PAGES;

  return (
    <div className="relative">
      <div className="flex max-h-[600px] items-start justify-center overflow-auto bg-muted/30 p-4">
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
          error={
            <div className="py-10 text-center text-sm text-destructive">
              Failed to render PDF.
            </div>
          }
        >
          {isLocked ? (
            <div
              className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-12"
              style={{ width: Math.min(800, window.innerWidth - 80), minHeight: 500 }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-center font-display text-xl font-bold text-foreground">
                Preview Limited
              </h3>
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                You've reached the end of the free preview. Purchase the full version to access all {numPages} pages.
              </p>
              <Button className="mt-2" size="lg">
                Get Full Version
              </Button>
            </div>
          ) : (
            <Page
              pageNumber={currentPage}
              width={Math.min(800, window.innerWidth - 80)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          )}
        </Document>
      </div>

      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-border bg-card py-2">
          <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {numPages}
            {numPages > FREE_PREVIEW_PAGES && (
              <span className="ml-1 text-xs text-muted-foreground/60">
                ({FREE_PREVIEW_PAGES} free)
              </span>
            )}
          </span>
          <Button variant="ghost" size="sm" disabled={currentPage >= numPages} onClick={() => setCurrentPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {!isLocked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="rotate-[-30deg] opacity-30">
            {Array.from({ length: 8 }).map((_, i) => (
              <p key={i} className="my-12 whitespace-nowrap font-mono text-2xl font-bold text-foreground">
                {watermarkText}{"    "}{watermarkText}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
