"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type Unit = {
  id: string;
  name: string;
  short_code: string;
  qr_token: string;
};

export default function QRCardGrid({
  units,
  baseUrl,
}: {
  units: Unit[];
  baseUrl: string;
}) {
  return (
    <>
      {/* Print all button */}
      <div className="mb-6">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Print All QR Codes
        </button>
      </div>

      {/* Grid of QR cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-4">
        {units.map((unit) => (
          <QRCard key={unit.id} unit={unit} baseUrl={baseUrl} />
        ))}
      </div>
    </>
  );
}

function QRCard({ unit, baseUrl }: { unit: Unit; baseUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const feedbackUrl = `${baseUrl}/q/${unit.qr_token}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        feedbackUrl,
        {
          width: 200,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        },
        () => setReady(true)
      );
    }
  }, [feedbackUrl]);

  function downloadQR() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `qr-${unit.short_code}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 text-center print:break-inside-avoid print:border print:shadow-none">
      {/* Room name */}
      <h3 className="mb-1 text-lg font-semibold text-gray-900">{unit.name}</h3>
      <p className="mb-4 text-xs text-gray-400">{unit.short_code}</p>

      {/* QR code */}
      <div className="flex justify-center">
        <canvas ref={canvasRef} />
      </div>

      {/* Instructions for guest */}
      <p className="mt-4 text-sm text-gray-600 print:text-xs">
        Scan to share your experience
      </p>

      {/* Download button — hidden when printing */}
      <button
        onClick={downloadQR}
        disabled={!ready}
        className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 print:hidden"
      >
        Download PNG
      </button>
    </div>
  );
}
