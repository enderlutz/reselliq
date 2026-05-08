import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipColor = "cyan" | "coral" | "indigo" | "orange" | "pink" | "emerald";

const colorMap: Record<ChipColor, string> = {
  cyan: "bg-[hsl(var(--chip-cyan))] text-[hsl(222_47%_6%)]",
  coral: "bg-[hsl(var(--chip-coral))] text-white",
  indigo: "bg-[hsl(var(--chip-indigo))] text-white",
  orange: "bg-[hsl(var(--chip-orange))] text-white",
  pink: "bg-[hsl(var(--chip-pink))] text-white",
  emerald: "bg-[hsl(var(--chip-emerald))] text-[hsl(222_47%_6%)]",
};

interface Props {
  icon: LucideIcon;
  color: ChipColor;
  title: string;
  onClick?: () => void;
}

export function ActionChip({ icon: Icon, color, title, onClick }: Props) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "h-10 w-10 rounded-xl chip-shadow flex items-center justify-center transition-all hover:scale-105 active:scale-95",
        colorMap[color]
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}
