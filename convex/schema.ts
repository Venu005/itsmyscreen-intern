import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  polls: defineTable({
    question: v.string(),
    options: v.array(v.string()),
    creatorFingerprint: v.optional(v.string()),
    settings: v.object({
      allowMultipleVotes: v.boolean(),
      maxVotesPerIP: v.number(),
      requireCaptcha: v.boolean(),
      closeAt: v.optional(v.number()),
    }),
  }), // Removed explict index on _creationTime as it's built-in

  votes: defineTable({
    pollId: v.id("polls"),
    optionIndex: v.number(),
    voterFingerprint: v.string(),
    ipHash: v.string(),
    userAgent: v.string(),
    timestamp: v.number(),
  })
    .index("by_poll", ["pollId"])
    .index("by_poll_and_fingerprint", ["pollId", "voterFingerprint"])
    .index("by_poll_and_ip", ["pollId", "ipHash"])
    .index("by_fingerprint", ["voterFingerprint"])
    .index("by_timestamp", ["timestamp"]),
});
