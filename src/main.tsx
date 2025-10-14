import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { EncryptionProvider } from "./hooks/useEncryption";

createRoot(document.getElementById("root")!).render(
  <EncryptionProvider>
    <App />
  </EncryptionProvider>
);
