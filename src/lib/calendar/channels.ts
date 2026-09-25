import type { ChannelSource } from "./tape-chart";

/** Display name and bar color per booking channel. */
export const CHANNELS: Record<ChannelSource, { label: string; color: string }> = {
  booking: { label: "Booking.com", color: "#1d4ed8" },
  airbnb: { label: "Airbnb", color: "#e11d48" },
  other: { label: "Other", color: "#64748b" },
};
