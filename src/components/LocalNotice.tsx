/** Diskret påminnelse om att framstegen bara finns i den här webbläsaren. */
export function LocalNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-ink-soft ${className}`} data-testid="local-notice">
      Dina framsteg sparas i den här webbläsaren. De följer inte med till andra enheter och kan försvinna om du rensar webbplatsdata.
    </p>
  );
}
