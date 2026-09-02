"use client";

import React from "react";

interface QrCodeProps {
  value: string;
  size?: number;
}

export function QrCode({ value, size = 180 }: QrCodeProps) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    value
  )}&margin=10`;

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-sm border border-zinc-200 dark:border-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrUrl}
        alt="2FA QR Code"
        width={size}
        height={size}
        className="rounded-xl"
        loading="eager"
      />
    </div>
  );
}
