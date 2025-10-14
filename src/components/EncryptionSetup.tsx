import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { useEncryption } from "@/hooks/useEncryption";
import { toast } from "sonner";

export const EncryptionSetup = () => {
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const { setupEncryption } = useEncryption();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passphrase.length < 8) {
      toast.error("Passphrase must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await setupEncryption(passphrase);
    } catch (error) {
      console.error("Setup error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[var(--gradient-mesh)] opacity-50" />
      
      <Card className="w-full max-w-md relative z-10 border-border/50 shadow-[var(--shadow-elegant)]">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <Shield className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-[var(--gradient-primary)] bg-clip-text text-transparent">
            Encryption Setup
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Create a passphrase to encrypt your photos. Keep it safe - you'll need it every time you log in.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passphrase">Encryption Passphrase</Label>
              <Input
                id="passphrase"
                type="password"
                placeholder="Enter a strong passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
                minLength={8}
                className="bg-secondary/50 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters. This passphrase will be used to encrypt all your photos.
              </p>
            </div>
            
            <div className="bg-secondary/30 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security Note
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Your photos are encrypted before leaving your device</li>
                <li>Only you can decrypt them with your passphrase</li>
                <li>If you lose your passphrase, your photos cannot be recovered</li>
                <li>No one, including admins, can access your encrypted photos</li>
              </ul>
            </div>
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--gradient-primary)] hover:opacity-90 transition-opacity shadow-[var(--shadow-glow)]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                "Enable Encryption"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
