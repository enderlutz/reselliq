import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import OwnerDashboard from "@/pages/OwnerDashboard";
import InvestorDashboard from "@/pages/InvestorDashboard";
import Inventory from "@/pages/Inventory";
import Buylist from "@/pages/Buylist";
import Retailers from "@/pages/Retailers";
import Sales from "@/pages/Sales";
import Operations from "@/pages/Operations";
import Calculator from "@/pages/Calculator";
import Settings from "@/pages/Settings";
import Watcher from "@/pages/Watcher";
import Playbook from "@/pages/Playbook";
import Analytics from "@/pages/Analytics";
import Journal from "@/pages/Journal";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "owner") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRouter() {
  const { user } = useAuth();
  return user?.role === "investor" ? <InvestorDashboard /> : <OwnerDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route index element={<HomeRouter />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="sales" element={<Sales />} />
            <Route
              path="buylist"
              element={
                <OwnerOnly>
                  <Buylist />
                </OwnerOnly>
              }
            />
            <Route
              path="retailers"
              element={
                <OwnerOnly>
                  <Retailers />
                </OwnerOnly>
              }
            />
            <Route
              path="operations"
              element={
                <OwnerOnly>
                  <Operations />
                </OwnerOnly>
              }
            />
            <Route
              path="calculator"
              element={
                <OwnerOnly>
                  <Calculator />
                </OwnerOnly>
              }
            />
            <Route
              path="watcher"
              element={
                <OwnerOnly>
                  <Watcher />
                </OwnerOnly>
              }
            />
            <Route
              path="playbook"
              element={
                <OwnerOnly>
                  <Playbook />
                </OwnerOnly>
              }
            />
            <Route
              path="analytics"
              element={
                <OwnerOnly>
                  <Analytics />
                </OwnerOnly>
              }
            />
            <Route
              path="journal"
              element={
                <OwnerOnly>
                  <Journal />
                </OwnerOnly>
              }
            />
            <Route
              path="settings"
              element={
                <OwnerOnly>
                  <Settings />
                </OwnerOnly>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
