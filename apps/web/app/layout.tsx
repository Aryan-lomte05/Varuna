import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: '--font-outfit',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: "OceanMind AI | FloatChat",
  description: "AI Intelligence Platform for ARGO Ocean Data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {/* Main Background Ambient Glow */}
        <div className="fixed inset-0 z-[-1] bg-deep">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-argo-blue/20 blur-[150px] mix-blend-screen pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-argo-cyan/10 blur-[150px] mix-blend-screen pointer-events-none" />
          <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] rounded-full bg-surface/40 blur-[100px] pointer-events-none" />
        </div>
        
        {children}
      </body>
    </html>
  );
}
