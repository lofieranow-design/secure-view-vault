import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, FileText, Image, Video, FileSpreadsheet, ImagePlus } from "lucide-react";
import { toast } from "sonner";

interface FileRecord {
  id: string;
  filename: string;
  filetype: string;
  filesize: number | null;
  storage_path: string;
  thumbnail_path: string | null;
  created_at: string;
}

const fileIcon = (type: string) => {
  if (type.includes("pdf")) return <FileText className="h-4 w-4 text-destructive" />;
  if (type.includes("image")) return <Image className="h-4 w-4 text-accent" />;
  if (type.includes("video")) return <Video className="h-4 w-4 text-primary" />;
  return <FileSpreadsheet className="h-4 w-4 text-warning" />;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export default function AdminFiles() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const fetchFiles = useCallback(async () => {
    const { data } = await supabase.from("files").select("*").order("created_at", { ascending: false });
    if (data) setFiles(data as FileRecord[]);
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);

    for (const file of Array.from(fileList)) {
      const path = `${crypto.randomUUID()}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("digital-products")
        .upload(path, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { error: dbError } = await supabase.from("files").insert({
        filename: file.name,
        filetype: file.type,
        filesize: file.size,
        storage_path: path,
        uploaded_by: user?.id,
      });

      if (dbError) {
        toast.error(`Failed to save ${file.name} record`);
      } else {
        toast.success(`Uploaded ${file.name}`);
      }
    }

    setUploading(false);
    fetchFiles();
    e.target.value = "";
  };

  const handleThumbnailUpload = async (fileId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const thumbFile = e.target.files?.[0];
    if (!thumbFile) return;

    const path = `thumbnails/${fileId}/${thumbFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("digital-products")
      .upload(path, thumbFile, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload thumbnail");
      return;
    }

    const { error: dbError } = await supabase
      .from("files")
      .update({ thumbnail_path: path } as any)
      .eq("id", fileId);

    if (dbError) {
      toast.error("Failed to save thumbnail");
    } else {
      toast.success("Thumbnail uploaded");
    }
    fetchFiles();
    e.target.value = "";
  };

  const handleDelete = async (file: FileRecord) => {
    const pathsToRemove = [file.storage_path];
    if (file.thumbnail_path) pathsToRemove.push(file.thumbnail_path);

    await supabase.storage.from("digital-products").remove(pathsToRemove);
    await supabase.from("files").delete().eq("id", file.id);
    toast.success(`Deleted ${file.filename}`);
    fetchFiles();
  };

  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadThumbnails = async () => {
      const urls: Record<string, string> = {};
      for (const file of files) {
        if (file.thumbnail_path) {
          const { data } = await supabase.storage
            .from("digital-products")
            .createSignedUrl(file.thumbnail_path, 3600);
          if (data?.signedUrl) urls[file.id] = data.signedUrl;
        }
      }
      setThumbnailUrls(urls);
    };
    if (files.length > 0) loadThumbnails();
  }, [files]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Files</h1>
        <label>
          <Input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.webm,.mov"
            onChange={handleUpload}
          />
          <Button asChild disabled={uploading}>
            <span className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload Files"}
            </span>
          </Button>
        </label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Files</CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No files uploaded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Thumbnail</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="flex items-center gap-2 font-medium">
                      {fileIcon(file.filetype)}
                      <span className="truncate max-w-[200px]">{file.filename}</span>
                    </TableCell>
                    <TableCell>
                      {file.thumbnail_path ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={thumbnailUrls[file.id] || ""}
                            alt="thumb"
                            className="h-10 w-10 rounded object-cover border border-border"
                          />
                          <label className="cursor-pointer">
                            <Input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => handleThumbnailUpload(file.id, e)}
                            />
                            <span className="text-xs text-primary hover:underline">Replace</span>
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleThumbnailUpload(file.id, e)}
                          />
                          <Button variant="ghost" size="sm" asChild>
                            <span>
                              <ImagePlus className="mr-1 h-3.5 w-3.5" />
                              Add
                            </span>
                          </Button>
                        </label>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {file.filetype.split("/").pop()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatSize(file.filesize)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(file.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(file)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
