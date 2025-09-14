import React from "react";
import Link from "next/link";
import { Box, Typography, Button } from "@mui/material";
import Layout from "../layout/layout";

/**
 * Home page with a welcome message and link to login.
 * Wrapped in Layout, which includes the Navbar.
 */
const HomePage: React.FC = () => (
  <Layout>
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "background.default",
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: "bold", mb: 3 }}>
        Welcome to SmartAppointment!
      </Typography>
      <Typography variant="h6" sx={{ mb: 4 }}>
        Your smart way to manage appointments.
      </Typography>
      <Link href="/login" passHref>
        <Button variant="contained" color="primary" sx={{ px: 4, py: 1 }}>
          Go to Login
        </Button>
      </Link>
    </Box>
  </Layout>
);

export default HomePage;