/**
 * GraphQL resolvers for authentication.
 */
export const resolvers = {
  Query: {
    hello: () => "Hello from GraphQL!",
  },
  Mutation: {
    login: (_: any, { email, password }: any) => {
      if (email === "user@example.com" && password === "password123") {
        return { success: true, message: "Login successful" };
      }
      return { success: false, message: "Invalid credentials" };
    },
    register: (_: any, { email, password }: any) => {
      if (email && password) {
        return { success: true, message: "Registration successful" };
      }
      return { success: false, message: "Email and password required" };
    },
    changePassword: (_: any, { email, password, newPassword }: any) => {
      if (email === "user@example.com" && password === "password123" && newPassword) {
        return { success: true, message: "Password changed successfully" };
      }
      return { success: false, message: "Invalid credentials or missing new password" };
    },
  },
};