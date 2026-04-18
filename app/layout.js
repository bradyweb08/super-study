import "./globals.css";

export const metadata = {
  title: "Personal Study",
  description: "A local-first study app with decks, Learn mode, and spaced repetition."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
