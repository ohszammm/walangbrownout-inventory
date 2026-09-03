import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, DEMO_CREDENTIALS } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/";

  const submit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    setTimeout(() => {
      const result = login(email, password);
      setSubmitting(false);
      if (result.ok) {
        navigate(from, { replace: true });
      } else {
        setError(result.error);
      }
    }, 250);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand-block">
          <span className="login-brand-name">WalangBrownout</span>
          <span className="login-brand-sub">Inventory System</span>
        </div>

        <form onSubmit={submit} className="login-form">
          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label">Email</label>
            <input
              type="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label className="field-label">Password</label>
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="field-error" style={{ marginBottom: 14 }}>{error}</p>}
          <div style={{ textAlign: "center" }}>
            <button type="submit" disabled={submitting} className="btn btn-primary login-submit">
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <div className="login-demo">
          <p className="login-demo-label">Demo account</p>
          <p className="login-demo-line">{DEMO_CREDENTIALS.email}</p>
          <p className="login-demo-line">{DEMO_CREDENTIALS.password}</p>
        </div>

        <p className="login-hint">
          Frontend-only demo login. No server is verifying this. Real authentication lives in the Laravel backend.
        </p>
      </div>
    </div>
  );
}