import "./globals.css";

export const metadata = {
  title: "Storm Archive",
  description:
    "Every recorded US tornado and hurricane track, 1851-present, auto-updated.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0b0f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
