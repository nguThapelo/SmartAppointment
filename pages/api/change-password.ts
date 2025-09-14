import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Dummy change password API endpoint.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const { email, password, newPassword } = req.body;
  if (email === "user@example.com" && password === "password123" && newPassword) {
    return res.status(200).json({ success: true, message: "Password changed successfully" });
  } else {
    return res.status(401).json({ success: false, message: "Invalid credentials or missing new password" });
  }
}