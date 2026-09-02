export const metadata = {
  title: 'VerifyBlind',
  icons: {
    icon: 'https://cdn.verifyblind.com/images/favicon.ico',
    shortcut: 'https://cdn.verifyblind.com/images/favicon.ico',
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
