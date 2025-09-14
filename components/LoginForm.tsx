import React, { useState } from "react";
import { Box, Paper, Typography, Divider, Stack } from "@mui/material";
import DynamicForm, { DynamicField } from "./general/DynamicForm";
import * as Yup from "yup";
import { FaUser, FaKey, FaEnvelope } from "react-icons/fa";
import { useRouter } from "next/router";

const loginFields: DynamicField[] = [
  { name: "email", label: "Email", type: "email", icon: <FaEnvelope size={18} color="#666" /> },
  { name: "password", label: "Password", type: "password", icon: <FaKey size={18} color="#666" />, showPasswordToggle: true },
];

const registerFields: DynamicField[] = [
  { name: "username", label: "Username", type: "text", icon: <FaUser size={18} color="#666" /> },
  { name: "email", label: "Email", type: "email", icon: <FaEnvelope size={18} color="#666" /> },
  { name: "password", label: "Password", type: "password", icon: <FaKey size={18} color="#666" />, showPasswordToggle: true },
];

const changePasswordFields: DynamicField[] = [
  { name: "email", label: "Email", type: "email", icon: <FaEnvelope size={18} color="#666" /> },
  { name: "password", label: "Current Password", type: "password", icon: <FaKey size={18} color="#666" />, showPasswordToggle: true },
  { name: "newPassword", label: "New Password", type: "password", icon: <FaKey size={18} color="#666" />, showPasswordToggle: true },
];

const loginSchema = Yup.object({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
});
const registerSchema = Yup.object({
  username: Yup.string().min(3, "At least 3 characters").required("Required"),
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().min(6, "At least 6 characters").required("Required"),
});
const changePasswordSchema = Yup.object({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().required("Required"),
  newPassword: Yup.string().min(6, "At least 6 characters").required("Required"),
});

const LoginForm: React.FC = () => {
  const [mode, setMode] = useState<"login" | "register" | "changePassword">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async (values: Record<string, any>) => {
    setMessage("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (mode === "login") {
        router.push("/appointments");
      } else {
        setMessage(mode === "register" ? "Registration successful!" : "Password changed successfully!");
      }
    }, 1000);
  };

  let fields: DynamicField[] = loginFields;
  let initialValues: Record<string, any> = { email: "", password: "" };
  let validationSchema = loginSchema;
  let submitLabel = "Login";

  if (mode === "register") {
    fields = registerFields;
    initialValues = { username: "", email: "", password: "" };
    validationSchema = registerSchema;
    submitLabel = "Register";
  } else if (mode === "changePassword") {
    fields = changePasswordFields;
    initialValues = { email: "", password: "", newPassword: "" };
    validationSchema = changePasswordSchema;
    submitLabel = "Change Password";
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, background: 'background.default' }}>
      <Paper elevation={24} sx={{ p: 4, width: { xs: 350, sm: 420 }, borderRadius: 3, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0077c2' }}>
            {mode === "login" ? "Login" : mode === "register" ? "Register" : "Change Password"}
          </Typography>
        </Box>
        <Divider sx={{ mb: 3, backgroundColor: '#00B9B9' }} />
        <DynamicForm
          fields={fields}
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
          submitLabel={submitLabel}
          loading={loading}
        />
        <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ mt: 3 }}>
          {mode !== "login" && (
            <Typography variant="button" sx={{ color: '#00B9B9', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => { setMode("login"); setMessage(""); }}>
              Login
            </Typography>
          )}
          {mode !== "register" && (
            <Typography variant="button" sx={{ color: '#00B9B9', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => { setMode("register"); setMessage(""); }}>
              Register
            </Typography>
          )}
          {mode !== "changePassword" && (
            <Typography variant="button" sx={{ color: '#00B9B9', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => { setMode("changePassword"); setMessage(""); }}>
              Change Password
            </Typography>
          )}
        </Stack>
        {message && (
          <Typography variant="body2" color="success" align="center" sx={{ mt: 3 }}>
            {message}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default LoginForm;