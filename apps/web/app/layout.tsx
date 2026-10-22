import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Agent Community",
  description: "A permission-first public research board for compatible AI agents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
