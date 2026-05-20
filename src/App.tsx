import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./ui/session/SessionContext";
import { AppLayout } from "./ui/layout/AppLayout";
import { LoginPage } from "./ui/pages/LoginPage";
import { SignupPage } from "./ui/pages/SignupPage";
import { DashboardPage } from "./ui/pages/DashboardPage";
import { RecordsListPage } from "./ui/pages/RecordsListPage";
import { RecordCreatePage } from "./ui/pages/RecordCreatePage";
import { ReviewsPage } from "./ui/pages/ReviewsPage";
import { SettingsPage } from "./ui/pages/SettingsPage";
import { NotFoundPage } from "./ui/pages/NotFoundPage";

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected routes */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/records" element={<RecordsListPage />} />
            <Route path="/records/new" element={<RecordCreatePage />} />
            <Route path="/records/:id/edit" element={<RecordCreatePage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;
