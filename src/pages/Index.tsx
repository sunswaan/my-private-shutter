import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { PhotoUpload } from "@/components/PhotoUpload";
import { PhotoGallery } from "@/components/PhotoGallery";
import { EncryptionSetup } from "@/components/EncryptionSetup";
import { Camera, LogOut, Upload } from "lucide-react";
import { toast } from "sonner";
import { useEncryption } from "@/hooks/useEncryption";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const navigate = useNavigate();
  const { isEncryptionReady } = useEncryption();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Only redirect if we're done loading and there's definitely no session
    if (!loading && !session && !user) {
      navigate("/auth");
    }
  }, [loading, user, session, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Camera className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show encryption setup if not ready
  if (!isEncryptionReady) {
    return <EncryptionSetup />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-[var(--gradient-mesh)] opacity-30 pointer-events-none" />
      
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              PhotoVault
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setUploadOpen(true)}
              className="bg-[var(--gradient-primary)] hover:opacity-90 transition-opacity shadow-[var(--shadow-glow)]"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-border hover:bg-secondary/80"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 relative z-10">
        <PhotoGallery refreshTrigger={refreshTrigger} />
      </main>

      <PhotoUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
};

export default Index;
