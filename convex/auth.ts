import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import type { DataModel } from "./_generated/dataModel";

function defaultAvatarUrl(seed: string): string {
  // Deterministic placeholder avatar — no upload pipeline needed for v1
  // (FR-002 only requires a default avatar to exist at signup).
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        const email = params.email as string;
        const displayName = (params.displayName as string | undefined) ?? email.split("@")[0];
        return {
          email,
          displayName,
          avatarUrl: (params.avatarUrl as string | undefined) ?? defaultAvatarUrl(email),
        };
      },
    }),
  ],
});
