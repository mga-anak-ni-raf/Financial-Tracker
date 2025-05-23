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
    const newUserResult = await db.query("INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id", [username, hashedPassword]);

    // Log in user after successful signup
    req.session.username = username;
    req.session.userId = newUserResult.rows[0].id; // Store userId

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
    req.session.userId = user.id; // Store userId from DB
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


// **Debt Routes**
app.post("/api/debt", async (req, res) => {
  const { name, amount, interest, dueDate } = req.body;
  const username = req.session.username; // Using username to fetch userId, as suggested in previous review

  if (!username || !name || !amount || !interest || !dueDate) {
    return res.status(400).json({ message: "Missing debt data." });
  }

  try {
    // Fetch the user_id from the username
    const userResult = await db.query("SELECT id FROM users WHERE username = $1", [username]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: "User not found." });
    }

    const userId = userResult.rows[0].id;

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

// NEW: DELETE /api/debt/:id - Delete a specific debt
app.delete("/api/debt/:id", async (req, res) => {
  const debtId = req.params.id;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!debtId) {
    return res.status(400).json({ success: false, message: "Debt ID is required." });
  }

  try {
    // First, verify that the debt belongs to the logged-in user
    const checkOwnershipQuery = `
      SELECT user_id FROM debts WHERE debt_id = $1
    `;
    const checkResult = await db.query(checkOwnershipQuery, [debtId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Debt not found." });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this debt." });
    }

    // If ownership is verified, proceed with deletion
    const deleteQuery = `
      DELETE FROM debts WHERE debt_id = $1 AND user_id = $2
    `;
    const deleteResult = await db.query(deleteQuery, [debtId, userId]);

    if (deleteResult.rowCount === 0) {
      // This case should ideally not be reached if ownership check passed
      return res.status(404).json({ success: false, message: "Debt not found or already deleted." });
    }

    res.json({ success: true, message: "Debt deleted successfully." });

  } catch (err) {
    console.error("Error deleting debt:", err);
    res.status(500).json({ success: false, message: "Error deleting debt." });
  }
});


//SAVINGS route

// SERVER SIDE: Fix the savings routes

// GET: Fetch user's savings
app.get("/api/savings", async (req, res) => {
  // First try userId from session, then fall back to finding by username if needed
  const userId = req.session.userId;
  const username = req.session.username;

  if (!userId && !username) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    let result;

    // If we have userId, use it directly
    if (userId) {
      result = await db.query(
        "SELECT goal_amount, saved_amount, last_contribution FROM savings WHERE user_id = $1",
        [userId]
      );
    }
    // Otherwise look up the user_id from username
    else if (username) {
      const userResult = await db.query("SELECT id FROM users WHERE username = $1", [username]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        result = await db.query(
          "SELECT goal_amount, saved_amount, last_contribution FROM savings WHERE user_id = $1",
          [userId]
        );
      } else {
        return res.status(404).json({ success: false, message: "User not found" });
      }
    }

    if (result && result.rows.length > 0) {
      res.json({
        success: true,
        savings: {
          goal: parseFloat(result.rows[0].goal_amount) || 0,
          saved: parseFloat(result.rows[0].saved_amount) || 0,
          contribution: parseFloat(result.rows[0].last_contribution) || 0
        }
      });
    } else {
      res.json({
        success: true,
        savings: { goal: 0, saved: 0, contribution: 0 }
      });
    }
  } catch (err) {
    console.error('Error fetching savings:', err);
    res.status(500).json({ success: false, message: "Error fetching savings." });
  }
});

// POST: Save or update user's savings
app.post("/api/savings", async (req, res) => {
  // Debugging: Log the entire request body
  console.log("Savings POST body:", req.body);

  const userId = req.session.userId;
  const username = req.session.username;
  const { goalAmount, contribution } = req.body;

  if (!userId && !username) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (goalAmount === undefined || contribution === undefined) {
    return res.status(400).json({
      success: false,
      message: "Missing savings data. Required: goalAmount and contribution.",
      received: req.body
    });
  }

  try {
    let actualUserId = userId;

    // If userId is not in session, get it from username
    if (!actualUserId && username) {
      const userResult = await db.query("SELECT id FROM users WHERE username = $1", [username]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      actualUserId = userResult.rows[0].id;

      // Update the session with the userId
      req.session.userId = actualUserId;
    }

    // Check if savings record exists for this user
    const existing = await db.query(
      "SELECT * FROM savings WHERE user_id = $1",
      [actualUserId]
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
        [goalAmount, contribution, now, actualUserId]
      );
    } else {
      // Insert new record
      await db.query(
        `INSERT INTO savings
          (user_id, goal_amount, saved_amount, last_contribution, updated_at)
          VALUES ($1, $2, $3, $4, $5)`,
        [actualUserId, goalAmount, contribution, contribution, now]
      );
    }

    res.json({
      success: true,
      message: "Savings updated successfully.",
      data: {
        goalAmount,
        contribution,
        userId: actualUserId
      }
    });
  } catch (err) {
    console.error('Error saving savings data:', err);
    res.status(500).json({
      success: false,
      message: "Error saving savings data: " + err.message
    });
  }
});

//STATS route
// This route fetches the user's budget, total spent, savings goal, and total debt

// Updated Stats API Endpoint with current month filtering
app.get("/api/stats", async (req, res) => {
  const userId = req.session.userId;
  const username = req.session.username;

  if (!userId && !username) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    // Get current month's start and end dates
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Format dates for Postgres
    const startOfMonthStr = startOfMonth.toISOString();
    const endOfMonthStr = endOfMonth.toISOString();

    console.log(`Filtering for month: ${startOfMonthStr} to ${endOfMonthStr}`);

    // Fetch budget data - using username since that's what your budgets table uses
    const budgetRes = await db.query(
      "SELECT monthly_budget FROM budgets WHERE username = $1",
      [username]
    );

    // Fetch transactions for current month only - using username since that's what your transactions table uses
    const transactionRes = await db.query(
      "SELECT SUM(cost) AS total_spent FROM transactions WHERE username = $1 AND date_time >= $2 AND date_time <= $3",
      [username, startOfMonthStr, endOfMonthStr]
    );

    // Fetch savings contributions for current month - using userId since that's what your savings table uses
    const savingsRes = await db.query(
      "SELECT SUM(last_contribution) AS total_contribution FROM savings WHERE user_id = $1 AND updated_at >= $2 AND updated_at <= $3",
      [userId, startOfMonthStr, endOfMonthStr]
    );

    // Fetch debt payments for current month - using userId since that's what your debts table uses
    // This query was looking at 'amount' from 'debts' table, which represents the initial debt amount.
    // To represent payments, you would need a separate 'debt_payments' table or a specific payment field.
    // For now, assuming you want to sum up the initial debt amounts due this month.
    const debtRes = await db.query(
      "SELECT SUM(amount) AS total_debt FROM debts WHERE user_id = $1 AND due_date >= $2 AND due_date <= $3",
      [userId, startOfMonthStr, endOfMonthStr]
    );


    // Get the monthly budget or default to 0
    const monthlyBudget = parseFloat(budgetRes.rows[0]?.monthly_budget || 0);

    // Get total spent this month or default to 0
    const totalSpent = parseFloat(transactionRes.rows[0]?.total_spent || 0);

    // Get savings contribution this month or default to 0
    const savingsContribution = parseFloat(savingsRes.rows[0]?.total_contribution || 0);

    // Get total debt due/added this month or default to 0 (based on your current debt query)
    const totalDebt = parseFloat(debtRes.rows[0]?.total_debt || 0);

    // Calculate remaining budget
    const remainingBudget = Math.max(0, monthlyBudget - totalSpent - savingsContribution - totalDebt);

    res.json({
      success: true,
      data: {
        monthlyBudget,
        totalSpent,
        savingsContribution,
        totalDebt,
        remainingBudget
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, message: "Error fetching stats: " + error.message });
  }
});
// 🆕 Monthly Expenses Data for Chart
app.get("/api/stats/expenses", async (req, res) => {
  const username = req.session.username; // Changed to username to match transactions table

  if (!username) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await db.query(`
      SELECT
        TO_CHAR(date_time, 'Mon YYYY') AS month,
        SUM(cost)::float AS total
      FROM transactions
      WHERE username = $1 -- Changed to username to match transactions table
      GROUP BY month, DATE_TRUNC('month', date_time)
      ORDER BY DATE_TRUNC('month', date_time)
    `, [username]);

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