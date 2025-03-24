require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const pg = require("pg");
const bcrypt = require("bcryptjs");

const app = express();
const port = 5000;

// PostgreSQL setup
const db = new pg.Pool({
    user: "postgres", // Change this to your PostgreSQL user
    host: "localhost",
    database: "financial_tracker", // Change to your actual database name
    password: "newpassword", // Change to your actual database password
    port: 5432,
  });

// Test database connection
db.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.error("Database connection error:", err));


// Middleware
app.use(express.static("public")); // For serving CSS and other static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: "your_secret_key", // Change this to a strong secret key
    resave: false,
    saveUninitialized: true,
  })
);

// Serve EJS templates
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Authentication middleware
const requireLogin = (req, res, next) => {
  if (!req.session.username) {
    return res.redirect("/login");
  }
  next();
};

// Routes

// Homepage
app.get("/homepage", requireLogin, (req, res) => {
  res.render("homepage", { username: req.session.username });
});

// Login Page
app.get("/login", (req, res) => {
  res.render("login");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Calendar Page (Protected)
app.get("/calendar", requireLogin, (req, res) => {
  res.render("calendar", { username: req.session.username });
});

// Signup Page
app.get("/signup", (req, res) => {
  res.render("signup");
});

// Redirect root to login page
app.get("/", (req, res) => {
  res.redirect("/login");
});

// **Signup Route**
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  try {
    // Check if username exists
    const userExists = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "Username already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    await db.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [username, hashedPassword]);

    // Log in user after successful signup
    req.session.username = username;

    // ✅ Send JSON instead of redirecting
    res.json({ success: true, redirect: "/homepage" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error during signup." });
  }
});

// **Login Route**
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  try {
    // Get user from database
    const userResult = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid username or password." });
    }

    const user = userResult.rows[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password." });
    }

    // Store session data
    req.session.username = user.username;


     // ✅ Send JSON instead of redirecting
     res.json({ success: true, redirect: "/homepage" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// **Start Server**
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
