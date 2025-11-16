import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card } from "./ui/card";
import { X, Download, RotateCcw, Eraser, Save, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { pipeline, env } from '@huggingface/transformers';
import { supabase } from "@/integrations/supabase/client";
import { VersionHistory } from "./VersionHistory";
import { encryptFile, createEncryptedBlob } from "@/lib/encryption";
import { useEncryption } from "@/hooks/useEncryption";

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = false;

const MAX_IMAGE_DIMENSION = 1024;

interface ImageEditorProps {
  photoId: string;
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

interface Adjustments {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  highlights: number;
  shadows: number;
  vibrance: number;
}

const filterPresets = {
  none: {},
  vintage: {
    sepia: 0.3,
    contrast: 1.1,
    brightness: 1.05,
    saturate: 0.8,
  },
  blackAndWhite: {
    grayscale: 1,
    contrast: 1.2,
  },
  cinematic: {
    contrast: 1.3,
    saturate: 0.9,
    brightness: 0.95,
    sepia: 0.1,
  },
  warm: {
    saturate: 1.2,
    brightness: 1.05,
    sepia: 0.2,
  },
  cool: {
    saturate: 1.1,
    brightness: 0.98,
    hueRotate: 200,
  },
};

export const ImageEditor = ({ photoId, imageUrl, alt, onClose }: ImageEditorProps) => {
  const [selectedFilter, setSelectedFilter] = useState<keyof typeof filterPresets>("none");
  const [adjustments, setAdjustments] = useState<Adjustments>({
    exposure: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    vibrance: 0,
  });
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { encryptionKey } = useEncryption();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imageRef.current && canvasRef.current) {
      applyFiltersToCanvas();
    }
  }, [selectedFilter, adjustments, imageUrl]);

  const applyFiltersToCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Apply CSS filters
    const filter = filterPresets[selectedFilter];
    const filterString = Object.entries(filter)
      .map(([key, value]) => {
        switch (key) {
          case "sepia":
            return `sepia(${value})`;
          case "grayscale":
            return `grayscale(${value})`;
          case "contrast":
            return `contrast(${value})`;
          case "brightness":
            return `brightness(${value})`;
          case "saturate":
            return `saturate(${value})`;
          case "hueRotate":
            return `hue-rotate(${value}deg)`;
          default:
            return "";
        }
      })
      .join(" ");

    // Apply adjustments
    const exposure = 1 + adjustments.exposure / 100;
    const contrast = 1 + adjustments.contrast / 100;
    const saturation = 1 + adjustments.saturation / 100;

    ctx.filter = `${filterString} brightness(${exposure}) contrast(${contrast}) saturate(${saturation})`;
    ctx.drawImage(img, 0, 0);

    // Apply advanced adjustments
    if (
      adjustments.temperature !== 0 ||
      adjustments.tint !== 0 ||
      adjustments.highlights !== 0 ||
      adjustments.shadows !== 0 ||
      adjustments.vibrance !== 0
    ) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Temperature adjustment (red/blue shift)
        if (adjustments.temperature !== 0) {
          data[i] += adjustments.temperature * 2; // Red
          data[i + 2] -= adjustments.temperature * 2; // Blue
        }

        // Tint adjustment (green/magenta shift)
        if (adjustments.tint !== 0) {
          data[i + 1] += adjustments.tint * 2; // Green
        }

        // Highlights and shadows
        const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (luminance > 128 && adjustments.highlights !== 0) {
          const factor = 1 + adjustments.highlights / 100;
          data[i] *= factor;
          data[i + 1] *= factor;
          data[i + 2] *= factor;
        } else if (luminance <= 128 && adjustments.shadows !== 0) {
          const factor = 1 + adjustments.shadows / 100;
          data[i] *= factor;
          data[i + 1] *= factor;
          data[i + 2] *= factor;
        }

        // Vibrance (selective saturation boost)
        if (adjustments.vibrance !== 0) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const mx = Math.max(data[i], data[i + 1], data[i + 2]);
          const amt = ((Math.abs(mx - avg) * 2) / 255) * (adjustments.vibrance / 100);
          if (data[i] !== mx) data[i] += (mx - data[i]) * amt;
          if (data[i + 1] !== mx) data[i + 1] += (mx - data[i + 1]) * amt;
          if (data[i + 2] !== mx) data[i + 2] += (mx - data[i + 2]) * amt;
        }

        // Clamp values
        data[i] = Math.max(0, Math.min(255, data[i]));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1]));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2]));
      }

      ctx.putImageData(imageData, 0, 0);
    }
  };

  const handleReset = () => {
    setSelectedFilter("none");
    setAdjustments({
      exposure: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      vibrance: 0,
    });
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `edited-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Image downloaded");
      }
    }, "image/png");
  };

  const removeBackground = async () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    setIsRemovingBackground(true);
    toast.info("Removing background... This may take a moment.");
    
    try {
      const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
        device: 'webgpu',
      });
      
      // Create temporary canvas to resize image if needed
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get canvas context');
      
      const img = imageRef.current;
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      
      // Resize if needed
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }
      
      tempCanvas.width = width;
      tempCanvas.height = height;
      tempCtx.drawImage(img, 0, 0, width, height);
      
      // Get image data
      const imageData = tempCanvas.toDataURL('image/jpeg', 0.8);
      
      // Process with segmentation
      const result = await segmenter(imageData);
      
      if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
        throw new Error('Invalid segmentation result');
      }
      
      // Apply mask to original canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      
      const outputImageData = ctx.getImageData(0, 0, width, height);
      const data = outputImageData.data;
      
      // Apply inverted mask to alpha channel
      for (let i = 0; i < result[0].mask.data.length; i++) {
        const alpha = Math.round((1 - result[0].mask.data[i]) * 255);
        data[i * 4 + 3] = alpha;
      }
      
      ctx.putImageData(outputImageData, 0, 0);
      
      toast.success("Background removed successfully!");
    } catch (error) {
      console.error("Background removal error:", error);
      toast.error("Failed to remove background. Please try again.");
    } finally {
      setIsRemovingBackground(false);
    }
  };

  const updateAdjustment = (key: keyof Adjustments, value: number[]) => {
    setAdjustments((prev) => ({ ...prev, [key]: value[0] }));
  };

  const saveVersion = async () => {
    if (!canvasRef.current || !encryptionKey) {
      toast.error("Unable to save version");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the next version number
      const { data: existingVersions } = await supabase
        .from("photo_versions")
        .select("version_number")
        .eq("photo_id", photoId)
        .order("version_number", { ascending: false })
        .limit(1);

      const nextVersionNumber = existingVersions && existingVersions.length > 0
        ? existingVersions[0].version_number + 1
        : 1;

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((b) => resolve(b!), "image/png");
      });

      // Convert blob to file for encryption
      const file = new File([blob], `version-${nextVersionNumber}.png`, { type: "image/png" });

      // Encrypt the file
      const { encryptedData, iv } = await encryptFile(file, encryptionKey);
      const encryptedBlob = createEncryptedBlob(encryptedData, iv);

      // Upload to storage
      const storagePath = `${user.id}/versions/${photoId}-v${nextVersionNumber}-${Date.now()}.enc`;
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(storagePath, encryptedBlob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("photos")
        .getPublicUrl(storagePath);

      // Save version record
      const { error: dbError } = await supabase
        .from("photo_versions")
        .insert({
          photo_id: photoId,
          user_id: user.id,
          version_number: nextVersionNumber,
          storage_path: storagePath,
          url: publicUrl,
          edit_metadata: {
            filter: selectedFilter,
            adjustments
          }
        } as any);

      if (dbError) throw dbError;

      toast.success("Version saved successfully!");
    } catch (error: any) {
      console.error("Save version error:", error);
      toast.error("Failed to save version");
    } finally {
      setIsSaving(false);
    }
  };

  const restoreVersion = (version: any) => {
    if (version.edit_metadata) {
      const metadata = version.edit_metadata;
      if (metadata.filter) {
        setSelectedFilter(metadata.filter);
      }
      if (metadata.adjustments) {
        setAdjustments(metadata.adjustments);
      }
      toast.success("Version restored!");
    }
  };

  return (
    <div className="relative bg-background h-screen flex flex-col">
      {/* Hidden image for loading */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt={alt}
        className="hidden"
        crossOrigin="anonymous"
        onLoad={applyFiltersToCanvas}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <h2 className="text-xl font-bold text-foreground">Image Editor</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowVersionHistory(!showVersionHistory)}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={saveVersion}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Version"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={removeBackground}
            disabled={isRemovingBackground}
          >
            <Eraser className="h-4 w-4 mr-2" />
            {isRemovingBackground ? "Removing..." : "Remove BG"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button variant="default" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Version History Sidebar */}
        {showVersionHistory && (
          <div className="w-80 border-r border-border bg-card overflow-y-auto p-4">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Version History</h3>
            <VersionHistory photoId={photoId} onRestore={restoreVersion} />
          </div>
        )}

        {/* Edit Controls Sidebar */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto">
          <Tabs defaultValue="filters" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-secondary">
              <TabsTrigger value="filters">Filters</TabsTrigger>
              <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
            </TabsList>

            <TabsContent value="filters" className="p-4 space-y-3">
              {Object.keys(filterPresets).map((filter) => (
                <Card
                  key={filter}
                  className={cn(
                    "p-3 cursor-pointer transition-all hover:shadow-lg",
                    selectedFilter === filter
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => setSelectedFilter(filter as keyof typeof filterPresets)}
                >
                  <p className="text-sm font-medium capitalize text-foreground">
                    {filter === "blackAndWhite" ? "Black & White" : filter}
                  </p>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="adjustments" className="p-4 space-y-6">
              {/* Basic Adjustments */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Exposure
                  </label>
                  <Slider
                    value={[adjustments.exposure]}
                    onValueChange={(v) => updateAdjustment("exposure", v)}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.exposure}</span>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Contrast
                  </label>
                  <Slider
                    value={[adjustments.contrast]}
                    onValueChange={(v) => updateAdjustment("contrast", v)}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.contrast}</span>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Saturation
                  </label>
                  <Slider
                    value={[adjustments.saturation]}
                    onValueChange={(v) => updateAdjustment("saturation", v)}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.saturation}</span>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Highlights
                  </label>
                  <Slider
                    value={[adjustments.highlights]}
                    onValueChange={(v) => updateAdjustment("highlights", v)}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.highlights}</span>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Shadows
                  </label>
                  <Slider
                    value={[adjustments.shadows]}
                    onValueChange={(v) => updateAdjustment("shadows", v)}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.shadows}</span>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Temperature
                  </label>
                  <Slider
                    value={[adjustments.temperature]}
                    onValueChange={(v) => updateAdjustment("temperature", v)}
                    min={-50}
                    max={50}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.temperature}</span>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Tint
                  </label>
                  <Slider
                    value={[adjustments.tint]}
                    onValueChange={(v) => updateAdjustment("tint", v)}
                    min={-50}
                    max={50}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.tint}</span>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Vibrance
                  </label>
                  <Slider
                    value={[adjustments.vibrance]}
                    onValueChange={(v) => updateAdjustment("vibrance", v)}
                    min={-100}
                    max={100}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{adjustments.vibrance}</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex items-center justify-center p-8 bg-secondary/20">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};
