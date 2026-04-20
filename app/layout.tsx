import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/auth";
import { getUserSetting } from "@/lib/db/queries";
import { getThemeStorageKey, isThemeValue } from "@/lib/theme";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CSE Pulse - Colombo Stock Exchange Tracker",
  description: "Personal real-time CSE market tracker with AI-powered portfolio management",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userEmail = session?.user?.email ?? null;
  const storedTheme = userEmail ? getUserSetting(userEmail, "theme") : null;
  const initialTheme = isThemeValue(storedTheme) ? storedTheme : "system";
  const themeStorageKey = getThemeStorageKey(userEmail);

  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers initialTheme={initialTheme} themeStorageKey={themeStorageKey}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
