import { ApiError } from "@fantasy-cricket/api-client";

export function formatCrores(lakhs: number) {
  return `₹${(lakhs / 100).toFixed(2)}Cr`;
}

export function formatBidToken(lakhs: number) {
  if (lakhs >= 100) {
    return `₹${(lakhs / 100).toFixed(lakhs % 100 === 0 ? 0 : 2)}Cr`;
  }

  return `₹${lakhs}L`;
}

export function nameInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function timeLeftLabel(endsAt?: string, nowMs = Date.now()) {
  if (!endsAt) {
    return "Waiting";
  }
  const remainingMs = Math.max(0, new Date(endsAt).getTime() - nowMs);
  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return `${totalSeconds}s`;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
