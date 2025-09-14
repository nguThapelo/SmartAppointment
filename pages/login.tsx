import React from "react";
import LoginForm from "../components/LoginForm";

/**
 * Login page renders the LoginForm component centered on the screen.
 */
const LoginPage: React.FC = () => (
  <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <LoginForm />
  </div>
);

export default LoginPage;