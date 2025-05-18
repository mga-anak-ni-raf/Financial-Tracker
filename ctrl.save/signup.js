require("dotenv").config();
const express = require("express");
const pg = require("pg");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
app.use(express.json()); // Middleware to parse JSON requests
app.use(cors()); // Enable CORS

// PostgreSQL Connection
const db = new pg.Pool({
    user: "postgres",
    host: "localhost",
    database: "user_database", // Change this to your actual PostgreSQL database name
    password: "your_password", // Change this to your actual password
    port: 5432
});

// Signup Route
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required!" });
    }

    try {
        // Check if username exists
        const userExists = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: "Username already exists!" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into database
        await db.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [username, hashedPassword]);

        res.status(201).json({ message: "Registration successful!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start the server
app.listen(5000, () => console.log("Server running on port 5000"));
