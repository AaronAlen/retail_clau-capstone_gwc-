import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
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
import {
  LuLayoutDashboard as LayoutDashboard,
  LuShoppingBag as ShoppingBag,
  LuBoxes as Boxes,
  LuSparkles as Sparkles,
  LuBot as Bot,
} from "react-icons/lu";

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
}) => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer and scroll to top on route change
  useEffect(() => {
    setIsMobileNavOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[#F8F3EA] text-stone-900">
      {/* Sidebar with Desktop Sticky & Mobile/Tablet Drawer support */}
      <Sidebar
        onOpenCopilot={onOpenCopilot}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-[#F8F3EA] flex flex-col pb-20 lg:pb-6">
        <Navbar
          title={title}
          onOpenCopilot={onOpenCopilot}
          lowStockItems={lowStockItems}
          onToggleSidebar={() => setIsMobileNavOpen((prev) => !prev)}
        />
        <div className="flex-1">{children}</div>
      </main>

      {/* 📱 Mobile Quick Bottom Navigation Bar (< lg screens) */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#F8F3EA]/95 backdrop-blur-md border-t border-[#E5D7BE] py-1.5 px-3 z-30 lg:hidden flex items-center justify-around shadow-2xl">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive
                ? "text-orange-600 bg-orange-500/10 font-extrabold"
                : "text-stone-600 hover:text-stone-900"
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive
                ? "text-orange-600 bg-orange-500/10 font-extrabold"
                : "text-stone-600 hover:text-stone-900"
            }`
          }
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Products</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive
                ? "text-orange-600 bg-orange-500/10 font-extrabold"
                : "text-stone-600 hover:text-stone-900"
            }`
          }
        >
          <Boxes className="w-4 h-4" />
          <span>Stock</span>
        </NavLink>

        <NavLink
          to="/recommendations"
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
              isActive
                ? "text-orange-600 bg-orange-500/10 font-extrabold"
                : "text-stone-600 hover:text-stone-900"
            }`
          }
        >
          <Sparkles className="w-4 h-4" />
          <span>Synergy</span>
        </NavLink>

        <button
          onClick={onOpenCopilot}
          className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[10px] font-bold text-orange-600 hover:bg-orange-500/10 transition-all cursor-pointer"
        >
          <Bot className="w-4 h-4 text-orange-600" />
          <span>AI Copilot</span>
        </button>
      </nav>
    </div>
  );
};

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
