/*
 * Demo config: shows several variants of the module side by side.
 *
 * The API key is a MagicMirror secret: it stays on the server and is not sent to the browser.
 * Provide it as environment variable SECRET_OWM_KEY (without it the requests fail with an authorization error):
 *
 *   File next to this one named demo.config.env (ignored by git), containing the line:
 *     SECRET_OWM_KEY=<your key>
 *   Current terminal only (without leaving the key in the shell history):
 *     read -rs SECRET_OWM_KEY && export SECRET_OWM_KEY
 *   All new terminals (add once to ~/.bashrc, then open a new terminal):
 *     export SECRET_OWM_KEY=<your key>
 *   Single run only:
 *     SECRET_OWM_KEY=<your key> node --run demo
 *
 * Start the demo with:
 *   node --run demo
 *   DEMO_ALERT=1 node --run demo   (injects a test alert if there is none)
 */
const apikey = '${SECRET_OWM_KEY}'

let config = {
  address: '0.0.0.0',
  ipWhitelist: [],
  logLevel: ['INFO', 'LOG', 'WARN', 'ERROR', 'DEBUG'],
  language: 'en',
  units: 'metric',
  modules: [
    {
      module: 'clock',
      position: 'top_right',
    },
    {
      module: 'MMM-OneCallWeather',
      position: 'top_left',
      header: 'London - default',
      config: {
        apikey,
        latitude: 51.500149,
        longitude: -0.12624,
        showFeelsLike: true,
      },
    },
    {
      module: 'MMM-OneCallWeather',
      position: 'top_center',
      header: 'Bergen - rows, SVG icons, decimal comma',
      config: {
        apikey,
        latitude: 60.3913,
        longitude: 5.3221,
        showFeelsLike: true,
        forecastLayout: 'rows',
        iconset: '9a',
        iconsetFormat: 'svg',
        roundTemp: false,
        decimalSymbol: ',',
        scale: true,
        windUnits: 'kmph',
        showWindSpeedUnit: true,
      },
    },
    {
      module: 'MMM-OneCallWeather',
      position: 'top_right',
      header: 'Oklahoma City - alerts, imperial units',
      config: {
        apikey,
        latitude: 35.4676,
        longitude: -97.5164,
        units: 'imperial',
        showFeelsLike: true,
        showForecast: false,
        showAlertsHours: 24,
        showWindDirectionAsArrow: true,
        showWindSpeedUnit: true,
      },
    },
    {
      module: 'MMM-OneCallWeather',
      position: 'bottom_left',
      header: 'Sapporo - horizontal, snow, Beaufort',
      config: {
        apikey,
        latitude: 43.0618,
        longitude: 141.3545,
        showFeelsLike: true,
        arrangement: 'horizontal',
        maxDailiesToShow: 5,
        useBeaufortInCurrent: true,
      },
    },
    {
      module: 'MMM-OneCallWeather',
      position: 'bottom_right',
      header: 'Honolulu - forecast only',
      config: {
        apikey,
        latitude: 21.3069,
        longitude: -157.8583,
        showFeelsLike: true,
        showCurrent: false,
        colored: false,
      },
    },
  ],
}

/** ************* DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== 'undefined') {
  module.exports = config
}
