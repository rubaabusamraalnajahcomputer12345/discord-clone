/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

// Exercises the owner-only authorization paths (`requireServerOwner`) shared
// by servers.ts/channels.ts through the real mutations that depend on them —
// convex-test's in-memory backend, not mocks (constitution: Testable Seams).
const modules = import.meta.glob("../../convex/**/*.*s");

async function seedUser(
  t: ReturnType<typeof convexTest>,
  displayName: string,
) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      displayName,
      avatarUrl: `https://example.com/${displayName}.png`,
    }),
  );
  return {
    userId,
    as: t.withIdentity({ subject: `${userId}|test-session` }),
  };
}

describe("owner-only authorization", () => {
  it("lets the owner rename their server but rejects a non-owner", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const member = await seedUser(t, "Member");

    const serverId = await owner.as.mutation(api.servers.create, {
      name: "Original",
    });
    const { inviteCode } = await owner.as.mutation(api.servers.generateInvite, {
      serverId,
    });
    await member.as.mutation(api.servers.joinByInvite, { inviteCode });

    await expect(
      member.as.mutation(api.servers.rename, { serverId, name: "Hijacked" }),
    ).rejects.toThrow();

    await owner.as.mutation(api.servers.rename, { serverId, name: "Renamed" });
    const server = await owner.as.query(api.servers.get, { serverId });
    expect(server.name).toBe("Renamed");
  });

  it("lets only the owner create a channel", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const member = await seedUser(t, "Member");

    const serverId = await owner.as.mutation(api.servers.create, {
      name: "Server",
    });
    const { inviteCode } = await owner.as.mutation(api.servers.generateInvite, {
      serverId,
    });
    await member.as.mutation(api.servers.joinByInvite, { inviteCode });

    await expect(
      member.as.mutation(api.channels.create, {
        serverId,
        name: "secret",
        type: "text",
      }),
    ).rejects.toThrow();

    await owner.as.mutation(api.channels.create, {
      serverId,
      name: "voice-room",
      type: "voice",
    });
    const channels = await owner.as.query(api.channels.list, { serverId });
    expect(channels.some((c) => c.name === "voice-room" && c.type === "voice")).toBe(
      true,
    );
  });

  it("lets the owner remove a member but blocks removing self and non-owner callers", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const member = await seedUser(t, "Member");

    const serverId = await owner.as.mutation(api.servers.create, {
      name: "Server",
    });
    const { inviteCode } = await owner.as.mutation(api.servers.generateInvite, {
      serverId,
    });
    await member.as.mutation(api.servers.joinByInvite, { inviteCode });

    // Non-owner cannot remove anyone.
    await expect(
      member.as.mutation(api.servers.removeMember, {
        serverId,
        userId: owner.userId,
      }),
    ).rejects.toThrow();

    // Owner cannot remove themselves via removeMember.
    await expect(
      owner.as.mutation(api.servers.removeMember, {
        serverId,
        userId: owner.userId,
      }),
    ).rejects.toThrow();

    // Owner removes the member successfully.
    await owner.as.mutation(api.servers.removeMember, {
      serverId,
      userId: member.userId,
    });
    const members = await owner.as.query(api.serverMembers.list, { serverId });
    expect(members.map((m) => m.userId)).not.toContain(member.userId);
  });

  it("cascades a full server delete when the owner leaves (FR-010a)", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const member = await seedUser(t, "Member");

    const serverId = await owner.as.mutation(api.servers.create, {
      name: "Server",
    });
    const { inviteCode } = await owner.as.mutation(api.servers.generateInvite, {
      serverId,
    });
    await member.as.mutation(api.servers.joinByInvite, { inviteCode });

    const channels = await owner.as.query(api.channels.list, { serverId });
    const generalId = channels.find((c) => c.type === "text")!._id;
    await member.as.mutation(api.messages.send, {
      channelId: generalId,
      content: "hi",
    });

    await owner.as.mutation(api.servers.leave, { serverId });

    const remaining = await t.run(async (ctx) => ({
      server: await ctx.db.get(serverId),
      channels: await ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
      messages: await ctx.db
        .query("messages")
        .withIndex("by_channel", (q) =>
          q.eq("channelId", generalId as Id<"channels">),
        )
        .collect(),
      members: await ctx.db
        .query("serverMembers")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    }));

    expect(remaining.server).toBeNull();
    expect(remaining.channels).toHaveLength(0);
    expect(remaining.messages).toHaveLength(0);
    expect(remaining.members).toHaveLength(0);
  });

  it("removes only the caller's membership when a non-owner leaves", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const member = await seedUser(t, "Member");

    const serverId = await owner.as.mutation(api.servers.create, {
      name: "Server",
    });
    const { inviteCode } = await owner.as.mutation(api.servers.generateInvite, {
      serverId,
    });
    await member.as.mutation(api.servers.joinByInvite, { inviteCode });

    await member.as.mutation(api.servers.leave, { serverId });

    const server = await owner.as.query(api.servers.get, { serverId });
    expect(server).not.toBeNull();
    const members = await owner.as.query(api.serverMembers.list, { serverId });
    expect(members.map((m) => m.userId)).toEqual([owner.userId]);
  });
});
