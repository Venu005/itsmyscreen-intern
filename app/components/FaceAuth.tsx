"use client";

import React, { useRef, useEffect, useState } from "react";
import { toast } from "sonner";

interface FaceAuthProps {
  onFaceDetected: (descriptor: Float32Array) => void;
  onCancel: () => void;
}

export default function FaceAuth({ onFaceDetected, onCancel }: FaceAuthProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to hold the dynamically imported faceapi module
  const faceApiRef = useRef<any>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const faceapi = await import("face-api.js");
        faceApiRef.current = faceapi; // Store module for later use

        const MODEL_URL = "/models";
        // Silent logs for production, but useful for debug if needed
        // console.log("Loading FaceAPI models...");

        await Promise.all([
          // Try standard names first, then fallbacks
          (
            faceapi.nets.ssdMobilenetv1 || faceapi.nets.ssdMobilenetv1
          ).loadFromUri(MODEL_URL),
          (
            faceapi.nets.faceLandmark68 || faceapi.nets.faceLandmark68Net
          ).loadFromUri(MODEL_URL),
          (
            faceapi.nets.faceRecognition || faceapi.nets.faceRecognitionNet
          ).loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load models", err);
        setError("Failed to load AI models. Please refresh the page.");
      }
    };
    loadModels();
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to actually start playing to remove loading state
        videoRef.current.onloadedmetadata = () => {
          setCameraActive(true);
        };
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setError("Camera access denied. Please allow camera access to vote.");
    }
  };

  useEffect(() => {
    if (modelsLoaded) {
      startVideo();
    }
    return () => {
      // Cleanup stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [modelsLoaded]);

  const captureCtx = async () => {
    if (!videoRef.current || !faceApiRef.current) return;
    setCapturing(true);

    try {
      const faceapi = faceApiRef.current;

      // 1. Detect Face with higher confidence threshold if possible, but defaults are usually okay
      // We can also check if video is ready
      if (videoRef.current.paused || videoRef.current.ended) {
        toast.error("Camera is not active");
        setCapturing(false);
        return;
      }

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error(
          "No face detected. Please position yourself clearly and try again.",
        );
        setCapturing(false);
        return;
      }

      // 2. Get Descriptor
      const descriptor = detection.descriptor;

      // Stop stream immediately to freeze frame (UX choice) or leave it running?
      // Let's stop it so the user feels "captured"
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      // Slight delay to show "Verified" state if we wanted, but we pass it up immediately
      onFaceDetected(descriptor);
    } catch (err) {
      console.error("Detection error", err);
      toast.error("Failed to process face. Please try again.");
      setCapturing(false);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
        <div className="bg-white p-8 rounded-2xl max-w-sm text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={onCancel}
            className="w-full inline-flex justify-center rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm transition-all duration-300 p-4">
      <div className="bg-white p-6 rounded-2xl max-w-lg w-full flex flex-col items-center relative shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Face Verification
          </h2>
          <p className="text-gray-500 text-sm mt-1">One person, one vote.</p>
        </div>

        <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden mb-6 shadow-inner ring-1 ring-gray-200">
          {/* Loading Overlays */}
          {(!modelsLoaded || !cameraActive) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-white bg-gray-900/80 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-3"></div>
              <p className="text-sm font-medium">
                {!modelsLoaded ? "Loading AI models..." : "Starting camera..."}
              </p>
            </div>
          )}

          {/* Video Element */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onPlay={() => {}}
            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${cameraActive ? "opacity-100" : "opacity-0"}`}
          />

          {/* Scanning Overlay (during capture) */}
          {capturing && (
            <div className="absolute inset-0 bg-blue-500/10 z-20 flex items-center justify-center">
              <div className="w-full h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_1.5s_ease-in-out_infinite] absolute top-0"></div>
              <div className="bg-black/60 backdrop-blur text-white px-4 py-2 rounded-full flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span className="text-sm font-medium">Verifying face...</span>
              </div>
            </div>
          )}

          <canvas
            id="overlay"
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>

        <p className="text-xs text-center text-gray-400 mb-6 max-w-xs mx-auto">
          We convert your face into a secure digital code to check for duplicate
          votes. No images are stored.
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            disabled={capturing}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Cancel
          </button>

          <button
            onClick={captureCtx}
            disabled={!modelsLoaded || !cameraActive || capturing}
            className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
          >
            {capturing ? (
              "Processing..."
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Verify & Vote
              </>
            )}
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
