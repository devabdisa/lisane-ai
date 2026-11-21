import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic"],
});

export const metadata: Metadata = {
  title: "Lisane AI",
  description: "Private English speaking practice with support in your own language.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSansEthiopic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-fg">{children}</body>
    </html>
  );
}
