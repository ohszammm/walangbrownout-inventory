import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext";
import { ItemsProvider } from "./state/ItemsContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ItemsProvider>
          <App />
        </ItemsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
