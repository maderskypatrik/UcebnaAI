import type { ButtonHTMLAttributes } from "react";

/** Primary action for anything that triggers the AI. */
export function AssistantButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`bg-assistant rounded-xl px-6 py-3 font-medium text-on-primary transition-[filter] hover:saturate-150 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
