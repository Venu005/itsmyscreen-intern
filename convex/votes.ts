import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { DatabaseReader } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper to check if a user has already voted
async function hasUserVoted(
  db: DatabaseReader,
  pollId: Id<"polls">,
  fingerprint: string,
  ipHash: string,
) {
  // Check fingerprint
  const voteByFingerprint = await db
    .query("votes")
    .withIndex("by_poll_and_fingerprint", (q) =>
      q.eq("pollId", pollId).eq("voterFingerprint", fingerprint),
    )
    .first();

  if (voteByFingerprint) return true;

  return false;
}

export const cast = mutation({
  args: {
    pollId: v.id("polls"),
    optionIndex: v.number(),
    voterFingerprint: v.string(),
    ipAddress: v.string(), // We will hash this
    userAgent: v.string(),
    token: v.optional(v.string()), // Turnstile token
  },
  handler: async (ctx, args) => {
    // 1. Verify Turnstile Token if provided
    if (args.token) {
      const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
      if (secretKey) {
        const ip = args.ipAddress;
        const formData = new FormData();
        formData.append("secret", secretKey);
        formData.append("response", args.token);
        formData.append("remoteip", ip);

        const result = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: formData,
          },
        );

        const outcome = await result.json();
        if (!outcome.success) {
          throw new ConvexError("Bot verification failed. Please try again.");
        }
      } else {
        console.warn(
          "CLOUDFLARE_TURNSTILE_SECRET_KEY not set, skipping verification.",
        );
      }
    }

    const poll = await ctx.db.get(args.pollId);
    if (!poll) {
      throw new ConvexError("Poll not found");
    }

    if (poll.settings.closeAt && Date.now() > poll.settings.closeAt) {
      throw new ConvexError("Poll is closed");
    }

    const ipHashHeader = args.ipAddress;
    const ipHash = ipHashHeader;

    if (!poll.settings.allowMultipleVotes) {
      const alreadyVoted = await hasUserVoted(
        ctx.db,
        args.pollId,
        args.voterFingerprint,
        ipHash,
      );
      if (alreadyVoted) {
        throw new ConvexError("You have already voted on this device.");
      }
    }

    // Check Rate Limits (IP based)
    const oneHourAgo = Date.now() - 3600000;
    const recentVotesFromIP = await ctx.db
      .query("votes")
      .withIndex("by_poll_and_ip", (q) =>
        q.eq("pollId", args.pollId).eq("ipHash", ipHash),
      )
      .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))
      .collect();

    const maxVotes = poll.settings.maxVotesPerIP || 3;

    if (recentVotesFromIP.length >= maxVotes) {
      throw new ConvexError(
        `Rate limit exceeded. You can only vote ${maxVotes} times per hour per network.`,
      );
    }

    await ctx.db.insert("votes", {
      pollId: args.pollId,
      optionIndex: args.optionIndex,
      voterFingerprint: args.voterFingerprint,
      ipHash: ipHash,
      userAgent: args.userAgent,
      timestamp: Date.now(),
    });

    return true;
  },
});

export const hasVoted = query({
  args: { pollId: v.id("polls"), fingerprint: v.string() },
  handler: async (ctx, args) => {
    const vote = await ctx.db
      .query("votes")
      .withIndex("by_poll_and_fingerprint", (q) =>
        q.eq("pollId", args.pollId).eq("voterFingerprint", args.fingerprint),
      )
      .first();
    return !!vote;
  },
});
