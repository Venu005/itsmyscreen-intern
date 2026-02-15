"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { getFingerprint } from "../../utils/fingerprint";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import TurnstileWidget from "../../components/TurnstileWidget";
import FaceAuth from "../../components/FaceAuth";
import { useAction } from "convex/react";

export default function PollPage() {
  const params = useParams();
  const pollId = params.pollId as Id<"polls">;

  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showFaceAuth, setShowFaceAuth] = useState(false);
  // View state: 'form' or 'results'
  const [view, setView] = useState<"form" | "results">("form");

  useEffect(() => {
    getFingerprint().then((fp) => {
      setFingerprint(fp);
      localStorage.setItem("poll_fingerprint", fp);
    });
  }, []);

  const poll = useQuery(api.polls.get, { pollId });
  const results = useQuery(api.polls.getResults, { pollId });
  const hasVoted = useQuery(
    api.votes.hasVoted,
    fingerprint ? { pollId, fingerprint } : "skip",
  );
  const castVote = useMutation(api.votes.cast);
  const castVoteWithFace = useAction(api.votes.castWithFace);

  // Initial view logic: If user voted and multiple votes are NOT allowed, show results.
  // We use a flag to only set this once to avoid overriding user navigation (e.g. "Vote Again")
  const [initialViewSet, setInitialViewSet] = useState(false);
  useEffect(() => {
    if (!initialViewSet && hasVoted !== undefined && poll) {
      if (hasVoted && !poll.settings.allowMultipleVotes) {
        setView("results");
      }
      setInitialViewSet(true);
    }
  }, [hasVoted, poll, initialViewSet]);

  if (!poll || !results || fingerprint === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-8 w-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const handleVote = async () => {
    if (selectedOption === null) return;

    // If multiple votes are NOT allowed, require Face Auth
    if (!poll.settings.allowMultipleVotes) {
      setShowFaceAuth(true);
      return;
    }

    // Otherwise, proceed with standard voting (IP/Fingerprint only)
    await submitVote(null);
  };

  const submitVote = async (faceDescriptor: Float32Array | null) => {
    setIsVoting(true);
    setShowFaceAuth(false); // Hide if open

    try {
      // Best effort IP fetch with timeout
      let ipAddress = "0.0.0.0";
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const ipRes = await fetch("https://api.ipify.org?format=json", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.warn("Could not fetch IP, using fallback");
      }

      if (faceDescriptor) {
        // Use Face Auth Action
        await castVoteWithFace({
          pollId,
          optionIndex: selectedOption!,
          voterFingerprint: fingerprint!, // ensured by checks
          ipAddress: ipAddress,
          userAgent: navigator.userAgent,
          token: turnstileToken || undefined,
          embedding: Array.from(faceDescriptor),
        });
      } else {
        // Use Standard Mutation
        await castVote({
          pollId,
          optionIndex: selectedOption!,
          voterFingerprint: fingerprint!,
          ipAddress: ipAddress,
          userAgent: navigator.userAgent,
          token: turnstileToken || undefined,
        });
      }

      toast.success("Vote submitted successfully!");
      setView("results");
      setSelectedOption(null); // Reset selection
    } catch (err: any) {
      console.error(err);
      if (err.data) {
        toast.error(err.data);
      } else {
        toast.error(err.message || "Failed to submit vote. Please try again.");
      }
    } finally {
      setIsVoting(false);
    }
  };

  if (view === "results") {
    return (
      <ResultsView
        poll={poll}
        results={results}
        totalVotes={results.totalVotes}
        canVoteAgain={poll.settings.allowMultipleVotes}
        onVoteAgain={() => {
          // Simple transition effect
          const btn = document.getElementById("vote-again-btn");
          if (btn) btn.innerText = "Loading...";
          setTimeout(() => setView("form"), 500);
        }}
        fingerprint={fingerprint}
        hasVoted={hasVoted}
      />
    );
  }

  // Form View
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 text-gray-900 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {poll.question}
        </h1>

        <div className="space-y-3">
          {poll.options.map((option: string, index: number) => (
            <div
              key={index}
              onClick={() => setSelectedOption(index)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedOption === index
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedOption === index
                      ? "border-blue-600"
                      : "border-gray-300"
                  }`}
                >
                  {selectedOption === index && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  )}
                </div>
                <span className="font-medium">{option}</span>
              </div>
            </div>
          ))}
        </div>

        <TurnstileWidget onVerify={setTurnstileToken} />

        <button
          onClick={handleVote}
          disabled={selectedOption === null || isVoting}
          className="mt-6 w-full rounded-lg bg-black px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isVoting ? "Submitting..." : "Submit Vote"}
        </button>

        <div className="mt-4 text-center">
          <button
            onClick={() => setView("results")}
            className="text-sm text-gray-500 underline"
          >
            View Results without voting
          </button>
        </div>
      </div>

      {showFaceAuth && (
        <FaceAuth
          onFaceDetected={(descriptor) => submitVote(descriptor)}
          onCancel={() => setShowFaceAuth(false)}
        />
      )}
    </div>
  );
}

function ResultsView({
  poll,
  results,
  totalVotes,
  canVoteAgain,
  onVoteAgain,
  fingerprint,
  hasVoted,
}: any) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 text-gray-900 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {poll.question}
        </h1>
        <p className="text-gray-500 text-sm mb-6">{totalVotes} votes</p>

        <div className="space-y-4">
          {results.options.map((opt: any, index: number) => (
            <div key={index} className="relative">
              <div className="flex justify-between text-sm font-medium mb-1 z-10 relative">
                <span>{opt.text}</span>
                <span>
                  {Math.round(opt.percentage)}% ({opt.votes})
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${opt.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied to clipboard!");
            }}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Share Poll
          </button>
          {(canVoteAgain || !hasVoted) && (
            <button
              id="vote-again-btn"
              onClick={onVoteAgain}
              className="flex-1 rounded-lg bg-black px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-all"
            >
              {!hasVoted ? "Cast Vote" : "Vote Again"}
            </button>
          )}
        </div>
        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-blue-600 hover:underline">
            Create your own poll
          </a>
        </div>
        <div className="mt-6 text-center text-xs text-gray-400">
          Device ID: {fingerprint || "Loading..."}
        </div>
      </div>
    </div>
  );
}
