import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Service Health Dashboard",
  description: "Real-time monitoring of connected services and configurations",
  keywords: "health check, monitoring, services, dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}