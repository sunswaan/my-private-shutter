import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Loader2, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Version {
  id: string;
  version_number: number;
  url: string;
  edit_metadata: any;
  created_at: string;
}

interface VersionHistoryProps {
  photoId: string;
  onRestore: (version: Version) => void;
}

export const VersionHistory = ({ photoId, onRestore }: VersionHistoryProps) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [photoId]);

  const fetchVersions = async () => {
    try {
      const { data, error } = await supabase
        .from("photo_versions")
        .select("*")
        .eq("photo_id", photoId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error: any) {
      console.error("Error fetching versions:", error);
      toast.error("Failed to load version history");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (versionId: string, storagePath: string) => {
    setDeleting(versionId);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("photos")
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("photo_versions")
        .delete()
        .eq("id", versionId);

      if (dbError) throw dbError;

      toast.success("Version deleted");
      fetchVersions();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete version");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground text-sm">No saved versions yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 pr-4">
        {versions.map((version) => (
          <Card key={version.id} className="p-3 bg-card border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Version {version.version_number}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(version.created_at).toLocaleString()}
                </p>
                {version.edit_metadata && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {version.edit_metadata.filter && `Filter: ${version.edit_metadata.filter}`}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestore(version)}
                  className="h-8 w-8 p-0"
                >
                  <RotateCw className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(version.id, version.url)}
                  disabled={deleting === version.id}
                  className="h-8 w-8 p-0"
                >
                  {deleting === version.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};
