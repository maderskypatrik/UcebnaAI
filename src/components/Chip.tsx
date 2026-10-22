/** AI generation chip for suggested keywords or pedagogical goals. */
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-secondary-container/60 px-3 py-1 text-label-md font-medium text-on-secondary-container">
      {children}
    </span>
  );
}
