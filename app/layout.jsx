export const metadata = {
  title: "סימולציות פרישה",
  description: "אפליקציית סימולציות פרישה ליועץ (Vercel-ready)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#f6f7f9" }}>
        {children}
      </body>
    </html>
  );
}
