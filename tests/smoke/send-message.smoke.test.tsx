import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

// convex-test needs the actual convex/**/*.ts source files to resolve
// function references against, not just the generated api.
const modules = import.meta.glob("../../convex/**/*.*s");

// Constitution (Testable Seams): exercises the real `messages.send`
// mutation end-to-end via convex-test's in-memory backend — not a mock.
describe("send-message smoke test", () => {
  it("lets an authenticated member send a message that appears in the channel", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        displayName: "Alice",
        avatarUrl: "https://example.com/alice.png",
      }),
    );

    // @convex-dev/auth's `auth.getUserId` derives the user ID from the
    // identity `subject`, formatted as `${userId}|${sessionId}` (verified
    // against the installed package's implementation.js — see research.md).
    const asAlice = t.withIdentity({ subject: `${userId}|test-session` });

    const serverId = await asAlice.mutation(api.servers.create, {
      name: "Study Group",
    });

    const channels = await asAlice.query(api.channels.list, { serverId });
    const generalChannel = channels.find((channel) => channel.type === "text");
    if (!generalChannel) {
      throw new Error("expected servers.create to auto-create a #general channel");
    }

    await asAlice.mutation(api.messages.send, {
      channelId: generalChannel._id,
      content: "hello everyone",
    });

    const page = await asAlice.query(api.messages.listPage, {
      channelId: generalChannel._id,
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(page.page).toHaveLength(1);
    expect(page.page[0].content).toBe("hello everyone");
    expect(page.page[0].authorDisplayName).toBe("Alice");
  });

  it("rejects an empty message (FR-016a)", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        displayName: "Bob",
        avatarUrl: "https://example.com/bob.png",
      }),
    );
    const asBob = t.withIdentity({ subject: `${userId}|test-session` });
    const serverId = await asBob.mutation(api.servers.create, { name: "Bob's Server" });
    const channels = await asBob.query(api.channels.list, { serverId });
    const generalChannel = channels.find((channel) => channel.type === "text");
    if (!generalChannel) throw new Error("expected a #general channel");

    await expect(
      asBob.mutation(api.messages.send, { channelId: generalChannel._id, content: "   " }),
    ).rejects.toThrow();
  });
});
