# WOW Backend

A Node.js backend service built with Express and Sequelize.

## Features

- User authentication (register, login, refresh token, logout)
- Password reset via email
- Role-based access control
- Request validation
- Rate limiting
- Logging
- Environment configuration
- Database migrations and seeds

## Prerequisites

- Node.js 16+
- MySQL 8.0+
- npm or yarn

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and update the values
4. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server with hot-reload
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## API Documentation

API documentation is available at `/api-docs` when running in development mode.

## License

MIT
