import { createContext, useContext, useState } from "react";

// DEMO CREDENTIALS ONLY. This is a frontend-only mock: there is no server
// verifying anything, the "password" is sitting in plain text in this file,
// and anyone can bypass it by editing localStorage. It exists so the login
// flow can be demoed and reviewed before the real Laravel backend (which
// does check credentials properly) is wired in. Do not treat this as real
// authentication or ship it as-is.
const DEMO_EMAIL = "admin@walangbrownout.test";
const DEMO_PASSWORD = "password";
const STORAGE_KEY = "wbi_mock_auth";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const login = (email, password) => {
    if (email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const loggedInUser = { name: "Admin User", email: DEMO_EMAIL };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return { ok: true };
    }
    return { ok: false, error: "These credentials do not match our records." };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export const DEMO_CREDENTIALS = { email: DEMO_EMAIL, password: DEMO_PASSWORD };