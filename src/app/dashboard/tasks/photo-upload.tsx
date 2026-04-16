"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function PhotoUpload({
  taskId,
  onUploaded,
  disabled,
}: {
  taskId: string;
  onUploaded: (path: string) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: images only, max 5MB
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB.");
      return;
    }

    setUploading(true);
    setError("");

    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${taskId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("task-photos")
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    onUploaded(fileName);
    setUploading(false);

    // Reset the input so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <div>
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 ${
          disabled || uploading ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        {uploading ? "Uploading..." : "Add Photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          className="hidden"
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function PhotoThumbnails({ paths }: { paths: string[] }) {
  const supabase = createClient();

  if (paths.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {paths.map((path) => {
        const { data } = supabase.storage
          .from("task-photos")
          .getPublicUrl(path);

        return (
          <a
            key={path}
            href={data.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-16 w-16 overflow-hidden rounded-lg border border-gray-200"
          >
            <img
              src={data.publicUrl}
              alt="Task photo"
              className="h-full w-full object-cover"
            />
          </a>
        );
      })}
    </div>
  );
}
