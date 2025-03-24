
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
    <title>Interactive Calendar with Events</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            margin: 20px;
            background-color: #ffebeb;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #d07575;
            padding: 15px 20px;
            margin: -20px;
            margin-bottom: 100px;
        }
        .header h1 {
            margin: 0;
            color: white;
        }
        .header-right a {
            margin-left: 20px;
            color: white;
            text-decoration: none;
        }
        .header-right a:hover {
            text-decoration: underline;
        }
        .logout-button {
            background-color: red;
            color: white;
            padding: 5px 10px;
            text-decoration: none;
            border-radius: 5px;
        }
        .calendar-container {
            width: 90%;
            max-width: 400px;
            margin: auto;
        }
        .calendar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #d07575;
            color: white;
            padding: 10px;
            border-radius: 5px;
        }
        .calendar-header button {
            background: white;
            border: none;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 18px;
            border-radius: 3px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            width: 14%;
            padding: 10px;
            text-align: center;
            border: 1px solid #ddd;
            cursor: pointer;
            position: relative;
        }
        th {
            background: #d07575;
            color: white;
        }
        .today {
            background: #d07575;
            color: white;
            font-weight: bold;
        }
        .event {
            color: rgb(139, 80, 80);
            font-size: 12px;
            padding: 3px;
            border-radius: 5px;
            position: absolute;
            bottom: 5px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #eventModal {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
            text-align: center;
            z-index: 1000;
        }
        .modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.3);
            z-index: 999;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1><a href="homepage.php">PROJECT NAME</a></h1>
        <div class="header-right">
            <span>Welcome, <?php echo htmlspecialchars($username); ?>!</span>
            <a href="#">Calendar</a>
            <a href="#">Stats</a>
            <a href="#">Notes</a>
            <a href="#">Savings</a>
            <a href="logout.php" class="logout-button">Logout</a>
        </div>
    </div>

    <div class="calendar-container">
        <div class="calendar-header">
            <button onclick="prevMonth()">❮</button>
            <span id="monthYear"></span>
            <button onclick="nextMonth()">❯</button>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Sun</th> <th>Mon</th> <th>Tue</th> <th>Wed</th> <th>Thu</th> <th>Fri</th> <th>Sat</th>
                </tr>
            </thead>
            <tbody id="calendar-body"></tbody>
        </table>
    </div>

    <div class="modal-overlay" onclick="closeModal()"></div>
    <div id="eventModal">
        <h3 id="eventDate"></h3>
        <input type="text" id="eventText" placeholder="Enter event">
        <button onclick="saveEvent()">Save</button>
        <button onclick="deleteEvent()">Delete</button>
        <button onclick="closeModal()">Close</button>
    </div>

    <script>
        let currentDate = new Date();
        let events = JSON.parse(localStorage.getItem("events")) || {};

        function renderCalendar() {
            const monthYear = document.getElementById("monthYear");
            const calendarBody = document.getElementById("calendar-body");

            let year = currentDate.getFullYear();
            let month = currentDate.getMonth();
            let firstDay = new Date(year, month, 1).getDay();
            let daysInMonth = new Date(year, month + 1, 0).getDate();

            monthYear.innerText = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(currentDate);
            calendarBody.innerHTML = "";

            let date = 1;
            for (let i = 0; i < 6; i++) {
                let row = document.createElement("tr");

                for (let j = 0; j < 7; j++) {
                    let cell = document.createElement("td");

                    if (i === 0 && j < firstDay) {
                        cell.innerText = "";
                    } else if (date > daysInMonth) {
                        break;
                    } else {
                        let eventKey = `${year}-${month + 1}-${date}`;
                        cell.innerText = date;
                        cell.onclick = () => openModal(eventKey);

                        if (events[eventKey]) {
                            let eventDiv = document.createElement("div");
                            eventDiv.classList.add("event");
                            eventDiv.innerText = events[eventKey];
                            cell.appendChild(eventDiv);
                        }

                        if (date === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()) {
                            cell.classList.add("today");
                        }
                        date++;
                    }
                    row.appendChild(cell);
                }
                calendarBody.appendChild(row);
            }
        }

        function prevMonth() {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
        }

        function nextMonth() {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
        }

        function openModal(date) {
            document.getElementById("eventDate").innerText = `Event on ${date}`;
            document.getElementById("eventText").value = events[date] || "";
            document.getElementById("eventModal").setAttribute("data-date", date);
            document.querySelector(".modal-overlay").style.display = "block";
            document.getElementById("eventModal").style.display = "block";
        }

        function saveEvent() {
            let date = document.getElementById("eventModal").getAttribute("data-date");
            let eventText = document.getElementById("eventText").value.trim();

            if (eventText) {
                events[date] = eventText;
            } else {
                delete events[date];
            }

            localStorage.setItem("events", JSON.stringify(events));
            closeModal();
            renderCalendar();
        }

        function deleteEvent() {
            let date = document.getElementById("eventModal").getAttribute("data-date");
            delete events[date];
            localStorage.setItem("events", JSON.stringify(events));
            closeModal();
            renderCalendar();
        }

        function closeModal() {
            document.getElementById("eventModal").style.display = "none";
            document.querySelector(".modal-overlay").style.display = "none";
        }

        renderCalendar();
    </script>
</body>
</html>

