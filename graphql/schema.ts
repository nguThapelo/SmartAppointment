import { gql } from "apollo-server-micro";

/**
 * GraphQL schema for authentication and appointments.
 */
export const typeDefs = gql`
  type Appointment {
    id: ID!
    type: String!
    date: String!
    email: String!
    notes: String
  }

  type Query {
    hello: String!
    appointments: [Appointment!]!
  }

  type Mutation {
    login(email: String!, password: String!): AuthResponse!
    register(username: String!, email: String!, password: String!): AuthResponse!
    changePassword(email: String!, password: String!, newPassword: String!): AuthResponse!
    createAppointment(
      type: String!
      date: String!
      email: String!
      notes: String
    ): Appointment!
  }

  type AuthResponse {
    success: Boolean!
    message: String!
  }
`;