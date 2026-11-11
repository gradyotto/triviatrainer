export const CONVERSION_EVENTS = [
  "signup",
  "daily_limit_hit",
  "upgrade_page_viewed",
  "checkout_started",
  "upgrade_completed",
  "subscription_canceled",
] as const;

export type ConversionEventName = (typeof CONVERSION_EVENTS)[number];

export function isConversionEvent(value: string): value is ConversionEventName {
  return (CONVERSION_EVENTS as readonly string[]).includes(value);
}
