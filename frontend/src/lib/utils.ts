import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString();
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  POST: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  PUT: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  PATCH: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20",
  DELETE: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  HEAD: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20",
  OPTIONS: "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-600/20",
};
