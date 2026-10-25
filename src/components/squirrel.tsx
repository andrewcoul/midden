import { cn } from "@/lib/utils";

const RED = "var(--squirrel)";
const TAIL = "M37 52C51 53 58 42 55.5 29.5C53 17 41 12.5 35.5 19.5C31.5 24.5 36 31 41.5 27.5";
const EAR = "M18 19.6C17.2 13.6 18.6 7.4 22.2 2C22.6 7.8 24.8 12.8 27.8 16.6Z";
const SNOUT = "M15.4 23.4C13.2 23.6 11.6 25 11.6 26.6C11.6 28.6 13.6 29.8 16 29.6Z";

/** midden logo: a red squirrel silhouette. Reads at 16–32px. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path d={TAIL} stroke={RED} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="30" cy="42" rx="11.5" ry="13" fill={RED} />
      <path d={EAR} fill={RED} />
      <circle cx="23.5" cy="24.5" r="9" fill={RED} />
      <path d={SNOUT} fill={RED} />
      <circle cx="20.6" cy="22.4" r="2.2" fill="#fff" />
      <ellipse cx="24" cy="55" rx="5" ry="2.4" fill={RED} />
    </svg>
  );
}

/** The full mascot: a red squirrel holding a pine cone (a midden is where it stores them). */
export function Mascot({ size = 88, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <path d={TAIL} stroke={RED} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="30" cy="42" rx="11.5" ry="13" fill={RED} />
      <ellipse cx="26.5" cy="44.5" rx="6" ry="8.5" fill="#f3d9c2" />
      <path d={EAR} fill={RED} />
      <circle cx="23.5" cy="24.5" r="9" fill={RED} />
      <path d={SNOUT} fill={RED} />
      <circle cx="12.2" cy="25.8" r="1" fill="#0a0a0a" />
      <circle cx="20.6" cy="22.4" r="1.7" fill="#0a0a0a" />
      <circle cx="21.1" cy="21.8" r=".5" fill="#fff" />
      <ellipse cx="22" cy="36.5" rx="4.2" ry="5" fill="#6e4428" transform="rotate(-12 22 36.5)" />
      <path d="M18.6 34.5h6.6M18.4 37.4h7M19.4 40.2h5" stroke="#4a2c18" strokeWidth={1} strokeLinecap="round" />
      <ellipse cx="18.8" cy="33.5" rx="2.6" ry="2" fill={RED} />
      <ellipse cx="24" cy="55" rx="5" ry="2.4" fill={RED} />
    </svg>
  );
}
