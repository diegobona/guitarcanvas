import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "GuitarCanvas",
  description:
    "Online guitar design tools for pickguards, partscasters, and custom guitar mockups.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
