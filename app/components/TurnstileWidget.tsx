"use client";

import Turnstile, { useTurnstile } from "react-turnstile";
import { useEffect, useState } from "react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
}

export default function TurnstileWidget({ onVerify }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
  const turnstile = useTurnstile();

  if (!siteKey) {
    return <div className="text-red-500 text-xs">Missing Site Key</div>;
  }

  return (
    <div className="flex justify-center my-4">
      <Turnstile sitekey={siteKey} onVerify={onVerify} theme="light" />
    </div>
  );
}
