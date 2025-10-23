// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "My Chatbot App",
  description: "A chatbot and map app built with Next.js",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* ① 这个属性只影响 React 的 diff，不会阻止 UI 更新 */}
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
