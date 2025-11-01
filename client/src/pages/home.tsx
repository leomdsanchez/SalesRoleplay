export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-semibold" data-testid="text-title">
          React Base
        </h1>
        <p className="text-muted-foreground" data-testid="text-subtitle">
          Pronto para começar seu projeto
        </p>
      </div>
    </div>
  );
}
