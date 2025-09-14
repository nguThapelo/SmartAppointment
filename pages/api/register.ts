import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Dummy register API endpoint.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const { email, password } = req.body;
  if (email && password) {
    return res.status(200).json({ success: true, message: "Registration successful" });
  } else {
    return res.status(400).json({ success: false, message: "Email and password required" });
  }
}