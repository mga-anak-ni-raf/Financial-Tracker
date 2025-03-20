<?php
session_start();

// Check if user is logged in
if (!isset($_SESSION['username'])) {
    header("Location: login.html"); // Redirect to login page if not logged in
    exit();
}

$username = $_SESSION['username']; // Get logged-in username
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Home Page</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="header">
        <h1>PROJECT NAME</h1>
        <div class="header-right">
            <span>Welcome, <?php echo htmlspecialchars($username); ?>!</span>
            <a href="calendar.php">Calendar</a>
            <a href="#">Stats</a>
            <a href="#">Notes</a>
            <a href="#">Savings</a>
            <a href="logout.php" class="logout-button">Logout</a> <!-- Proper logout -->
        </div>
    </div>
    <div class="content">
        <div class="left-section">
            <div class="block">
                Wallet <br>
                999,999,999.99
            </div>
            <div class="block">
                Transaction
            </div>
            <div class="block">
                Summary/Graph/Stats
            </div>
        </div>
        <div class="right-section">
            CATEGORIES
        </div>
    </div>
</body>
</html>
