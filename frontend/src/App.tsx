import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import PrivateRoute from "./components/PrivateRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import Recommendations from "./pages/Recommendations";
import Orders from "./pages/Orders";
import Users from "./pages/Users";
import { AICopilotDrawer } from "./components/AICopilotDrawer";
import api from "./services/api";
import { useSocket } from "./hooks/useSocket";

const Layout = ({
  title,
  children,
  onOpenCopilot,
  lowStockItems,
}: {
  title: string;
  children: React.ReactNode;
  onOpenCopilot: () => void;
  lowStockItems: Array<{ name: string; stock: number }>;
}) => (
  <div className="flex min-h-screen bg-[#F8F3EA] text-stone-900">
    <Sidebar onOpenCopilot={onOpenCopilot} />
    <main className="flex-1 min-w-0 bg-[#F8F3EA]">
      <Navbar title={title} onOpenCopilot={onOpenCopilot} lowStockItems={lowStockItems} />
      {children}
    </main>
  </div>
);

function App() {
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<Array<{ name: string; stock: number }>>([]);

  const checkLowStock = async () => {
    try {
      const { data } = await api.get<any[]>("/products");
      const low = data
        .filter((p: any) => p.stock <= 5)
        .map((p: any) => ({ name: p.name, stock: p.stock }));
      setLowStockItems(low);
    } catch {
      // not logged in yet or offline
    }
  };

  useEffect(() => {
    checkLowStock();
  }, []);

  useSocket(() => {
    checkLowStock();
  });

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<PrivateRoute />}>
          <Route
            path="/"
            element={
              <Layout
                title="Store Dashboard"
                onOpenCopilot={() => setIsCopilotOpen(true)}
                lowStockItems={lowStockItems}
              >
                <Dashboard />
              </Layout>
            }
          />
          <Route
            path="/products"
            element={
              <Layout
                title="Product Catalog"
                onOpenCopilot={() => setIsCopilotOpen(true)}
                lowStockItems={lowStockItems}
              >
                <Products />
              </Layout>
            }
          />
          <Route
            path="/inventory"
            element={
              <Layout
                title="Stock & Velocity"
                onOpenCopilot={() => setIsCopilotOpen(true)}
                lowStockItems={lowStockItems}
              >
                <Inventory />
              </Layout>
            }
          />
          <Route
            path="/recommendations"
            element={
              <Layout
                title="Merchandising Recommendations"
                onOpenCopilot={() => setIsCopilotOpen(true)}
                lowStockItems={lowStockItems}
              >
                <Recommendations />
              </Layout>
            }
          />
          <Route
            path="/orders"
            element={
              <Layout
                title="Orders & Sales History"
                onOpenCopilot={() => setIsCopilotOpen(true)}
                lowStockItems={lowStockItems}
              >
                <Orders />
              </Layout>
            }
          />
        </Route>

        <Route element={<PrivateRoute roles={["admin"]} />}>
          <Route
            path="/users"
            element={
              <Layout
                title="User Management"
                onOpenCopilot={() => setIsCopilotOpen(true)}
                lowStockItems={lowStockItems}
              >
                <Users />
              </Layout>
            }
          />
        </Route>
      </Routes>

      {/* Global AI Copilot Floating Drawer */}
      <AICopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </>
  );
}

export default App;
