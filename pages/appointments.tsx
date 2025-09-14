import React from "react";
import AppointmentTable from "../components/appointments/AppointmentTable";
import Layout from "../layout/layout";

/**
 * Appointments page wrapped with Navbar/Layout.
 */
const AppointmentsPage: React.FC = () => (
  <Layout>
    <AppointmentTable />
  </Layout>
);

export default AppointmentsPage;