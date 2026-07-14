import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useNavigate } from "react-router-dom";

type Mode = "signUp" | "signIn";

export function LoginPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn("password", { email, password, displayName, flow: mode });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm rounded-md bg-surface-panel p-8 shadow-lg"
      >
        <h1 className="mb-6 text-xl font-semibold text-white">
          {mode === "signUp" ? "Create an account" : "Welcome back"}
        </h1>

        {mode === "signUp" && (
          <label className="mb-3 block text-sm text-gray-300">
            Display name
            <input
              className="mt-1 w-full rounded bg-surface p-2 text-white outline-none focus:ring-2 focus:ring-accent"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
        )}

        <label className="mb-3 block text-sm text-gray-300">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded bg-surface p-2 text-white outline-none focus:ring-2 focus:ring-accent"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="mb-4 block text-sm text-gray-300">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded bg-surface p-2 text-white outline-none focus:ring-2 focus:ring-accent"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </label>

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-accent p-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {mode === "signUp" ? "Sign up" : "Log in"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signUp" ? "signIn" : "signUp")}
          className="mt-3 w-full text-center text-sm text-gray-400 hover:text-white"
        >
          {mode === "signUp"
            ? "Already have an account? Log in"
            : "Need an account? Sign up"}
        </button>
      </form>
    </div>
  );
}
