"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { getFingerprint } from "./utils/fingerprint";

export default function Home() {
  const createPoll = useMutation(api.polls.create);
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [maxVotesPerIP, setMaxVotesPerIP] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    if (options.some((opt) => !opt.trim())) return;

    setIsSubmitting(true);
    try {
      const creatorFingerprint = await getFingerprint();
      const pollId = await createPoll({
        question,
        options: options.filter((o) => o.trim()),
        settings: {
          allowMultipleVotes,
          maxVotesPerIP,
          requireCaptcha: false,
        },
        creatorFingerprint,
      });
      router.push(`/poll/${pollId}`);
    } catch (error) {
      console.error("Failed to create poll:", error);
      alert("Failed to create poll. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-24 bg-gray-50 text-gray-900 font-sans">
      <div className="z-10 max-w-2xl w-full items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-4xl font-bold text-center w-full bg-linear-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent mb-2">
          Real-Time Polls
        </h1>
        <p className="text-center w-full text-gray-500 text-sm">
          Create, Share, Vote. Instantly.
        </p>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="question"
              className="block text-sm font-semibold leading-6 text-gray-900"
            >
              Question
            </label>
            <div className="mt-2">
              <textarea
                id="question"
                name="question"
                rows={3}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 px-3 bg-white"
                placeholder="What would you like to ask?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold leading-6 text-gray-900 mb-2">
              Options
            </label>
            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 px-3 bg-white"
                    placeholder={`Option ${index + 1}`}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100 ring-1 ring-inset ring-red-300"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1"
              >
                + Add Option
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Settings</h3>
            <div className="flex items-center gap-x-3">
              <input
                id="allow-multiple"
                name="allow-multiple"
                type="checkbox"
                checked={allowMultipleVotes}
                onChange={(e) => setAllowMultipleVotes(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 bg-white"
              />
              <label
                htmlFor="allow-multiple"
                className="block text-sm leading-6 text-gray-900"
              >
                Allow multiple votes per person
              </label>
            </div>

            <div className="mt-4">
              <label
                htmlFor="max-votes"
                className="block text-sm font-semibold leading-6 text-gray-900"
              >
                Max Votes per IP Address (for Rate Limiting)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="max-votes"
                  min="1"
                  max="100"
                  value={maxVotesPerIP}
                  onChange={(e) =>
                    setMaxVotesPerIP(parseInt(e.target.value) || 3)
                  }
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 px-3"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Limits how many votes can come from the same network in 1
                  hour. Set to 1 for strict testing.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full justify-center rounded-lg bg-black px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? "Creating..." : "Create Poll"}
          </button>
        </form>
      </div>
    </main>
  );
}
