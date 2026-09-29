import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "面接練習 | Speakly",
  description: "声に出して練習し、採点と具体的な講評を受け取る面接練習アプリ"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
