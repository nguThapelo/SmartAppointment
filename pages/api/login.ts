// filepath: [login.ts](http://_vscodecontentref_/7)
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Dummy login API endpoint.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const { email, password } = req.body;
  if (email === "user@example.com" && password === "password123") {
    return res.status(200).json({ success: true, message: "Login successful" });
  } else {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }
}