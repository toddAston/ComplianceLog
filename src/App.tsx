import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./ui/session/SessionContext";
import { RequireAuth } from "./ui/session/RequireAuth";
import { AppLayout } from "./ui/layout/AppLayout";
import { LoginPage } from "./ui/pages/LoginPage";
import { SignupPage } from "./ui/pages/SignupPage";
import { DashboardPage } from "./ui/pages/DashboardPage";
import { RecordsListPage } from "./ui/pages/RecordsListPage";
import { RecordCreatePage } from "./ui/pages/RecordCreatePage";
import { ReviewsPage } from "./ui/pages/ReviewsPage";
import { ContractorsPage } from "./ui/pages/ContractorsPage";
import { FarmsPage } from "./ui/pages/FarmsPage";
import { SettingsPage } from "./ui/pages/SettingsPage";
import { InviteAcceptPage } from "./ui/pages/InviteAcceptPage";
import { NotFoundPage } from "./ui/pages/NotFoundPage";

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          {/* Invite-accept landing — outside RequireAuth so the invitee can
              land on it before signing in. Token is informational in v0.1. */}
          <Route path="/invite/:token" element={<InviteAcceptPage />} />

          {/* Protected routes — RequireAuth redirects to /login when the
              session is not authenticated, preserving the original path so
              LoginPage can return the user there after sign-in. */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/records" element={<RecordsListPage />} />
            <Route path="/records/new" element={<RecordCreatePage />} />
            <Route path="/records/:id/edit" element={<RecordCreatePage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/contractors" element={<ContractorsPage />} />
            <Route path="/farms" element={<FarmsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Root → dashboard (RequireAuth on the layout above will bounce
              unauthenticated visitors to /login from there). */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;
