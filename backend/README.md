# Photo to World3D - Backend

This is the NestJS backend service for the Photo to World3D application. It handles API requests from the Next.js frontend, communicates with the PostgreSQL database via Prisma, and delegates AI processing tasks to the Python worker model.

## Features
- **NestJS** for robust API architecture.
- **Prisma** for database ORM.
- **PostgreSQL** database integration.
- Integration with Python-based AI models for image stitching and point cloud generation.

## Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database

## Environment Variables
Create a .env file in the ackend/ directory with the following configuration:

`env
# Database connection string (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"

# The host and port for this backend
PORT=3001
HOST="0.0.0.0"

# Python AI Worker API URL (where the FastAPI runs)
AI_WORKER_URL="http://127.0.0.1:8000"
`

## Installation

`ash
npm install
`

## Database Setup (Prisma)

Sync your database schema and run the seed script:

`ash
# Push the schema to the database (creates tables)
npx prisma db push

# (Optional) Seed the database with initial dummy/testing data
npx prisma db seed
`

## Running the App

`ash
# development mode
npm run start

# watch mode (recommended for local dev)
npm run start:dev

# production mode
npm run start:prod
`

## Production Build

To build the application for deployment:

`ash
npm run build
`
This will compile the TypeScript code into the dist/ directory.
