import { ErrorBoundary } from "@presentation/components/ErrorBoundary";
import { PWAStatus } from "@presentation/components/PWAStatus";
import { HomePage } from "@presentation/pages/HomePage";

export function App() {
  return (
    <ErrorBoundary>
      <HomePage />
      <PWAStatus />
    </ErrorBoundary>
  );
}
