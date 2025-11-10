// --- Helper Functions ---
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function formatTime(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(durationString) {
  if (!durationString) return "0 min";
  // Format is "00d00:27:00"
  const parts = durationString.split(":");
  const hours = parseInt(parts[0].slice(-2), 10);
  const minutes = parseInt(parts[1], 10);
  return `${hours * 60 + minutes} min`;
}

function getTransportIcon(category) {
  // Returns the SVG for a given transport category
  const icons = {
    S: `<svg class="transport-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.5 1a.5.5 0 000 1h9a.5.5 0 000-1h-9zM2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm3.5 1a.5.5 0 000 1h9a.5.5 0 000-1h-9z" /></svg>`,
    IR: `<svg class="transport-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.5 1a.5.5 0 000 1h9a.5.5 0 000-1h-9zM2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm3.5 1a.5.5 0 000 1h9a.5.5 0 000-1h-9z" /></svg>`,
    IC: `<svg class="transport-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.5 1a.5.5 0 000 1h9a.5.5 0 000-1h-9zM2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm3.5 1a.5.5 0 000 1h9a.5.5 0 000-1h-9z" /></svg>`,
    B: `<svg class="transport-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 12a1 1 0 110-2 1 1 0 010 2zm12 0a1 1 0 110-2 1 1 0 010 2z" clip-rule="evenodd" /></svg>`,
    WALK: `<svg class="walk-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" /></svg>`,
  };
  return icons[category] || icons["S"]; // Default to train icon
}

// --- Main Rendering Logic ---
async function fetchAndRenderConnections() {
  console.log("Fetching connections");
  const fromStation = getQueryParam("from") || "Zurich HB";
  const toStation = getQueryParam("to") || "Genève";
  const apiUrl = `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(fromStation)}&to=${encodeURIComponent(toStation)}`;
  const container = document.getElementById("connections-container");

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    container.innerHTML = ""; // Clear loading message

    if (!data.connections || data.connections.length === 0) {
      container.innerHTML = `<p style="color: #f3f4f6;">No connections found.</p>`;
      return;
    }

    data.connections.slice(0, 4).forEach((connection) => {
      // Display up to 4 connections
      const card = document.createElement("div");
      card.className = "connection-card";

      // --- Timeline HTML ---
      let timelineHtml = "";
      connection.sections.forEach((section, index) => {
        if (section.journey) {
          timelineHtml += `
                                <div class="timeline-leg">
                                    ${getTransportIcon(section.journey.category)}
                                    <span class="transport-name">${section.journey.category} ${section.journey.number || ""}</span>
                                </div>
                            `;
        } else if (section.walk) {
          if (connection.sections.length > 1 && section.walk.duration > 60) {
            timelineHtml += `
                                    <div class="timeline-leg">
                                        ${getTransportIcon("WALK")}
                                        <span class="transport-name">Walk</span>
                                    </div>
                                `;
          }
        }

        // Add interchange info if not the last section
        if (index < connection.sections.length - 1) {
          const nextSection = connection.sections[index + 1];
          timelineHtml += `
                                <div class="timeline-separator">
                                    <div class="timeline-connector"></div>
                                    <div class="interchange">
                                        <p class="station">${section.arrival.station.name.replace(/, Bahnhof|,/g, "")}</p>
                                        <p class="times">${formatTime(section.arrival.arrival)} / ${formatTime(nextSection.departure.departure)}</p>
                                    </div>
                                    <div class="timeline-connector"></div>
                                </div>
                            `;
        }
      });

      // --- Final Card HTML ---
      const extraPlatformClass =
        connection.from.platform && connection.from.platform.endsWith("!")
          ? "red"
          : "";
      card.innerHTML = `
                        <div class="card-header">
                            <div class="time-info">
                                <div class="delay-info">
                                    <p class="time">${formatTime(connection.from.departure)}</p>
                                    ${connection.from.delay > 0 ? `<p class="delay">+${connection.from.delay}</p>` : ""}
                                </div>
                                <svg class="arrow-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                                <p class="time">${formatTime(connection.to.arrival)}</p>
                            </div>
                            <div class="duration-info">
                                <div class="duration">${formatDuration(connection.duration)}</div>
                                <div class="transfers">${connection.transfers > 0 ? `${connection.transfers} change` : "Direct"}</div>
                            </div>
                        </div>
                        <div class="timeline">${timelineHtml}</div>
                        <div class="card-footer">
                            <span>From: ${connection.from.station.name}</span>
                            ${connection.from.platform ? `<span>Platform <span class="${extraPlatformClass} platform-info">${connection.from.platform}</span></span>` : ""}
                        </div>
                    `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Could not fetch transport data:", error);
    container.innerHTML = `<p style="color: #fca5a5;">Failed to load connections.</p>`;
  }
}

// Fetch and render connections on page load
const container = document.getElementById("connections-container");

const observer = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      // If the container is intersecting the viewport, fetch the data
      if (entry.isIntersecting) {
        fetchAndRenderConnections();
        // Stop observing once the data is fetched to avoid re-fetching
        observer.unobserve(container);
      }
    });
  },
  {
    root: null, // observes intersections relative to the viewport
    threshold: 0.1, // trigger when 10% of the element is visible
  },
);

// Start observing the container
observer.observe(container);
