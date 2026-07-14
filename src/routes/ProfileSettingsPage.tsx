import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ProfileSettingsPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setAvatarUrl(currentUser.avatarUrl);
    }
  }, [currentUser]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await updateProfile({ displayName, avatarUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (currentUser === undefined) {
    return <div className="p-6 text-offline">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-lg font-semibold text-white">Profile settings</h1>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label className="mb-3 block text-sm text-gray-300">
          Display name
          <input
            className="mt-1 w-full rounded bg-surface-panel p-2 text-white"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label className="mb-3 block text-sm text-gray-300">
          Avatar URL
          <input
            className="mt-1 w-full rounded bg-surface-panel p-2 text-white"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Save
        </button>
        {saved && <span className="ml-3 text-sm text-online">Saved!</span>}
      </form>
    </div>
  );
}
