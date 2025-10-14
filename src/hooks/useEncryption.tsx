import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveKey } from "@/lib/encryption";
import { toast } from "sonner";

interface EncryptionContextType {
  encryptionKey: CryptoKey | null;
  isEncryptionReady: boolean;
  setupEncryption: (passphrase: string) => Promise<void>;
  clearEncryption: () => void;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export const EncryptionProvider = ({ children }: { children: ReactNode }) => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);

  const setupEncryption = async (passphrase: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        throw new Error("User not authenticated");
      }

      const key = await deriveKey(user.email, passphrase);
      setEncryptionKey(key);
      setIsEncryptionReady(true);
      
      // Store a flag (not the key!) to remember encryption is set up
      localStorage.setItem("encryption_enabled", "true");
      toast.success("Encryption enabled");
    } catch (error) {
      toast.error("Failed to set up encryption");
      throw error;
    }
  };

  const clearEncryption = () => {
    setEncryptionKey(null);
    setIsEncryptionReady(false);
    localStorage.removeItem("encryption_enabled");
  };

  // Check if encryption should be enabled on mount
  useEffect(() => {
    const encryptionEnabled = localStorage.getItem("encryption_enabled");
    if (encryptionEnabled === "true") {
      // User has encryption set up but needs to provide passphrase
      setIsEncryptionReady(false);
    }
  }, []);

  return (
    <EncryptionContext.Provider
      value={{
        encryptionKey,
        isEncryptionReady,
        setupEncryption,
        clearEncryption,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
};

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within EncryptionProvider");
  }
  return context;
};
