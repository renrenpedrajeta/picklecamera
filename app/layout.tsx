import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casa Batik | Your court. Your moment.",
  description:
    "Record your pickleball match at Casa Batik and keep your favorite moments.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
