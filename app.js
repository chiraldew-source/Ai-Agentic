
// ===================================
// BELLANOVA - JAVASCRIPT
// ===================================

// 1. SIDEBAR NAVIGATION

const navLinks = document.querySelectorAll(".nav-link");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("page-title");

const titles = {
    dashboard: "Emergency Dashboard",
    sos: "SOS Requests",
    silentzone: "SilentZone Monitoring",
    resources: "Resource Hub",
    failureshift: "FailureShift",
    proofloop: "ProofLoop Tracking"
};

function openPage(pageName) {

    pages.forEach(page => {
        page.classList.remove("active");
    });

    navLinks.forEach(link => {
        link.classList.remove("active");
    });

    const selectedPage = document.getElementById(pageName);

    if (!selectedPage) return;

    selectedPage.classList.add("active");

    const selectedLink = document.querySelector(
        `.nav-link[data-page="${pageName}"]`
    );

    if (selectedLink) {
        selectedLink.classList.add("active");
    }

    pageTitle.textContent = titles[pageName];
}

navLinks.forEach(link => {

    link.addEventListener("click", function(event) {

        event.preventDefault();

        openPage(this.dataset.page);

    });

});

// Quick action buttons

document.querySelectorAll("[data-open]").forEach(button => {

    button.addEventListener("click", function() {

        openPage(this.dataset.open);

    });

});

// 2. SOS REQUEST MANAGEMENT

let sosCount = 0;

const sosForm = document.getElementById("sos-form");

const totalSOS = document.getElementById("total-sos");

const recentRequests = document.getElementById("recent-requests");

sosForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const name = document.getElementById("person-name").value;

    const type = document.getElementById("emergency-type").value;

    const location = document.getElementById("location").value;

    const description = document.getElementById("description").value;

    sosCount++;

    const requestID = "BN-" + String(sosCount).padStart(3, "0");

    totalSOS.textContent = sosCount;

    const request = document.createElement("div");

    request.className = "status-row";

    const requestDetails = document.createElement("span");

    requestDetails.textContent =
        `${requestID} | ${name} | ${type} | ${location}`;

    const status = document.createElement("span");

    status.className = "yellow";

    status.textContent = "Pending";

    request.appendChild(requestDetails);
    request.appendChild(status);

    recentRequests.prepend(request);

    const message = document.getElementById("form-message");

    message.textContent =
        `SOS request ${requestID} submitted successfully!`;

    sosForm.reset();

});

// 3. SILENTZONE SCAN

const scanButton = document.getElementById("scan-btn");

scanButton.addEventListener("click", function() {

    const result = document.getElementById("scan-result");

    result.textContent =
        "Demo scan completed. Communication gap analysis is ready.";

});

// 4. FAILURESHIFT ALTERNATIVE

const alternativeButton =
    document.getElementById("alternative-btn");

alternativeButton.addEventListener("click", function() {

    const result =
        document.getElementById("alternative-result");

    result.textContent =
        "Demo suggestion: If the primary responder is unavailable, consider assigning the next eligible responder.";

});

// 5. PROOFLOOP DELIVERY CONFIRMATION

const proofButton = document.getElementById("proof-btn");

proofButton.addEventListener("click", function() {

    const result =
        document.getElementById("proof-result");

    result.textContent =
        "Demo delivery confirmation recorded successfully!";

});

// ===================================
// END OF BELLANOVA JAVASCRIPT
// ===================================
// ===================================
// BELLANOVA INTERACTIVE EMERGENCY MAP
// ===================================

const mapElement = document.getElementById("emergency-map");

if (mapElement && typeof L !== "undefined") {

    // Create map centered on Bengaluru
    const emergencyMap = L.map("emergency-map").setView(
        [12.9716, 77.5946], 12
    );

    // OpenStreetMap layer
    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }
    ).addTo(emergencyMap);

    // RED - SOS Emergency
    L.circleMarker([12.9716, 77.5946], {
        radius: 10,
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.9
    })
    .addTo(emergencyMap)
    .bindPopup(
        "<b>🚨 SOS Emergency</b><br>Demo location: Bengaluru<br>Status: Pending"
    );

    // GREEN - Available Responder
    L.circleMarker([12.9815, 77.6060], {
        radius: 10,
        color: "#22c55e",
        fillColor: "#22c55e",
        fillOpacity: 0.9
    })
    .addTo(emergencyMap)
    .bindPopup(
        "<b>🟢 Available Responder</b><br>Demo responder<br>Status: Available"
    );

    // YELLOW - SilentZone
    L.circleMarker([12.9600, 77.5800], {
        radius: 10,
        color: "#eab308",
        fillColor: "#eab308",
        fillOpacity: 0.9
    })
    .addTo(emergencyMap)
    .bindPopup(
        "<b>🟡 SilentZone</b><br>Demo communication gap<br>Status: Requires monitoring"
    );

} else {
    console.warn("Map library or map container is unavailable.");
}

// BELLA NOVA GPS LOCATION DETECTION

// ===================================
// BELLANOVA GPS LOCATION DETECTION
// ===================================

const gpsButton = document.getElementById("gps-btn");
const locationInput = document.getElementById("location");
const gpsStatus = document.getElementById("gps-status");

let userGpsMarker = null;


if (gpsButton && locationInput && gpsStatus) {

    gpsButton.addEventListener("click", function () {

        if (!navigator.geolocation) {
            gpsStatus.textContent =
                "GPS is not supported by this browser.";
            return;
        }

        gpsStatus.textContent = "Detecting your location...";
        gpsButton.disabled = true;

        navigator.geolocation.getCurrentPosition(

            function (position) {

                // Get GPS coordinates
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                gpsStatus.textContent =
                    "GPS detected. Finding address...";

                // Convert coordinates into readable address
                fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
                )
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Address service unavailable");
                    }
                    return response.json();
                })
                .then(data => {

                    if (data.display_name) {
                        locationInput.value = data.display_name;

                        gpsStatus.textContent =
                            "✓ Address detected successfully!";
                    } else {
                        throw new Error("Address not found");
                    }

                })
                .catch(error => {

                    console.error("Address error:", error);

                    locationInput.value =
                        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

                    gpsStatus.textContent =
                        "GPS detected, but address lookup failed. Coordinates displayed.";
                })
                .finally(() => {
                    gpsButton.disabled = false;
                });

            },

            function (error) {

                gpsButton.disabled = false;

                gpsStatus.textContent =
                    "GPS error: " + error.message;

            },

            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            }

        );

    });

}