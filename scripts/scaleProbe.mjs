// T061 / SC-009 lightweight scale probe.
//
// Creates ~25 real authenticated users against the LIVE dev deployment, has
// them join one server, seeds ~300 messages, then measures read latency for
// the hot queries (SC-002 messages, SC-003 members/presence, SC-005 call
// lookup) — including under a concurrent write burst. Not a full dozens-of-
// live-browser-tabs load test, but a real end-to-end signal that reads stay
// fast at the target data scale.
//
// Usage: node scripts/scaleProbe.mjs
// Requires the dev deployment to be up (VITE_CONVEX_URL in .env.local).

import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

function readEnvUrl() {
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const match = env.match(/^VITE_CONVEX_URL=(.+)$/m);
  if (!match) throw new Error("VITE_CONVEX_URL not found in .env.local");
  return match[1].trim();
}

const URL_ = readEnvUrl();
const PASSWORD = "Password123!";
const MEMBER_COUNT = 24; // + 1 owner = 25 authenticated sessions
const TOTAL_MESSAGES = 300; // SC-008 history depth
const RUNS = 25; // latency samples per query
const STAMP = Date.now(); // unique email suffix per run

async function signUp(email, displayName) {
  const client = new ConvexHttpClient(URL_);
  const result = await client.action(api.auth.signIn, {
    provider: "password",
    params: { email, password: PASSWORD, flow: "signUp", displayName },
  });
  const token = result?.tokens?.token;
  if (!token) throw new Error(`signUp for ${email} returned no token`);
  client.setAuth(token);
  return client;
}

function stats(samplesMs) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { avg: avg.toFixed(1), p95: p95.toFixed(1), max: sorted[sorted.length - 1].toFixed(1) };
}

async function timeIt(runs, fn) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    await fn(i);
    samples.push(performance.now() - t);
  }
  return stats(samples);
}

async function main() {
  console.log(`Probing ${URL_}`);
  console.log(`Creating owner + ${MEMBER_COUNT} members…`);

  const owner = await signUp(`probe-owner-${STAMP}@test.com`, "Probe Owner");
  const serverId = await owner.mutation(api.servers.create, {
    name: `Scale Probe ${STAMP}`,
  });
  const { inviteCode } = await owner.mutation(api.servers.generateInvite, {
    serverId,
  });

  const members = [owner];
  for (let i = 0; i < MEMBER_COUNT; i++) {
    const client = await signUp(`probe-${STAMP}-${i}@test.com`, `Member ${i}`);
    await client.mutation(api.servers.joinByInvite, { inviteCode });
    members.push(client);
    if ((i + 1) % 8 === 0) console.log(`  …${i + 1}/${MEMBER_COUNT} joined`);
  }

  const channels = await owner.query(api.channels.list, { serverId });
  const generalId = channels.find((c) => c.type === "text")._id;

  console.log(`Seeding ${TOTAL_MESSAGES} messages…`);
  for (let i = 0; i < TOTAL_MESSAGES; i++) {
    const author = members[i % members.length];
    await author.mutation(api.messages.send, {
      channelId: generalId,
      content: `Scale probe message ${i}`,
    });
  }

  // Presence for the whole cohort (feeds SC-003 member+presence read).
  await Promise.all(members.map((c) => c.mutation(api.presence.heartbeat, {})));

  console.log(`\nData scale: ${members.length} members, ${TOTAL_MESSAGES} messages.\n`);
  console.log("Read latency (ms), quiescent:");

  const listPage = await timeIt(RUNS, () =>
    owner.query(api.messages.listPage, {
      channelId: generalId,
      paginationOpts: { numItems: 30, cursor: null },
    }),
  );
  console.log(`  messages.listPage (SC-002/008):`, listPage);

  const memberList = await timeIt(RUNS, () =>
    owner.query(api.serverMembers.list, { serverId }),
  );
  console.log(`  serverMembers.list  (SC-003):`, memberList);

  const presence = await timeIt(RUNS, () =>
    owner.query(api.presence.listForServer, { serverId }),
  );
  console.log(`  presence.listForServer (SC-003):`, presence);

  const channelList = await timeIt(RUNS, () =>
    owner.query(api.channels.list, { serverId }),
  );
  console.log(`  channels.list       (SC-005 connected):`, channelList);

  // Concurrent write burst: 20 members send simultaneously while we measure
  // read latency — a light concurrency stress rather than idle reads.
  console.log("\nRead latency (ms) under a 20-way concurrent write burst:");
  const burst = timeIt(RUNS, () =>
    owner.query(api.messages.listPage, {
      channelId: generalId,
      paginationOpts: { numItems: 30, cursor: null },
    }),
  );
  const writers = [];
  for (let i = 0; i < 20; i++) {
    const author = members[i % members.length];
    writers.push(
      author.mutation(api.messages.send, {
        channelId: generalId,
        content: `burst ${i}`,
      }),
    );
  }
  const [burstStats] = await Promise.all([burst, Promise.all(writers)]);
  console.log(`  messages.listPage under load:`, burstStats);

  console.log("\nDone. (Probe users are suffixed with the run timestamp.)");
}

main().catch((err) => {
  console.error("Probe failed:", err);
  process.exit(1);
});
