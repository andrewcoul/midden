import { Check, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Mascot } from "@/components/squirrel";
import { Button } from "@/components/ui/button";
import type { Me } from "@/lib/types";

const SETUP_GUIDE = "https://github.com/andrewcoul/midden#set-up";

/** The screen for a visitor who is not signed in. It depends on the sign-in methods that are set up. */
export function SignIn({ me }: { me: Me | null }) {
  if (!me) return <StartError />;
  if (me.accessReady) return <AccessSignIn denied={me.denied} />;
  return <Setup detected={me.detected} />;
}

function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="satin flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      {children}
      <p className="text-[13px] text-[#8a8a8a]">{footer ?? "Self-hosted · your files stay yours"}</p>
    </div>
  );
}

function Title({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Mascot size={88} />
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-[28px] leading-9 font-medium tracking-[-0.035em]">{title}</h1>
        <p className="text-[15px] text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function StartError() {
  return (
    <Screen>
      <div className="window flex w-full max-w-[400px] flex-col items-center gap-8 rounded-3xl px-8 pt-10 pb-8">
        <Title title="midden did not start">The server has a problem. Look at the Worker logs in Cloudflare.</Title>
        <Button size="lg" className="w-full" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    </Screen>
  );
}

function AccessSignIn({ denied }: { denied: string | null }) {
  return (
    <Screen>
      <div className="window flex w-full max-w-[400px] flex-col items-center gap-8 rounded-3xl px-8 pt-10 pb-8">
        {denied ? (
          <Title title="Not allowed">{denied} cannot open this midden.</Title>
        ) : (
          <Title title="Sign in with Cloudflare">This midden uses Cloudflare Access to sign you in.</Title>
        )}
        <Button asChild size="lg" className="w-full">
          {/* Access signs out at this path. Then the next page load asks for a sign-in again. */}
          <a href={denied ? "/cdn-cgi/access/logout" : "/"}>{denied ? "Use another account" : "Sign in"}</a>
        </Button>
      </div>
    </Screen>
  );
}

function Setup({ detected }: { detected: Me["detected"] }) {
  const steps = [
    "In Cloudflare, open Workers & Pages → midden → Settings.",
    "Under Domains & Routes, click Enable Cloudflare Access.",
    detected ? "Add these values as Worker variables. Then open midden again." : "Open midden again. It will show two values to add as Worker variables.",
  ];
  return (
    <Screen
      footer={
        <>
          Open source ·{" "}
          <a href={SETUP_GUIDE} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Read the setup guide on GitHub
          </a>
        </>
      }
    >
      <div className="window flex w-full max-w-[560px] flex-col gap-8 rounded-3xl px-10 pt-10 pb-8">
        <div className="flex items-center gap-4">
          <Mascot size={56} />
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] leading-9 font-medium tracking-[-0.035em]">Set up midden</h1>
            <p className="text-[15px] text-muted-foreground">Turn on Cloudflare Access to open your files.</p>
          </div>
        </div>
        <section className="flex flex-col gap-4">
          <h2 className="text-[17px] leading-6 font-semibold tracking-[-0.02em]">Sign in with Cloudflare</h2>
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-[15px] leading-6">
                <span className="ink inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          {detected && (
            <div className="ml-9 flex flex-col rounded-2xl bg-input p-1">
              <CopyRow name="MIDDEN_ACCESS_TEAM_DOMAIN" value={detected.teamDomain} />
              <div className="mx-4 h-px bg-[#e3e3e3]" />
              <CopyRow name="MIDDEN_ACCESS_AUD" value={detected.aud} />
            </div>
          )}
        </section>
      </div>
    </Screen>
  );
}

function CopyRow({ name, value }: { name: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 py-2 pr-2 pl-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs leading-4 font-medium text-muted-foreground">{name}</span>
        <span className="truncate font-mono text-sm leading-5">{value}</span>
      </div>
      <button
        type="button"
        aria-label={`Copy ${name}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-background shadow-[0_0_0_1px_rgb(0_0_0/6%)] hover:bg-accent"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
