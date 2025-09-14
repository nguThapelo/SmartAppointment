SmartAppointment
SmartAppointment is a full-stack application built with Next.js, React, Express, and Apollo Server Micro for managing authentication and appointments. It uses Material UI for styling, Formik for forms, and integrates GraphQL for API queries and mutations.

Features
User authentication: login, registration, password change

Appointment creation and retrieval through GraphQL API

Responsive and modern UI with Material UI and Tailwind CSS

TypeScript support for type safety

Testing setup with Jest and React Testing Library

Installation
Clone the repository:

bash
git clone https://github.com/nguThapelo/SmartAppointment.git
cd SmartAppointment
Install dependencies:

bash
npm install
Available Scripts
npm run dev
Runs the development server using ts-node on server.ts.

npm run build
Builds the Next.js app for production.

npm start
Starts the production server from server.js.

npm test
Runs tests using Jest.

Technologies Used
Next.js

React

Apollo Server Micro & GraphQL

Express

Material UI (MUI)

Tailwind CSS

TypeScript

Formik & Yup

Jest & React Testing Library

Project Structure
server.ts — Express + Apollo Server Micro backend entry point

pages/ — Next.js frontend pages

components/ — React UI components

GraphQL schema and resolvers defining authentication and appointments

Contributing
Feel free to open issues or submit pull requests to improve the application.

License
ISC