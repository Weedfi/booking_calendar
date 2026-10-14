import type { ChannelSource } from "./tape-chart";

/**
 * Display name and bar color per channel. The color says which calendar a
 * date is blocked in, not where the guest booked: iCal feeds do not tell a
 * booking from a manual block, and a stay sold elsewhere shows up as a block.
 */
export const CHANNELS: Record<ChannelSource, { label: string; color: string; occupied: string }> = {
  booking: { label: "Booking.com", color: "#1d4ed8", occupied: "Zajęte w Booking.com" },
  airbnb: { label: "Airbnb", color: "#e11d48", occupied: "Zajęte w Airbnb" },
  other: { label: "Inny", color: "#64748b", occupied: "Zajęte w innym kalendarzu" },
};
