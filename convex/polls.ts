import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    question: v.string(),
    options: v.array(v.string()),
    settings: v.object({
      allowMultipleVotes: v.boolean(),
      maxVotesPerIP: v.number(),
      requireCaptcha: v.boolean(),
      closeAt: v.optional(v.number()),
    }),
    creatorFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pollId = await ctx.db.insert("polls", {
      question: args.question,
      options: args.options,
      settings: args.settings,
      creatorFingerprint: args.creatorFingerprint,
    });
    return pollId;
  },
});

export const get = query({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.pollId);
  },
});

export const getResults = query({
  args: { pollId: v.id("polls") },
  handler: async (ctx, args) => {
    const poll = await ctx.db.get(args.pollId);
    if (!poll) return null;

    const votes = await ctx.db
      .query("votes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
      .collect();

    const results = poll.options.map((option: string, index: number) => {
      const optionVotes = votes.filter((v) => v.optionIndex === index).length;
      return {
        text: option,
        votes: optionVotes,
        percentage: votes.length > 0 ? (optionVotes / votes.length) * 100 : 0,
      };
    });

    return {
      question: poll.question,
      options: results,
      totalVotes: votes.length,
    };
  },
});
