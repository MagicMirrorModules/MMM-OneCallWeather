let config = {
  address: '0.0.0.0',
  ipWhitelist: [],
  logLevel: ['INFO', 'LOG', 'WARN', 'ERROR', 'DEBUG'],
  modules: [
    {
      module: 'clock',
      position: 'middle_center',
    },

    {
      disabled: true,
      module: 'MMM-OneCallWeather',
      position: 'top_right',
      header: 'TOTO',
      config:
                    {
                      latitude: 45.466667,
                      longitude: -73.75,
                      apikey: 'YOUR_API_KEY',
                      iconset: '4a',
                      iconsetFormat: 'png',
                      layout: 'vertical',
                    },
    },

    {
      disabled: true,
      module: 'MMM-OneCallWeather',
      header: 'Weather in London',
      position: 'top_right',
      config: {
        colored: false,
        iconset: '9a',
        iconsetFormat: 'svg',

        latitude: '51.500149',
        longitude: '-0.126240',
        apikey: 'YOUR_API_KEY',
      },
    },
    {
      disabled: true,
      module: 'MMM-OneCallWeather',
      position: 'top_left',
      header: 'TOTO',
      config: {
        latitude: '45.466667',
        longitude: '-73.75',
        apikey: 'YOUR_API_KEY',
        iconset: '4a',
        iconsetFormat: 'png',
      },
    },
    {
      disabled: true,
      module: 'MMM-OneCallWeather',
      position: 'top_left',
      header: 'TOTO',
      config: {
        layout: 'vertical',
        latitude: '45.466667',
        longitude: '-73.75',
        apikey: 'YOUR_API_KEY',
        iconset: '4a',
        iconsetFormat: 'png',
      },
    },

    {
      disabled: true,
      module: 'MMM-OneCallWeather',
      position: 'top_left',
      header: 'Weather in London',
      config: {
        latitude: '51.500149',
        longitude: '-0.126240',
        apikey: 'YOUR_API_KEY',
        displayMode: 'both-vertical',
      },
    },
    {
      disabled: false,
      module: 'MMM-OneCallWeather',
      position: 'top_left',
      header: 'Weather in London',
      config: {
        layout: 'vertical',
        latitude: '51.500149',
        longitude: '-0.126240',
        apikey: 'YOUR_API_KEY',
        showCurrent: true,
        showForecast: true,
        showAlerts: true,
        forecastLayout: 'columns',
        arrangement: 'horizontal',
      },
    },
    {
      disabled: false,
      module: 'MMM-OneCallWeather',
      position: 'top_right',
      header: 'Weather Alerts Test (Oklahoma)',
      config: {
        latitude: '35.4676', // Oklahoma City (Tornado Alley)
        longitude: '-97.5164',
        apikey: 'YOUR_API_KEY',
        showCurrent: true,
        showForecast: false,
        showAlerts: true, // Test alerts feature
        colored: true,
      },
    },
  ],
}

/** ************* DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== 'undefined') {
  module.exports = config
}
