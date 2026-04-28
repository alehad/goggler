import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "goggler",
  description: "Track lost eBay auctions and spot relistings."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

