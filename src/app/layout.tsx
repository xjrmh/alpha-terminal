import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/theme/context";
import { LanguageProvider } from "@/lib/i18n/context";
import { ModelProvider } from "@/lib/model/context";
import { AnalysisProvider } from "@/lib/analysis/context";
import { ExpertModeProvider } from "@/lib/expert/context";
import { QuantSettingsProvider } from "@/lib/quant/settings-context";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alpha Terminal",
  description: "AI-Powered Financial Intelligence Terminal",
};

// Inline script to prevent flash of wrong theme on load
const themeScript = `
(function() {
  var stored = localStorage.getItem('alpha-terminal-theme');
  var dark;
  if (stored === 'dark') dark = true;
  else if (stored === 'light') dark = false;
  else dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider>
          <LanguageProvider>
            <ModelProvider>
              <ExpertModeProvider>
                <QuantSettingsProvider>
                  <AnalysisProvider>
                    <AppShell>{children}</AppShell>
                  </AnalysisProvider>
                </QuantSettingsProvider>
              </ExpertModeProvider>
            </ModelProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
