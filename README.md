# One-Person-One-Vote (Face ID & Anti-Abuse System)

This project demonstrates a secure, fair, and privacy-preserving voting system that ensures "One Person, One Vote" using biometric verification and advanced anti-abuse mechanisms.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Backend**: Convex (Realtime Database, Vector Search, Server Actions)
- **AI/ML**: `face-api.js` (Client-side Face Detection & Descriptor Extraction)
- **Security**: Cloudflare Turnstile (Bot Protection), FingerprintJS (Device Fingerprinting)
- **UI Components**: Sonner (Toasts), Custom Video/Canvas overlays

## Fairness & Anti-Abuse Mechanisms

### 1. Biometric Uniqueness (Face ID)

To prevent the same person from voting multiple times across different devices or IP addresses, we verify the **physical person**:

- **Client-Side Processing**: We use `face-api.js` (SSD Mobilenet V1 + Face Landmark 68) to detect a face and generate a **128-dimensional face descriptor** directly in the browser.
- **Privacy-First**: **NO images are ever sent to the server.** Only the mathematical array (descriptor) is transmitted.
- **Vector Search Verification**: The descriptor is sent to Convex, where we perform a **Vector Search (Cosine Similarity)** against all previous votes in the poll.
- **Thresholding**: If a vote with a similarity score > **0.95** is found, the new vote is rejected as a duplicate.

### 2. Multi-Layered Bot Protection

- **Cloudflare Turnstile**: A "smart CAPTCHA" widget is integrated into the voting flow. It silently challenges the client to ensure it's a human user, not a script. The token is verified server-side before processing any vote.
- **Device Fingerprinting**: We use **FingerprintJS** to generate a stable visitor ID. This prevents simple browser-clearing attacks.
- **IP Rate Limiting**: Maximum of **3 votes per hour per IP address** to prevent network-level spamming.

## Edge Cases Handled

- **Camera Access**: Graceful error handling and UI feedback if the user denies camera permissions or if no camera is detected.
- **Model Loading State**: The "Verify & Vote" button remains disabled with a loading spinner until the 5MB+ AI models are fully loaded and the camera stream is active.
- **Concurrent Voting**: Leveraging Convex's transactional guarantees to ensure vote counts remain accurate even if multiple users vote exactly at the same time.
- **No Face / Multiple Faces**: The system strictly requires exactly **one** face to be detected. If `face-api.js` sees 0 or >1 faces, it prompts the user to adjust their position.

## Known Limitations & Future Improvements

1.  **Lighting Sensitivity**: The client-side face detection model can struggle in very low light or with strong backlighting.
    - _Improvement_: Add a UI guide for optimal lighting or switch to a more robust server-side model if needed.
2.  **Initial Load Performance**: Downloading the AI models (~6-10MB) takes a few seconds on the first visit, especially on mobile networks.
    - _Improvement_: Implement aggressive caching or compress the models further.
3.  **Strict Similarity Threshold**: The 0.95 similarity threshold is heuristic.
    - _Improvement_: Collect more data to tune this threshold or implement a dynamic threshold based on confidence scores.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
