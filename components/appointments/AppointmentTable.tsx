import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Toolbar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AppointmentForm from "./AppointmentForm";
import { mockAppointments } from "./mockAppointments";
import DynamicTable, { TableColumn } from "../general/DynamicTable";
import dayjs from "dayjs";

/**
 * Columns definition for the dynamic table.
 * You can change or extend these columns as needed.
 */
const columns: TableColumn[] = [
  { field: "type", headerName: "Type" },
  { field: "date", headerName: "Date", format: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm") },
  { field: "email", headerName: "Email" },
  { field: "notes", headerName: "Notes" },
];

const AppointmentTable: React.FC = () => {
  const [appointments, setAppointments] = useState(mockAppointments);
  const [open, setOpen] = useState(false);

  // Add new appointment to the table
  const handleAdd = (values: any) => {
    setAppointments([
      ...appointments,
      { ...values, id: appointments.length + 1 },
    ]);
    setOpen(false);
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 900, mx: "auto", mt: 4 }}>
      <Paper elevation={24} sx={{ borderRadius: 3, mb: 4 }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between", background: "#f5f5f5", borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", color: "#0077c2" }}>
            Appointments
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Add Appointment
          </Button>
        </Toolbar>
        <TableContainer>
          <DynamicTable columns={columns} data={appointments} />
        </TableContainer>
      </Paper>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Appointment</DialogTitle>
        <DialogContent>
          <AppointmentForm onSubmit={handleAdd} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="secondary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AppointmentTable;