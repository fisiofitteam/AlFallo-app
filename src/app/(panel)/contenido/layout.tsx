export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return <div className="content-panel">
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
    {children}
  </div>;
}
