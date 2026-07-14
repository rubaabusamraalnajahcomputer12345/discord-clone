/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";

// Constitution (Testable Seams): exercises the real `callParticipants.join`
// mutation and the resulting participant list end-to-end via convex-test —
// not a mock. Also validates the FR-027 4-participant cap.
const modules = import.meta.glob("../../convex/**/*.*s");

async function seedUser(t: ReturnType<typeof convexTest>, name: string) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      displayName: name,
      avatarUrl: `https://example.com/${name}.png`,
    }),
  );
  return { userId, as: t.withIdentity({ subject: `${userId}|test-session` }) };
}

// Owner creates a server + a voice channel; the given users all join the
// server. Returns the voice channel id.
async function seedServerWithVoiceChannel(
  t: ReturnType<typeof convexTest>,
  owner: { as: ReturnType<ReturnType<typeof convexTest>["withIdentity"]> },
  members: { as: ReturnType<ReturnType<typeof convexTest>["withIdentity"]> }[],
): Promise<Id<"channels">> {
  const serverId = await owner.as.mutation(api.servers.create, { name: "Server" });
  const { inviteCode } = await owner.as.mutation(api.servers.generateInvite, {
    serverId,
  });
  for (const member of members) {
    await member.as.mutation(api.servers.joinByInvite, { inviteCode });
  }
  const voiceChannelId = await owner.as.mutation(api.channels.create, {
    serverId,
    name: "Voice",
    type: "voice",
  });
  return voiceChannelId;
}

describe("join-call smoke test", () => {
  it("lets a member join a voice channel's call and appear in the participant list", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const channelId = await seedServerWithVoiceChannel(t, owner, []);
    const scope = { kind: "channel" as const, channelId };

    const callId = await owner.as.mutation(api.callParticipants.join, { scope });

    const active = await owner.as.query(api.calls.getActiveForScope, { scope });
    expect(active?._id).toBe(callId);

    const participants = await owner.as.query(api.callParticipants.list, { callId });
    expect(participants).toHaveLength(1);
    expect(participants[0].displayName).toBe("Owner");
    expect(participants[0].micOn).toBe(true);
  });

  it("reuses the same call for concurrent joiners and enforces the 4-participant cap (FR-027)", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const m1 = await seedUser(t, "M1");
    const m2 = await seedUser(t, "M2");
    const m3 = await seedUser(t, "M3");
    const m4 = await seedUser(t, "M4");
    const channelId = await seedServerWithVoiceChannel(t, owner, [m1, m2, m3, m4]);
    const scope = { kind: "channel" as const, channelId };

    const callId = await owner.as.mutation(api.callParticipants.join, { scope });
    const callId1 = await m1.as.mutation(api.callParticipants.join, { scope });
    const callId2 = await m2.as.mutation(api.callParticipants.join, { scope });
    const callId3 = await m3.as.mutation(api.callParticipants.join, { scope });

    // All four share the one active call.
    expect(new Set([callId, callId1, callId2, callId3]).size).toBe(1);
    const full = await owner.as.query(api.callParticipants.list, { callId });
    expect(full).toHaveLength(4);

    // 5th distinct participant is rejected.
    await expect(
      m4.as.mutation(api.callParticipants.join, { scope }),
    ).rejects.toThrow();

    // An existing participant rejoining is fine (idempotent) and does not
    // exceed the cap.
    const rejoin = await owner.as.mutation(api.callParticipants.join, { scope });
    expect(rejoin).toBe(callId);
    expect(await owner.as.query(api.callParticipants.list, { callId })).toHaveLength(4);
  });

  it("closes the call and clears signals when the last participant leaves (FR-031)", async () => {
    const t = convexTest(schema, modules);
    const owner = await seedUser(t, "Owner");
    const channelId = await seedServerWithVoiceChannel(t, owner, []);
    const scope = { kind: "channel" as const, channelId };

    const callId = await owner.as.mutation(api.callParticipants.join, { scope });
    await owner.as.mutation(api.callParticipants.leave, { callId });

    // Call is ended, so there's no active call for the scope anymore.
    const active = await owner.as.query(api.calls.getActiveForScope, { scope });
    expect(active).toBeNull();

    const endedAt = await t.run(async (ctx) => (await ctx.db.get(callId))?.endedAt);
    expect(endedAt).toBeDefined();
  });
});
