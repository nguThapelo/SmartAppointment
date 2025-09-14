import React from "react";
import Navbar from "../components/navbar/Navbar";

interface LayoutProps {
  children: React.ReactNode;
  email?: string;
  onLogout?: () => void;
}

const menuItems = [
  { label: "Home", href: "/" },
  { label: "Login", href: "/login" },
  { label: "Appointments", href: "/appointments" },
  // Add more pages as needed
];

const Layout: React.FC<LayoutProps> = ({ children, email, onLogout }) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <Navbar email={email} onLogout={onLogout} menuItems={menuItems} />
    <main style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column" }}>
      {children}
    </main>
  </div>
);

export default Layout;