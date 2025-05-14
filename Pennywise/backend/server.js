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
  connectionString: "postgresql://neondb_owner:npg_l1NJj4eSpGHI@ep-royal-hall-a1z9u95d-pooler.ap-southeast-1.aws.neon.tech:5432/neondb",
  ssl: { rejectUnauthorized: false } // Required for Neon.tech
});

// Test database connection
db.connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.error("Database connection error:", err));

// Middleware
app.use(express.static("public")); // For serving CSS and other static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
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
    return res.redirect("/index");
  }
  next();
};

// Routes

// Homepage
app.get("/homepage", requireLogin, (req, res) => {
  res.render("homepage", { username: req.session.username });
});

// Wallet page
app.get("/wallet", requireLogin, (req, res) => {
  res.render("wallet");
});

// Stats page
app.get("/stats", requireLogin, (req, res) => {
  res.render("stats");
});

// About Us page
app.get("/aboutus", requireLogin, (req, res) => {
  res.render("aboutus");
});

// Calendar page (Protected)
app.get("/calendar", requireLogin, (req, res) => {
  res.render("calendar", { username: req.session.username });
});

// Login & Signup Page
app.get("/index", (req, res) => {
  res.render("index");
});

// Redirect root to login page
app.get("/", (req, res) => {
  res.redirect("/index");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/index");
  });
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

  const newUser = await db.query("SELECT id FROM users WHERE username = $1", [username]);
req.session.username = username;
req.session.userId = newUser.rows[0].id; // ✅ Store userId
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
    req.session.userId = user.id; // ✅ Store userId from DB
    // ✅ Send JSON instead of redirecting
    res.json({ success: true, redirect: "/homepage" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// **Budget Routes**
app.route("/api/budget")
  // GET: Fetch user's budget
  .get((req, res) => {
    const username = req.session.username;

    if (!username) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const query = `
      SELECT monthly_budget, weekly_budget, daily_budget 
      FROM budgets 
      WHERE username = $1
    `;

    db.query(query, [username])
      .then(result => {
        if (result.rows.length === 0) {
          return res.status(404).json({ message: "No budget found." });
        }

        res.json(result.rows[0]);
      })
      .catch(err => {
        console.error("Error fetching budget:", err);
        res.status(500).json({ message: "Error fetching budget." });
      });
  })

  // POST: Save or update user's budget
  .post((req, res) => {
    const { monthlyBudget, weeklyBudget, dailyBudget } = req.body;
    const username = req.session.username;

    if (!username || !monthlyBudget || !weeklyBudget || !dailyBudget) {
      return res.status(400).json({ message: "Missing data." });
    }

    const query = `
      INSERT INTO budgets (username, monthly_budget, weekly_budget, daily_budget)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) 
      DO UPDATE SET monthly_budget = $2, weekly_budget = $3, daily_budget = $4
    `;

    db.query(query, [username, monthlyBudget, weeklyBudget, dailyBudget])
      .then(() => {
        res.json({ success: true, message: "Budget saved successfully." });
      })
      .catch((err) => {
        console.error("Error saving budget:", err);
        res.status(500).json({ message: "Error saving budget." });
      });
  });

// **Transaction Routes**
app.route("/api/transaction")
  // GET: Fetch user's transactions
  .get((req, res) => {
    const username = req.session.username;

    if (!username) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const query = `
      SELECT id, name, cost, description, date_time
      FROM transactions
      WHERE username = $1
      ORDER BY date_time DESC
    `;

    db.query(query, [username])
      .then(result => {
        res.json({ success: true, transactions: result.rows });
      })
      .catch(err => {
        console.error("Error fetching transactions:", err);
        res.status(500).json({ message: "Error fetching transactions." });
      });
  })

  // POST: Add a new transaction
  .post((req, res) => {
    const { name, cost, description, dateTime } = req.body;
    const username = req.session.username;

    if (!username || !name || !cost || !description || !dateTime) {
      return res.status(400).json({ message: "Missing transaction data." });
    }

    const query = `
      INSERT INTO transactions (username, name, cost, description, date_time)
      VALUES ($1, $2, $3, $4, $5)
    `;

    db.query(query, [username, name, cost, description, dateTime])
      .then(() => {
        res.json({ success: true, message: "Transaction added successfully." });
      })
      .catch(err => {
        console.error("Error saving transaction:", err);
        res.status(500).json({ message: "Error saving transaction." });
      });
  });


  // **Debt Route**
  app.post("/api/debt", async (req, res) => {
    const { name, amount, interest, dueDate } = req.body;
    const username = req.session.username;

    if (!username || !name || !amount || !interest || !dueDate) {
      return res.status(400).json({ message: "Missing debt data." });
    }

    try {
      // Fetch the user_id from the username
      const result = await db.query("SELECT id FROM users WHERE username = $1", [username]);
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "User not found." });
      }

      const userId = result.rows[0].id;

      // Insert into debts
      const insertQuery = `
        INSERT INTO debts (user_id, name, amount, interest_rate, due_date)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await db.query(insertQuery, [userId, name, amount, interest, dueDate]);

      res.json({ success: true, message: "Debt added successfully." });
    } catch (err) {
      console.error("Error saving debt:", err);
      res.status(500).json({ message: "Error saving debt." });
    }
  });

  // GET /api/debt - Fetch all debts for logged-in user
  app.get("/api/debt", (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const query = `
      SELECT debt_id, name, amount, interest_rate AS interest, due_date
      FROM debts
      WHERE user_id = $1
      ORDER BY due_date ASC
    `;

    db.query(query, [userId])
      .then(result => {
        res.json({ success: true, debts: result.rows });
      })
      .catch(err => {
        console.error("Error fetching debts:", err);
        res.status(500).json({ message: "Error fetching debts." });
      });
  });

//SAVINGS route

// GET: Fetch user's savings
app.get("/api/savings", async (req, res) => {
  const userId = req.session.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await db.query(
      "SELECT goal_amount, saved_amount, last_contribution FROM savings WHERE user_id = $1",
      [userId]
    );
    
    if (result.rows.length > 0) {
      res.json({ 
        success: true, 
        savings: {
          goal: result.rows[0].goal_amount,
          saved: result.rows[0].saved_amount,
          contribution: result.rows[0].last_contribution
        }
      });
    } else {
      res.json({ 
        success: true, 
        savings: { 
          goal: 0, 
          saved: 0,
          contribution: 0 
        } 
      });
    }
  } catch (err) {
    console.error('Error fetching savings:', err);
    res.status(500).json({ success: false, message: "Error fetching savings." });
  }
});

// POST: Save or update user's savings
app.post("/api/savings", async (req, res) => {
  const userId = req.session.userId;
  const { goalAmount, contribution } = req.body;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!goalAmount || !contribution) {
    return res.status(400).json({ message: "Missing savings data." });
  }

  try {
    // Check if savings record exists for this user
    const existing = await db.query(
      "SELECT * FROM savings WHERE user_id = $1",
      [userId]
    );

    const now = new Date();

    if (existing.rows.length > 0) {
      // Update existing record
      await db.query(
        `UPDATE savings 
         SET goal_amount = $1, 
             saved_amount = saved_amount + $2,
             last_contribution = $2,
             updated_at = $3
         WHERE user_id = $4`,
        [goalAmount, contribution, now, userId]
      );
    } else {
      // Insert new record
      await db.query(
        `INSERT INTO savings 
         (user_id, goal_amount, saved_amount, last_contribution, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, goalAmount, contribution, contribution, now]
      );
    }

    res.json({ success: true, message: "Savings updated successfully." });
  } catch (err) {
    console.error('Error saving savings data:', err);
    res.status(500).json({ success: false, message: "Error saving savings data." });
  }
});

  
//STATS route
// This route fetches the user's budget, total spent, savings goal, and total debt

app.get("/api/stats", async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Fetch all necessary data in parallel
    const [budgetRes, transactionRes, savingsRes, debtRes] = await Promise.all([
      db.query("SELECT monthly_budget FROM budgets WHERE user_id = $1", [userId]),
      db.query("SELECT SUM(cost) AS total_spent FROM transactions WHERE user_id = $1", [userId]),
      db.query("SELECT goal_amount, saved_amount, last_contribution FROM savings WHERE user_id = $1", [userId]),
      db.query("SELECT SUM(amount) AS total_debt FROM debts WHERE user_id = $1", [userId]),
    ]);

    // Get the monthly budget or default to 0
    const monthlyBudget = budgetRes.rows[0]?.monthly_budget || 0;
    
    // Get total spent or default to 0
    const totalSpent = parseFloat(transactionRes.rows[0]?.total_spent || 0);
    
    // Get savings data or default to 0
    const savingsGoal = parseFloat(savingsRes.rows[0]?.goal_amount || 0);
    const savedAmount = parseFloat(savingsRes.rows[0]?.saved_amount || 0);
    const savingsContribution = parseFloat(savingsRes.rows[0]?.last_contribution || 0);
    
    // Get total debt or default to 0
    const totalDebt = parseFloat(debtRes.rows[0]?.total_debt || 0);
    
    // Calculate remaining budget
    const remainingBudget = Math.max(0, monthlyBudget - totalSpent - savingsContribution - totalDebt);

    res.json({
      success: true,
      data: {
        monthlyBudget,
        totalSpent,
        savingsGoal,
        savedAmount,
        savingsContribution,
        totalDebt,
        remainingBudget
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Error fetching stats." });
  }
});
// 🆕 Monthly Expenses Data for Chart
app.get("/api/stats/expenses", async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await db.query(`
      SELECT 
        TO_CHAR(date_time, 'Mon YYYY') AS month,
        SUM(cost)::float AS total
      FROM transactions
      WHERE "user" = $1
      GROUP BY month, DATE_TRUNC('month', date_time)
      ORDER BY DATE_TRUNC('month', date_time)
    `, [userId]);

    res.json({ success: true, expenses: result.rows });
  } catch (error) {
    console.error("Error fetching monthly expenses:", error);
    res.status(500).json({ message: "Error fetching expenses." });
  }
});

// **Start Server**
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
