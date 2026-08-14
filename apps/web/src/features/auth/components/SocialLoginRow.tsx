// Twitter/GitHub sign-in — no OAuth exists anywhere in the backend yet, so these
// are rendered disabled rather than wired to anything or dropped entirely,
// matching the reference design's visual layout. lucide-react dropped brand/logo
// icons (trademark reasons, same issue hit earlier for Instagram/LinkedIn), so
// both are small inline SVGs rather than a separate icon package.
function TwitterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 5.92c-.74.33-1.53.55-2.36.65a4.12 4.12 0 0 0 1.8-2.27 8.2 8.2 0 0 1-2.6 1c-.75-.8-1.82-1.3-3-1.3-2.27 0-4.11 1.84-4.11 4.11 0 .32.04.64.1.94A11.65 11.65 0 0 1 3.4 4.6a4.1 4.1 0 0 0 1.27 5.48c-.67-.02-1.3-.2-1.85-.51v.05c0 1.99 1.42 3.65 3.3 4.03-.35.1-.71.15-1.09.15-.27 0-.52-.03-.78-.07.53 1.63 2.05 2.83 3.85 2.86A8.25 8.25 0 0 1 2 18.57a11.63 11.63 0 0 0 6.3 1.85c7.55 0 11.68-6.26 11.68-11.68l-.01-.53c.8-.58 1.5-1.3 2.03-2.12z" />
    </svg>
  );
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.93.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.53 9.53 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
    </svg>
  );
}

export function SocialLoginRow() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        Or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex items-center justify-center rounded-md border border-input py-2.5 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <TwitterIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          disabled
          title="Coming soon"
          className="flex items-center justify-center rounded-md border border-input py-2.5 text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GithubIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
