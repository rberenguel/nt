//import { toTop } from "./utilities.js";

let weatherChart;

Chart.defaults.color = "#eee";
const plotWeather = (title, location, targetDivId, props) => {
  const { lat, long } = location;
  const targetDiv = document.getElementById(targetDivId);
  if (!targetDiv) {
    console.error("Target div not found:", targetDivId);
    return;
  }
  targetDiv.addEventListener("mouseover", () => toTop(targetDiv));
  const canvas = document.createElement("CANVAS");
  canvas.id = "weather-chart-" + title;
  if (props && props.width) {
    canvas.style.width = props.width;
  } else {
    canvas.style.width = "500px";
  }
  canvas.style.backgroundColor = "#333333ff";
  canvas.style.borderSadius = "0.1em";
  targetDiv.appendChild(canvas);
  const ctx = document
    .getElementById("weather-chart-" + title)
    .getContext("2d");
  fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&hourly=temperature_2m,precipitation_probability,precipitation,rain&forecast_days=2`,
  )
    .then((response) => response.json())
    .then((data) => {
      weatherChart = new Chart(ctx, {
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
            title: {
              display: true,
              font: {
                size: 10,
              },
              text: title,
            },
          },
        },
        data: {
          labels: data.hourly.time.map((time) => time.slice(11)),
          datasets: [
            {
              label: "temp",
              data: data.hourly.temperature_2m,
              borderColor: "#d50",
              yAxisID: "temp",
              type: "line",
              pointStyle: "line",
            },
            {
              label: "mm",
              data: data.hourly.precipitation,
              borderColor: "#05d",
              yAxisID: "precip",
              type: "line",
              pointStyle: "line",
            },
            {
              label: "prec %",
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
      updateCurrentTimeLine(); // Add the current time line initially
      setInterval(updateCurrentTimeLine, 60000); // Update every minute
    });
};

function updateCurrentTimeLine() {
  const now = new Date();
  const currentHour = now.getHours();

  // Find the index of the current hour in the labels
  const currentTimeIndex = weatherChart.data.labels.findIndex(
    (label) => parseInt(label) === currentHour,
  );

  // Remove any existing vertical line annotation
  if (weatherChart.options.plugins.annotation) {
    weatherChart.options.plugins.annotation.annotations = [];
  } else {
    weatherChart.options.plugins.annotation = {
      annotations: [],
    };
  }

  // Add the new vertical line annotation
  weatherChart.options.plugins.annotation.annotations.push({
    type: "line",
    mode: "vertical",
    scaleID: "x",
    value: currentTimeIndex,
    borderColor: "yellow",
    borderWidth: 2,
    label: {
      enabled: true,
      content: "Current Time",
      position: "top",
    },
  });

  weatherChart.update(); // Update the chart to reflect the changes
}
