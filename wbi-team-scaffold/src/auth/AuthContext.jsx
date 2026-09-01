import { createContext, useContext } from "react";

// TODO (Cornelio): Replace this file with the real mock-auth implementation.
// It needs to export AuthProvider and useAuth() with: user, isAuthenticated,
// login(email, password), logout(). See the handoff notes for the exact
// demo credentials to check against and the localStorage persistence.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const value = { user: null, isAuthenticated: true, login: () => ({ ok: true }), logout: () => {} };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export const DEMO_CREDENTIALS = { email: "TODO@example.com", password: "TODO" };
