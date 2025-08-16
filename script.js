// --- DOM Elements ---
const getForecastBtn = document.getElementById('getForecastBtn');
const resultsDiv = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const loadingMessage = document.getElementById('loading-message');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');

// --- UI Update Functions ---
const locationDisplay = document.getElementById('location-display');
const weatherDisplay = document.getElementById('weather-display');
const fragranceRecommendation = document.getElementById('fragrance-recommendation');
const fragranceReason = document.getElementById('fragrance-reason');

/**
 * Shows a loading message.
 * @param {string} message - The message to display.
 */
function showLoading(message) {
    loadingMessage.textContent = message;
    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    errorBox.classList.add('hidden');
    getForecastBtn.disabled = true;
    getForecastBtn.classList.add('opacity-50', 'cursor-not-allowed');
}

/**
 * Hides the loading message and enables the button.
 */
function hideLoading() {
    loadingDiv.classList.add('hidden');
    getForecastBtn.disabled = false;
    getForecastBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

/**
 * Displays an error message.
 * @param {string} message - The error message to show.
 */
function showError(message) {
    errorMessage.textContent = message;
    errorBox.classList.remove('hidden');
    hideLoading();
}

/**
 * Updates the UI with the final forecast and fragrance data.
 * @param {object} data - The combined weather and fragrance data.
 */
function updateUI(data) {
    locationDisplay.textContent = `Forecast for ${data.city}`;
    weatherDisplay.textContent = `${data.weather.description}, ${data.weather.temperature}°C`;
    fragranceRecommendation.textContent = data.fragrance.scents;
    fragranceReason.textContent = `Mood: ${data.fragrance.mood}. ${data.fragrance.reason}`;
    resultsDiv.classList.remove('hidden');
}


// --- API Logic ---

/**
 * Fetches weather data from the Open-Meteo API.
 * @param {number} latitude - The latitude.
 * @param {number} longitude - The longitude.
 * @returns {Promise<object>} - A promise that resolves to the weather data.
 */
async function getWeatherData(latitude, longitude) {
    const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const response = await fetch(weatherApiUrl);
    if (!response.ok) {
        throw new Error('Could not fetch weather data.');
    }
    const data = await response.json();
    return {
        temperature: Math.round(data.current_weather.temperature),
        description: getWeatherDescription(data.current_weather.weathercode),
    };
}

/**
 * Fetches the city name from latitude and longitude using a reverse geocoding API.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string>}
 */
async function getCityName(latitude, longitude) {
    // Using a free, no-key-required reverse geocoding service
    const geoApiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const response = await fetch(geoApiUrl);
    if (!response.ok) {
        return "your location"; // Fallback
    }
    const data = await response.json();
    return data.address.city || data.address.town || "your location";
}


/**
 * Calls the Gemini API to get a fragrance recommendation.
 * @param {object} weatherData - The current weather data.
 * @returns {Promise<object>} - A promise that resolves to the fragrance recommendation.
 */
async function getFragranceFromAI(weatherData) {
    const apiKey = "AIzaSyClYqye1y0HroYVQd2PP0xGknoIA-FZ9a0"; // Leave empty, will be handled by the environment
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const prompt = `
        Based on the following weather conditions, recommend a fragrance profile.
        Weather: ${weatherData.description}
        Temperature: ${weatherData.temperature}°C

        Provide your response in a JSON object with the following structure:
        {
          "mood": "A short description of the mood or feeling",
          "atmosphere": "A description of the overall atmosphere",
          "scents": "Key scent notes, e.g., 'Citrus & Bergamot'",
          "reason": "A brief explanation for the recommendation."
        }
    `;

    const payload = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`AI API request failed with status ${response.status}`);
    }

    const result = await response.json();
    if (result.candidates && result.candidates.length > 0) {
        const jsonText = result.candidates[0].content.parts[0].text;
        return JSON.parse(jsonText);
    } else {
        throw new Error('Invalid response structure from AI API.');
    }
}


// --- Main Application Flow ---

getForecastBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    showLoading("Getting your location...");

    navigator.geolocation.getCurrentPosition(async (position) => {
        try {
            const {
                latitude,
                longitude
            } = position.coords;

            showLoading("Fetching weather data...");
            const [weather, city] = await Promise.all([
                getWeatherData(latitude, longitude),
                getCityName(latitude, longitude)
            ]);


            showLoading("Creating your fragrance profile...");
            const fragrance = await getFragranceFromAI(weather);

            hideLoading();
            updateUI({
                weather,
                fragrance,
                city
            });

        } catch (error) {
            console.error("Error:", error);
            showError(error.message || "An unknown error occurred.");
        }
    }, (error) => {
        // Geolocation error handling
        let message = "Could not get your location. Please allow location access.";
        if (error.code === error.PERMISSION_DENIED) {
            message = "Location access was denied. Please enable it in your browser settings.";
        }
        showError(message);
    });
});


// --- Helper Functions ---

/**
 * Converts WMO weather codes to human-readable descriptions.
 * @param {number} code - The WMO weather code.
 * @returns {string} - The weather description.
 */
function getWeatherDescription(code) {
    const descriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snow fall",
        73: "Moderate snow fall",
        75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    };
    return descriptions[code] || "Unknown weather";
}
