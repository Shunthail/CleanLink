import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CleanLink — Des liens plus simples",
  description:
    "Nettoyer, analyser et raccourcir des liens. Statistiques agrégées, sans cookies de suivi.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
