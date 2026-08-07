import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolidChat AI — Dashboard",
  description: "Admin & CS dashboard for SolidChat AI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
