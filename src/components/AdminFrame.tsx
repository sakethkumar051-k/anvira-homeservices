import React from "react";
export type AdminFrameProps = {
  title?: string;
  back?: boolean;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};
export default function AdminFrame({ children }: AdminFrameProps) {
  return <>{children}</>;
}
