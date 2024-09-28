export { plotWeather };

Chart.defaults.color = '#eee';
const plotWeather = (location, targetDivId) => {
  const {lat, long} = location
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  const canvas = document.createElement("CANVAS");
  canvas.id = "weather-chart";
  targetDiv.appendChild(canvas)
  const ctx = document.getElementById("weather-chart").getContext("2d");
  fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&hourly=temperature_2m,precipitation_probability,precipitation,rain&forecast_days=1`
  )
    .then((response) => response.json())
    .then((data) => {
      new Chart(ctx, {
        options: {
          scales: {
            temp: {
              type: "linear",
              position: "left",
              ticks: {
                color: "#eee",
              },
            },
            precip: {
              type: "linear",
              position: "right",
              ticks: {
                color: "#eee",
              },
            },
            prob: {
              type: "linear",
              position: "right",
              grid: {
                display: false, // Hide grid lines for probability
              },
              ticks: {
                color: "#eee",
                max: 100, // Set max value to 100 for probability
              },
            },
          },
          plugins: {
            legend: {
              labels: {
                color: "#eee",
                boxHeight: 3,
                pointStyle: "line",
                usePointStyle: true,
                pointStyleWidth: 10,
              },
            },
          },
        },
        data: {
          labels: data.hourly.time.map((time) => time.slice(11)),
          datasets: [
            {
              label: "Temperature (°C)",
              data: data.hourly.temperature_2m,
              borderColor: "#d50",
              yAxisID: "temp",
              type: "line",
              pointStyle: "line",
            },
            {
              label: "Precipitation (mm)",
              data: data.hourly.precipitation,
              borderColor: "#05d",
              yAxisID: "precip",
              type: "line",
              pointStyle: "line",
            },
            {
              label: "Precipitation Probability (%)",
              type: "bar",
              data: data.hourly.precipitation_probability,
              backgroundColor: "#0033ee99",
              borderColor: "#0033ee99",
              yAxisID: "prob",
              pointStyle: "line",
            },
          ],
        },
      });
    });
};
