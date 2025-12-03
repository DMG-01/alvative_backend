import { Sequelize } from "sequelize";
import dotenv from "dotenv";

// Load the correct .env file based on NODE_ENV
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.production" : ".env",
});

// Destructure and validate env variables
const {
  DB_NAME,
  DB_USER,
  DB_PASS,
  DB_HOST,
  DB_PORT = "3306",
} = process.env;

if (!DB_NAME || !DB_USER || !DB_PASS || !DB_HOST) {
  throw new Error("❌ Missing required database environment variables");
}

// Initialize Sequelize instance
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: "mysql",
  logging: process.env.NODE_ENV === "development",
  pool: {
    max: 20,
    min: 0,
    acquire: 100000,
    idle: 10000,
  },
});

export default sequelize;
