# Real-Time Polling App - Product Requirements Document (PRD)

## 1. Executive Summary

A Next.js + Convex web application enabling users to create polls, share them via unique links, and view real-time voting results. The system leverages Convex's built-in real-time subscriptions for automatic updates and implements multiple anti-abuse mechanisms to ensure vote integrity.

---

## 2. Technical Stack

- **Frontend**: Next.js 14+ (App Router)
- **Backend/Database**: Convex (real-time database with automatic subscriptions)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (Next.js) + Convex Cloud

---

## 3. Core Features

### 3.1 Poll Creation

**User Flow:**

1. User lands on homepage
2. Enters poll question (required, 10-200 characters)
3. Adds 2-10 options (each 1-100 characters)
4. Clicks "Create Poll"
5. System generates unique poll ID and shareable URL
6. User is redirected to poll results page with share options

**Data Model:**

```typescript
polls: {
  _id: Id<"polls">,
  _creationTime: number,
  question: string,
  options: string[],
  creatorFingerprint?: string, // For creator tracking
  settings: {
    allowMultipleVotes: boolean,
    requireFingerprint: boolean,
    maxVotesPerIP: number,
    closeAt?: number, // Unix timestamp
  }
}
```

### 3.2 Voting Mechanism

**User Flow:**

1. User opens poll via shareable link (`/poll/[pollId]`)
2. Views question and options with current vote counts
3. Selects one option (radio button)
4. Clicks "Submit Vote"
5. System validates vote (anti-abuse checks)
6. Vote is recorded and results update in real-time for all viewers

**Data Model:**

```typescript
votes: {
  _id: Id<"votes">,
  _creationTime: number,
  pollId: Id<"polls">,
  optionIndex: number,
  voterFingerprint: string,
  ipHash: string,
  userAgent: string,
  timestamp: number,
}
```

### 3.3 Real-Time Results Display

**Features:**

- **Live vote counts**: Updates automatically via Convex subscriptions
- **Percentage bars**: Visual representation of vote distribution
- **Total votes**: Running count of all votes cast
- **Ranking**: Options sorted by vote count (optional toggle)

**UI Components:**

- Question header
- Option cards with:
  - Option text
  - Vote count
  - Percentage bar (animated)
  - Percentage label
- Total votes footer
- Share button (copies link to clipboard)

---

## 4. Anti-Abuse Mechanisms (Fairness Controls)

### 4.1 Browser Fingerprinting (Primary Control)

**Implementation:**

- Generate unique fingerprint using:
  - Canvas fingerprinting
  - WebGL fingerprinting
  - Audio context fingerprinting
  - Screen resolution + timezone + language
  - User agent + plugins
- Use library: `@fingerprintjs/fingerprintjs` or custom implementation

**What it prevents:**

- Users voting multiple times from same device/browser
- Simple page refresh attempts to revote

**Limitations:**

- Can be bypassed by switching browsers
- Incognito/private mode creates new fingerprint
- Not foolproof against determined attackers

**Code Example:**

```typescript
// utils/fingerprint.ts
import FingerprintJS from "@fingerprintjs/fingerprintjs";

export async function getFingerprint(): Promise<string> {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId;
}
```

### 4.2 IP-Based Rate Limiting

**Implementation:**

- Hash user's IP address (via request headers)
- Store in Convex database with vote timestamp
- Enforce rules:
  - Max 1 vote per IP per poll (strict mode)
  - Max 3 votes per IP per poll per hour (lenient mode)
  - Track vote timestamps for rate calculation

**What it prevents:**

- Rapid-fire voting from same network
- Simple VPN switching (requires time delay)
- Bot attacks from single IP

**Limitations:**

- Shared IPs (offices, cafes) may block legitimate users
- VPN rotation can bypass (but adds friction)
- IPv6 may provide many IPs per user

**Code Example:**

```typescript
// convex/votes.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import crypto from "crypto";

export const castVote = mutation({
  args: {
    pollId: v.id("polls"),
    optionIndex: v.number(),
    voterFingerprint: v.string(),
    ipAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const ipHash = crypto
      .createHash("sha256")
      .update(args.ipAddress)
      .digest("hex");

    // Check existing votes from this IP
    const recentVotes = await ctx.db
      .query("votes")
      .withIndex("by_poll_and_ip", (q) =>
        q.eq("pollId", args.pollId).eq("ipHash", ipHash),
      )
      .collect();

    const oneHourAgo = Date.now() - 3600000;
    const recentVoteCount = recentVotes.filter(
      (v) => v.timestamp > oneHourAgo,
    ).length;

    if (recentVoteCount >= 3) {
      throw new Error("Rate limit exceeded");
    }

    // Record vote...
  },
});
```

### 4.3 Device Fingerprint + IP Combination (Enhanced Control)

**Implementation:**

- Require BOTH fingerprint AND IP to be unique
- Create composite key: `${fingerprint}-${ipHash}`
- Store in votes table
- Reject duplicate composite keys

**What it prevents:**

- Bypassing either control individually
- Most casual abuse attempts

**Limitations:**

- Still vulnerable to coordinated attacks with multiple devices + IPs
- May be overly restrictive for legitimate shared devices

### 4.4 Time-Based Cooldown

**Implementation:**

- After voting, store timestamp with fingerprint
- Enforce minimum delay (e.g., 60 seconds) before same fingerprint can vote again on ANY poll
- Show countdown timer to user

**What it prevents:**

- Rapid poll spamming across multiple polls
- Bot attacks that attempt speed-based manipulation

**Code Example:**

```typescript
// Check global cooldown
const lastVote = await ctx.db
  .query("votes")
  .withIndex("by_fingerprint", (q) =>
    q.eq("voterFingerprint", args.voterFingerprint),
  )
  .order("desc")
  .first();

if (lastVote && Date.now() - lastVote.timestamp < 60000) {
  const waitTime = Math.ceil(
    (60000 - (Date.now() - lastVote.timestamp)) / 1000,
  );
  throw new Error(`Please wait ${waitTime} seconds before voting again`);
}
```

### 4.5 CAPTCHA Verification (Optional - High-Value Polls)

**Implementation:**

- Integrate Google reCAPTCHA v3 or hCaptcha
- Trigger on suspicious patterns:
  - Rapid successive votes
  - Multiple votes from same fingerprint detected
  - High-traffic polls
- Score-based: Only show challenge if score < 0.5

**What it prevents:**

- Automated bot voting
- Script-based attacks

**Limitations:**

- Adds friction to user experience
- Costs associated with API usage
- Can be bypassed by sophisticated bots

### 4.6 User Agent Analysis

**Implementation:**

- Log user agent string with each vote
- Flag suspicious patterns:
  - Headless browsers (Puppeteer, Selenium)
  - Known bot signatures
  - Uncommon or outdated browsers
- Apply stricter rate limits to flagged agents

**What it prevents:**

- Basic automated voting scripts
- Headless browser attacks

### 4.7 Voting Pattern Analysis (Advanced)

**Implementation:**

- Analyze voting patterns in real-time:
  - Time between votes from same source
  - Sequential option selection patterns
  - Burst detection (many votes in short window)
- Use Convex scheduled functions to run periodic checks
- Flag anomalies for manual review or auto-suspend

**What it prevents:**

- Coordinated voting campaigns
- Bot networks with distributed IPs

**Code Example:**

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "detect voting anomalies",
  { minutes: 5 },
  internal.antiAbuse.detectAnomalies,
);

export default crons;
```

---

## 5. Database Schema (Convex)

### 5.1 Polls Table

```typescript
defineTable({
  question: v.string(),
  options: v.array(v.string()),
  creatorFingerprint: v.optional(v.string()),
  settings: v.object({
    allowMultipleVotes: v.boolean(),
    maxVotesPerIP: v.number(),
    requireCaptcha: v.boolean(),
    closeAt: v.optional(v.number()),
  }),
}).index("by_creation_time", ["_creationTime"]);
```

### 5.2 Votes Table

```typescript
defineTable({
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
  .index("by_timestamp", ["timestamp"]);
```

### 5.3 Abuse Logs Table (Optional)

```typescript
defineTable({
  pollId: v.id("polls"),
  fingerprint: v.string(),
  ipHash: v.string(),
  reason: v.string(), // "rate_limit", "duplicate_vote", "suspicious_pattern"
  timestamp: v.number(),
})
  .index("by_poll", ["pollId"])
  .index("by_fingerprint", ["fingerprint"]);
```

---

## 6. API Design (Convex Functions)

### 6.1 Mutations

**createPoll**

```typescript
args: {
  question: string,
  options: string[],
  settings: PollSettings,
  creatorFingerprint?: string,
}
returns: { pollId: Id<"polls">, shareUrl: string }
```

**castVote**

```typescript
args: {
  pollId: Id<"polls">,
  optionIndex: number,
  voterFingerprint: string,
  ipAddress: string,
  userAgent: string,
}
returns: { success: boolean, message?: string }
```

### 6.2 Queries

**getPoll**

```typescript
args: {
  pollId: Id<"polls">;
}
returns: Poll | null;
```

**getResults**

```typescript
args: { pollId: Id<"polls"> }
returns: {
  question: string,
  options: Array<{ text: string, votes: number, percentage: number }>,
  totalVotes: number,
}
```

**hasVoted**

```typescript
args: {
  pollId: Id<"polls">,
  voterFingerprint: string,
}
returns: boolean
```

---

## 7. UI/UX Specifications

### 7.1 Homepage (Create Poll)

- Clean, centered form
- Question input (textarea, auto-resize)
- Option inputs (dynamic add/remove, min 2, max 10)
- "Advanced Settings" collapsible section:
  - Allow multiple votes toggle
  - Set expiration date picker
  - Require CAPTCHA toggle
- "Create Poll" primary button
- Examples section below fold

### 7.2 Poll Voting Page

- Poll question as H1
- Option cards:
  - Radio button selection
  - Large tap target (mobile-friendly)
  - Hover state
- "Submit Vote" button (disabled until selection)
- "View Results" link (if already voted)
- Footer: "Create your own poll" link

### 7.3 Results Page

- Poll question as H1
- Option results cards:
  - Option text
  - Vote count + percentage
  - Animated progress bar
  - Winner badge (if applicable)
- Total votes count
- Share section:
  - Copy link button
  - QR code (optional)
  - Social share buttons (optional)
- "Vote Again" button (if multiple votes allowed)

### 7.4 Mobile Responsiveness

- Stack elements vertically on mobile
- Larger touch targets (min 44x44px)
- Fixed "Submit" button on mobile
- Simplified animations

---

## 8. Security Considerations

### 8.1 Input Validation

- Sanitize all text inputs (XSS prevention)
- Limit string lengths (DoS prevention)
- Validate option indices (bounds checking)

### 8.2 Rate Limiting (Beyond Voting)

- API endpoint rate limits:
  - Poll creation: 10 per hour per IP
  - Vote submission: 100 per hour per IP
- Convex scheduled functions for cleanup

### 8.3 Data Privacy

- Hash IPs before storage (GDPR compliance)
- No PII collection without consent
- Option to delete polls (creator verification)

### 8.4 Abuse Monitoring

- Dashboard for creators to see:
  - Vote timeline
  - IP distribution (hashed)
  - Flagged suspicious votes
- Admin panel for platform-wide abuse detection

---

## 9. Recommended Implementation Priority

**Phase 1 - MVP (Success Criteria):**

1. ✅ Poll creation with shareable link
2. ✅ Single-choice voting
3. ✅ Real-time results (Convex automatic)
4. ✅ Persistence (Convex database)
5. ✅ Browser fingerprinting
6. ✅ IP-based rate limiting

**Phase 2 - Enhanced Anti-Abuse:** 7. Time-based cooldown 8. Composite fingerprint+IP check 9. User agent analysis 10. Abuse logging table

**Phase 3 - Advanced Features:** 11. CAPTCHA integration (conditional) 12. Voting pattern analysis 13. Creator dashboard 14. Poll expiration 15. Multiple vote modes

**Phase 4 - Polish:** 16. QR code generation 17. Social media previews (Open Graph) 18. Analytics dashboard 19. Export results (CSV) 20. Embed widget

---

## 10. Anti-Abuse Summary Table

| Mechanism              | What It Prevents      | Bypass Difficulty | User Friction | Recommended      |
| ---------------------- | --------------------- | ----------------- | ------------- | ---------------- |
| Browser Fingerprint    | Same-device revoting  | Medium            | None          | ✅ Yes (Primary) |
| IP Rate Limiting       | Same-network spam     | Medium            | Low           | ✅ Yes (Primary) |
| Fingerprint + IP Combo | Either alone          | High              | None          | ✅ Yes           |
| Time Cooldown          | Rapid multi-poll spam | Low               | Medium        | ✅ Yes           |
| User Agent Check       | Basic bot scripts     | Low               | None          | ✅ Yes           |
| CAPTCHA                | Automated bots        | High              | High          | ⚠️ Conditional   |
| Pattern Analysis       | Coordinated attacks   | Very High         | None          | ⚠️ Advanced      |

---

## 11. Success Metrics

**Technical:**

- Real-time update latency < 500ms
- Vote submission success rate > 99%
- False positive rate < 1% (legitimate users blocked)

**Business:**

- Polls created per day
- Average votes per poll
- Share link click-through rate
- Abuse reports per 1000 votes

---

