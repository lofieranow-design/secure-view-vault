import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Image, Video, FileSpreadsheet, Loader2 } from "lucide-react";

const PdfViewer = lazy(() => import("@/components/PdfViewer"));

interface SecureViewerProps {
  file: {
    id: string;
    filename: string;
    filetype: string;
    storage_path: string;
  };
  sessionToken: string;
  accessCode: string;
}

export function SecureViewer({ file, sessionToken, accessCode }: SecureViewerProps) {
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("serve-file", {
          body: { fileId: file.id, sessionToken },
        });

        if (fnError || !data?.signedUrl) {
          setError("Failed to load file");
          setLoading(false);
          return;
        }

        const response = await fetch(data.signedUrl);
        if (!response.ok) {
          setError("Failed to download file");
          setLoading(false);
          return;
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      } catch {
        setError("Failed to load file");
      }
      setLoading(false);
    };

    fetchFile();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.id, sessionToken]);

  // Watermark overlay for images rendered on canvas
  useEffect(() => {
    if (!url || !file.filetype.startsWith("image/") || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#000";
      ctx.font = `${Math.max(16, img.width / 30)}px sans-serif`;
      ctx.translate(img.width / 2, img.height / 2);
      ctx.rotate(-Math.PI / 4);

      const text = `Protected • ${accessCode.slice(0, 8)} • ${new Date().getFullYear()}`;
      const lineHeight = Math.max(40, img.width / 15);
      for (let y = -img.height; y < img.height; y += lineHeight) {
        for (let x = -img.width; x < img.width; x += ctx.measureText(text).width + 60) {
          ctx.fillText(text, x, y);
        }
      }
      ctx.restore();
    };
    img.src = url;
  }, [url, file.filetype, accessCode]);

  const icon = () => {
    if (file.filetype.includes("pdf")) return <FileText className="h-4 w-4" />;
    if (file.filetype.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (file.filetype.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <FileSpreadsheet className="h-4 w-4" />;
  };

  const watermarkText = `Protected • ${accessCode.slice(0, 8)} • ${new Date().getFullYear()}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 py-3">
        {icon()}
        <CardTitle className="text-sm font-medium">{file.filename}</CardTitle>
        <Badge variant="secondary" className="ml-auto font-mono text-xs">
          {file.filetype.split("/").pop()}
        </Badge>
      </CardHeader>
      <CardContent className="relative p-0">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="py-10 text-center text-sm text-destructive">{error}</div>
        )}

        {!loading && !error && url && (
          <div className="relative select-none" onContextMenu={(e) => e.preventDefault()}>
            {/* PDF Viewer - lazy loaded */}
            {file.filetype.includes("pdf") && (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <PdfViewer url={url} watermarkText={watermarkText} />
              </Suspense>
            )}

            {/* Image Viewer - Canvas with watermark */}
            {file.filetype.startsWith("image/") && (
              <canvas
                ref={canvasRef}
                className="mx-auto max-h-[600px] w-auto max-w-full"
                style={{ imageRendering: "auto" }}
              />
            )}

            {/* Video Viewer */}
            {file.filetype.startsWith("video/") && (
              <div className="relative">
                <video
                  src={url}
                  controls
                  controlsList="nodownload"
                  disablePictureInPicture
                  className="max-h-[600px] w-full"
                  onContextMenu={(e) => e.preventDefault()}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="rotate-[-30deg] font-mono text-lg text-foreground/10">
                    {watermarkText}
                  </p>
                </div>
              </div>
            )}

            {/* Other file types */}
            {!file.filetype.includes("pdf") &&
              !file.filetype.startsWith("image/") &&
              !file.filetype.startsWith("video/") && (
                <div className="py-10 text-center">
                  <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Document preview is not available for this file type.
                  </p>
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
