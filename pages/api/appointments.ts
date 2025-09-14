import type { NextApiRequest, NextApiResponse } from "next";
import { mockAppointments } from "../../components/appointments/mockAppointments";

let appointments = [...mockAppointments];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json(appointments);
  }
  if (req.method === "POST") {
    const { type, date, email, notes } = req.body;
    const newAppointment = {
      id: appointments.length + 1,
      type,
      date,
      email,
      notes,
    };
    appointments.push(newAppointment);
    return res.status(201).json(newAppointment);
  }
  res.status(405).json({ message: "Method Not Allowed" });
}