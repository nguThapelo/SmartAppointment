import React from "react";
import DynamicForm, { DynamicField } from "../general/DynamicForm";
import * as Yup from "yup";
import { FaEnvelope, FaRegStickyNote } from "react-icons/fa";
import dayjs from "dayjs";

const appointmentTypes = ["Consultation", "Follow-up", "Review"];

const fields: DynamicField[] = [
  { name: "type", label: "Appointment Type", type: "select", options: appointmentTypes },
  { name: "date", label: "Date of Appointment", type: "date" },
  { name: "email", label: "Email Address", type: "email", icon: <FaEnvelope size={18} color="#666" /> },
  { name: "notes", label: "Notes", type: "textarea", icon: <FaRegStickyNote size={18} color="#666" />, multiline: true, rows: 3 },
];

const validationSchema = Yup.object({
  type: Yup.string().required("Required"),
  date: Yup.string().required("Required"),
  email: Yup.string().email("Invalid email").required("Required"),
  notes: Yup.string(),
});

const initialValues = {
  type: "",
  date: "",
  email: "",
  notes: "",
};

interface AppointmentFormProps {
  onSubmit: (values: any) => void;
  loading?: boolean;
}

const AppointmentForm: React.FC<AppointmentFormProps> = ({ onSubmit, loading }) => (
  <DynamicForm
    fields={fields}
    initialValues={initialValues}
    validationSchema={validationSchema}
    onSubmit={values => {
      values.date = dayjs(values.date).format("YYYY-MM-DD HH:mm");
      onSubmit(values);
    }}
    submitLabel="Create Appointment"
    loading={loading}
  />
);

export default AppointmentForm;