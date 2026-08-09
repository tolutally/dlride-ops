import Image from "next/image";

import dlrideLogo from "@/public/Dlride rental LLC logo.png";

import { cn } from "./utils";

export function BrandLogo({ className, priority = false }: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      className={cn(className)}
      src={dlrideLogo}
      alt="DLride Rental LLC"
      priority={priority}
      sizes="(max-width: 520px) 152px, 176px"
    />
  );
}
