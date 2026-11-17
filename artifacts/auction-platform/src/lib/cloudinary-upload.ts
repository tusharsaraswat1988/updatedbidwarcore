export interface CloudinaryImageUpload {
  url: string;
  publicId: string;
}

let activeRegistrationCode: string | null = null;

export function setActiveRegistrationCode(code: string | null): void {
  activeRegistrationCode = code?.trim() || null;
}

export function getActiveRegistrationCode(): string | null {
  if (activeRegistrationCode) return activeRegistrationCode;
  if (typeof window !== "undefined") {
    const match = window.location.pathname.match(/\/register\/([^/?#]+)/i);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
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
  options?: { registrationCode?: string },
): Promise<CloudinaryImageUpload> {
  const formData = new FormData();
  formData.append("file", file, filename);

  const headers: Record<string, string> = {};
  const code = options?.registrationCode || getActiveRegistrationCode();
  if (code) {
    headers["x-registration-code"] = code;
  }

  const res = await fetch("/api/upload", {
    method: "POST",
    credentials: "include",
    headers,
    body: formData,
  });
  return parseUploadResponse(res);
}

export async function uploadMediaFile(
  file: File | Blob,
  filename = "media.bin",
): Promise<CloudinaryImageUpload> {
  const formData = new FormData();
  formData.append("file", file, filename);
  const res = await fetch("/api/upload/media", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return parseUploadResponse(res);
}
