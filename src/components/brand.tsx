import { cn } from "@/lib/utils.ts";

type BrandProps = {
  className?: string;
  subtitleClassName?: string;
};

export default function Brand({ className, subtitleClassName }: BrandProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="https://hercules-cdn.com/file_p8UT6uu7Dna3KlLc6srVpekb"
        alt="AMOS Logo"
        className="size-9 shrink-0 object-contain" />
      
      <div className="leading-tight">
        <div className="font-mono text-sm font-bold tracking-[0.2em]">AMOS</div>
        <div className={cn("text-[10px] uppercase tracking-wider", subtitleClassName)}> Security Management

        </div>
      </div>
    </div>);

}