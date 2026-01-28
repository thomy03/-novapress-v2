// Layout simplifié pour les pages de dev (kanban, etc.)
// Pas besoin des providers complets

export default function DevLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh' }}>
      {children}
    </div>
  );
}
