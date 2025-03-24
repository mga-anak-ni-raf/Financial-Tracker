<?php
session_start();
$servername = "localhost";
$username = "root";  // Change if needed
$password = "";      // Change if needed
$dbname = "user_database";

// Connect to MySQL
$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Handle form submission
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $user = $_POST['username'];
    $pass = password_hash($_POST['password'], PASSWORD_BCRYPT); // Secure password hashing

    // Check if username exists
    $checkUser = "SELECT * FROM users WHERE username = ?";
    $stmt = $conn->prepare($checkUser);
    $stmt->bind_param("s", $user);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        echo "<script>alert('Username already exists!'); window.location.href='signup.html';</script>";
    } else {
        // Insert into database
        $sql = "INSERT INTO users (username, password) VALUES (?, ?)";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("ss", $user, $pass);

        if ($stmt->execute()) {
            $_SESSION['username'] = $user;
            echo "<script>alert('Registration successful! Redirecting...'); window.location.href='homepage.php';</script>";
        } else {
            echo "<script>alert('Error registering user.'); window.location.href='signup.html';</script>";
        }
    }
}
$conn->close();
?>
