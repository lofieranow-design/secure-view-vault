import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, FileText, Image, Video, FileSpreadsheet, ImagePlus, MoreVertical, Search, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  if (type.includes("pdf")) return <FileText className="h-5 w-5 text-muted-foreground" />;
  if (type.includes("image")) return <Image className="h-5 w-5 text-muted-foreground" />;
  if (type.includes("video")) return <Video className="h-5 w-5 text-muted-foreground" />;
  return <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />;
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
  const [search, setSearch] = useState("");
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

      if (dbError) toast.error(`Failed to save ${file.name} record`);
      else toast.success(`Uploaded ${file.name}`);
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

    if (uploadError) { toast.error("Failed to upload thumbnail"); return; }

    const { error: dbError } = await supabase
      .from("files")
      .update({ thumbnail_path: path } as any)
      .eq("id", fileId);

    if (dbError) toast.error("Failed to save thumbnail");
    else toast.success("Thumbnail uploaded");
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

  const filtered = files.filter((f) =>
    f.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Files</h1>
          <p className="text-sm text-muted-foreground">Manage your digital product samples</p>
        </div>
        <label>
          <Input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.webm,.mov"
            onChange={handleUpload}
          />
          <Button asChild disabled={uploading} size="sm" className="gradient-gold text-primary-foreground border-0 hover:opacity-90">
            <span className="cursor-pointer">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {uploading ? "Uploading…" : "Upload"}
            </span>
          </Button>
        </label>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search files…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? "No files match your search" : "No files uploaded yet"}
          </p>
          {!search && (
            <label className="mt-3">
              <Input type="file" className="hidden" multiple onChange={handleUpload} />
              <Button variant="outline" asChild size="sm">
                <span className="cursor-pointer text-[13px]">Upload your first file</span>
              </Button>
            </label>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((file) => (
            <div
              key={file.id}
              className="group relative overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-accent/30"
            >
              <div className="flex h-32 items-center justify-center bg-muted/40">
                {thumbnailUrls[file.id] ? (
                  <img src={thumbnailUrls[file.id]} alt={file.filename} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    {fileIcon(file.filetype)}
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">
                      {file.filetype.split("/").pop()}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3">
                <p className="truncate text-[13px] font-medium text-foreground">{file.filename}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatSize(file.filesize)} · {new Date(file.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-7 w-7 rounded-md shadow-sm">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <label className="cursor-pointer">
                        <Input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleThumbnailUpload(file.id, e)}
                        />
                        <div className="flex items-center gap-2">
                          <ImagePlus className="h-3.5 w-3.5" />
                          {file.thumbnail_path ? "Replace Thumbnail" : "Add Thumbnail"}
                        </div>
                      </label>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDelete(file)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
