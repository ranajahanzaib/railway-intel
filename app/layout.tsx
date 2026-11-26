import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "Railway Intel — Historical Network Performance",
  description:
    "Explore observed historical railway performance across Germany.",
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
