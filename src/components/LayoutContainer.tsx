// src/components/LayoutContainer.tsx
import React from "react";

type Props = { children: React.ReactNode; className?: string };

/** Shared page container for consistent max-width + padding across pages */
export default function LayoutContainer({ children, className = "" }: Props) {
  return (
    <div className={`max-w-7xl mx-auto px-6 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}