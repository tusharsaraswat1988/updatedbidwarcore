export interface CloudinaryImageUpload {
  url: string;
  publicId: string;
}

async function parseUploadResponse(res: Response): Promise<CloudinaryImageUpload> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `Upload failed (${res.status})`);
  }
  const data = await res.json() as { url?: string; publicId?: string };
  if (!data.url?.trim()) {
    throw new Error("Upload failed: missing image URL.");
  }
  return {
    url: data.url,
    publicId: data.publicId?.trim() || "",
  };
}

export async function uploadImageFile(
  file: File | Blob,
  filename = "image.png",
): Promise<CloudinaryImageUpload> {
  const formData = new FormData();
  formData.append("file", file, filename);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  return parseUploadResponse(res);
}

export async function uploadMediaFile(
  file: File | Blob,
  filename = "media.bin",
): Promise<CloudinaryImageUpload> {
  const formData = new FormData();
  formData.append("file", file, filename);
  const res = await fetch("/api/upload/media", { method: "POST", body: formData });
  return parseUploadResponse(res);
}
