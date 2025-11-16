import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Trash2, Shield, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useEncryption } from "@/hooks/useEncryption";
import { extractFromBlob, decryptData } from "@/lib/encryption";
import { PhotoViewer } from "./PhotoViewer";
import { ImageEditor } from "./ImageEditor";

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
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [decryptedImages, setDecryptedImages] = useState<Map<string, string>>(new Map());
  const [decrypting, setDecrypting] = useState<Set<string>>(new Set());
  const { encryptionKey } = useEncryption();

  const decryptPhoto = async (photo: Photo) => {
    if (!encryptionKey || decryptedImages.has(photo.id) || decrypting.has(photo.id)) {
      return;
    }

    setDecrypting(prev => new Set(prev).add(photo.id));

    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      
      const { iv, encryptedData } = await extractFromBlob(blob);
      const decryptedData = await decryptData(encryptedData, iv, encryptionKey);
      
      const decryptedBlob = new Blob([decryptedData]);
      const objectUrl = URL.createObjectURL(decryptedBlob);
      
      setDecryptedImages(prev => new Map(prev).set(photo.id, objectUrl));
    } catch (error) {
      console.error("Decryption error:", error);
      toast.error("Failed to decrypt photo");
    } finally {
      setDecrypting(prev => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
    }
  };

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
      
      // Start decrypting photos
      if (encryptionKey && data) {
        data.forEach(photo => decryptPhoto(photo));
      }
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

  // Real-time synchronization across devices
  useEffect(() => {
    const channel = supabase
      .channel('photos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'photos'
        },
        (payload) => {
          console.log('Photo change detected:', payload);
          // Refresh photos when any change occurs
          fetchPhotos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Decrypt photos when encryption key becomes available
    if (encryptionKey && photos.length > 0) {
      photos.forEach(photo => decryptPhoto(photo));
    }
  }, [encryptionKey, photos]);

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
        {photos.map((photo) => {
          const decryptedUrl = decryptedImages.get(photo.id);
          const isDecrypting = decrypting.has(photo.id);
          
          return (
            <Card
              key={photo.id}
              className="group overflow-hidden cursor-pointer bg-card border-border hover:shadow-[var(--shadow-elegant)] transition-all duration-300 hover:scale-[1.02]"
              onClick={() => setSelectedPhoto(photo)}
            >
              <div className="aspect-square overflow-hidden relative">
                {isDecrypting ? (
                  <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : decryptedUrl ? (
                  <img
                    src={decryptedUrl}
                    alt={photo.title || "Photo"}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              {photo.title && (
                <div className="p-3 bg-card/95 backdrop-blur-sm">
                  <h3 className="font-medium truncate text-foreground">{photo.title}</h3>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-7xl bg-background border-border p-0 overflow-hidden">
          {selectedPhoto && (
            <>
              {decryptedImages.get(selectedPhoto.id) ? (
                <PhotoViewer
                  imageUrl={decryptedImages.get(selectedPhoto.id)!}
                  alt={selectedPhoto.title || "Photo"}
                  onClose={() => setSelectedPhoto(null)}
                />
              ) : (
                <div className="w-full h-[60vh] flex items-center justify-center bg-secondary/20">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              )}
              
              {/* Photo Info and Action Buttons */}
              {decryptedImages.get(selectedPhoto.id) && (
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background/80 to-transparent">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
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
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="icon"
                        onClick={() => {
                          setEditingPhoto(selectedPhoto);
                          setSelectedPhoto(null);
                        }}
                        className="shadow-lg"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Editor Dialog */}
      <Dialog open={!!editingPhoto} onOpenChange={() => setEditingPhoto(null)}>
        <DialogContent className="max-w-full h-screen p-0 bg-background border-0 m-0">
          {editingPhoto && decryptedImages.get(editingPhoto.id) && (
            <ImageEditor
              photoId={editingPhoto.id}
              imageUrl={decryptedImages.get(editingPhoto.id)!}
              alt={editingPhoto.title || "Photo"}
              onClose={() => setEditingPhoto(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
