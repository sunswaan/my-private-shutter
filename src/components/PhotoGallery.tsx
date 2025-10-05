import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

interface Photo {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  storage_path: string;
  created_at: string;
}

interface PhotoGalleryProps {
  refreshTrigger: number;
}

export const PhotoGallery = ({ refreshTrigger }: PhotoGalleryProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPhotos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error: any) {
      console.error("Error fetching photos:", error);
      toast.error("Failed to load photos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPhoto) return;
    
    setDeleting(true);
    try {
      const { error: storageError } = await supabase.storage
        .from("photos")
        .remove([selectedPhoto.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("id", selectedPhoto.id);

      if (dbError) throw dbError;

      toast.success("Photo deleted");
      setSelectedPhoto(null);
      fetchPhotos();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Failed to delete photo");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg">No photos yet. Upload your first photo to get started!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <Card
            key={photo.id}
            className="group overflow-hidden cursor-pointer bg-card border-border hover:shadow-[var(--shadow-elegant)] transition-all duration-300 hover:scale-[1.02]"
            onClick={() => setSelectedPhoto(photo)}
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={photo.url}
                alt={photo.title || "Photo"}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            {photo.title && (
              <div className="p-3 bg-card/95 backdrop-blur-sm">
                <h3 className="font-medium truncate text-foreground">{photo.title}</h3>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl bg-background/95 backdrop-blur-xl border-border p-0 overflow-hidden">
          {selectedPhoto && (
            <div className="relative">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title || "Photo"}
                className="w-full max-h-[80vh] object-contain"
              />
              <div className="absolute top-4 right-4">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="shadow-lg"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {(selectedPhoto.title || selectedPhoto.description) && (
                <div className="p-6 bg-gradient-to-t from-background to-transparent">
                  {selectedPhoto.title && (
                    <h2 className="text-2xl font-bold mb-2 text-foreground">{selectedPhoto.title}</h2>
                  )}
                  {selectedPhoto.description && (
                    <p className="text-muted-foreground">{selectedPhoto.description}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    {new Date(selectedPhoto.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
