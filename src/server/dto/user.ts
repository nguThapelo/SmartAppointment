import type { Role } from "@prisma/client";

// What the API returns about a user. Never includes passwordHash,
// sessionVersion or other internals.

export interface UserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  timezone: string;
}

export function toUserDTO(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: Role;
  timezone: string;
}): UserDTO {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone ?? null,
    role: u.role,
    timezone: u.timezone,
  };
}
