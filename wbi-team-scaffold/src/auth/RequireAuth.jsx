// TODO (Cornelio): Replace this with the real route guard that redirects
// to /login when the user isn't authenticated (see useAuth().isAuthenticated).
export default function RequireAuth({ children }) {
  return children;
}
