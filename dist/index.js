import express, {} from "express";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import cors from "cors";
// Load environment variables from .env
dotenv.config();
// Initialize Prisma Client
const prisma = new PrismaClient();
const app = express();
// Middleware to parse JSON
app.use(cors({
    origin: "http://localhost:5173", // your frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
}));
app.use(express.json());
// ----------------------
// Routes
// ----------------------
// Test route to check if server and DB work
app.get("/", async (req, res) => {
    res.send("Server is running!");
});
// Get all users
app.get("/users", async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});
// Create a new user
app.post("/users", async (req, res) => {
    const { name, email } = req.body;
    try {
        const user = await prisma.user.create({
            data: { name, email }
        });
        res.json(user);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create user" });
    }
});
// Get user by ID
app.get("/users/:email", async (req, res) => {
    const { email } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        res.json(user);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});
// Update user
app.put("/users/:id", async (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    try {
        const user = await prisma.user.update({
            where: { id },
            data: { name, email },
        });
        res.json(user);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update user" });
    }
});
// Delete user
app.delete("/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.delete({
            where: { id },
        });
        res.json(user);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});
app.post("/initialize", async (req, res) => {
    const { email, amountToCharge } = req.body;
    if (!email) {
        return res.status(400).json({ msg: "User email is required" });
    }
    if (!amountToCharge || amountToCharge <= 0) {
        return res.status(400).json({ msg: "amountToCharge must be a positive number" });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(404).json({ msg: `No user with email ${email} found` });
        // If user has already initialized a transaction, attempt verification first
        if (user.hasInitialized && user.paystackReferenceCode) {
            console.log("User has initialized before, verifying transaction...");
            try {
                const verifyResponse = await axios.get(`https://api.paystack.co/transaction/verify/${user.paystackReferenceCode}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.PAYSTACK_PRIVATE_KEY}`
                    }
                });
                if (verifyResponse.status === 200 &&
                    verifyResponse.data.status &&
                    verifyResponse.data.data.status === "success") {
                    const authorizationCode = verifyResponse.data.data.authorization?.authorization_code;
                    if (authorizationCode && !user.paystackAuthorizationCode) {
                        await prisma.user.update({
                            where: { id: user.id },
                            data: { paystackAuthorizationCode: authorizationCode }
                        });
                    }
                    return res.status(200).json({
                        msg: "Transaction already initialized and verified",
                        data: verifyResponse.data
                    });
                }
                else {
                    console.log("Previous transaction not successful, proceeding to initialize a new one");
                }
            }
            catch (verifyError) {
                console.log("Error verifying previous transaction, initializing new transaction", verifyError.message);
            }
        }
        // Initialize a new transaction
        const initResponse = await axios.post("https://api.paystack.co/transaction/initialize", {
            email: user.email,
            amount: amountToCharge * 100
        }, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_PRIVATE_KEY}`,
                "Content-Type": "application/json"
            }
        });
        const paystackReference = initResponse.data.data.reference;
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { paystackReferenceCode: paystackReference, hasInitialized: true }
        });
        return res.status(200).json({
            msg: "Transaction initialized successfully",
            data: initResponse.data,
            user: updatedUser
        });
    }
    catch (error) {
        console.error("Error initializing transaction:", error.message);
        return res.status(500).json({ msg: error.message });
    }
});
app.post("/chargeAuthorization", async (req, res) => {
    const email = req.query.email;
    const { amount } = req.body;
    if (!email)
        return res.status(400).json({ msg: "Email is required" });
    if (!amount || amount <= 0)
        return res.status(400).json({ msg: "Amount must be a positive number" });
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(404).json({ msg: `No user with email ${email} found` });
        const authorizationCode = user.paystackAuthorizationCode;
        if (!authorizationCode)
            return res.status(400).json({ msg: "No authorization code found. Initialize transaction first." });
        const response = await axios.post("https://api.paystack.co/transaction/charge_authorization", {
            email: user.email,
            amount: amount * 100,
            authorization_code: authorizationCode
        }, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_PRIVATE_KEY}`,
                "Content-Type": "application/json"
            }
        });
        return res.status(200).json({
            msg: "Charge successful",
            data: response.data
        });
    }
    catch (error) {
        return res.status(500).json({ msg: error.message });
    }
});
// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
