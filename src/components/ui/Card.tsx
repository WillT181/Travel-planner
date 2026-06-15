import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "elevated" | "flat";
export type CardPadding = "none" | "sm" | "md" | "lg";

const variantClasses: Record<CardVariant, string> = {
  default: "border border-neutral-200 bg-white shadow-sm",
  elevated: "border border-neutral-200 bg-white shadow-md",
  flat: "border border-neutral-200 bg-neutral-50",
};

const paddingClasses: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

export default function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        variantClasses[variant],
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
