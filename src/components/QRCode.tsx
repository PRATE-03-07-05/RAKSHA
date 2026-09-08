/**
 * RAKSHA QR Code component - generates real scannable QR codes
 * Uses the qrcode library to generate actual QR codes that can be scanned
 */
import React, { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

interface QRCodeProps {
  /** The text/URL to encode in the QR code */
  value: string;
  /** Size in pixels */
  size?: number;
  /** Optional label to display below */
  label?: string;
  /** Error correction level */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

export function QRCode({ value, size = 200, label, errorCorrectionLevel = "M" }: QRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setError("No value provided");
      return;
    }

    QRCodeLib.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel,
      color: {
        dark: "#0a2b24",
        light: "#ffffff",
      },
    })
      .then(setDataUrl)
      .catch((err) => {
        console.error("QR code generation error:", err);
        setError("Failed to generate QR code");
      });
  }, [value, size, errorCorrectionLevel]);

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-4">
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-brand-900/15 bg-white p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={dataUrl}
        alt={`QR code for ${value}`}
        width={size}
        height={size}
        className="rounded-lg border border-brand-900/15"
      />
      {label && (
        <p className="text-center text-xs font-medium text-slate-600">{label}</p>
      )}
    </div>
  );
}
