/*
 * Node Helper for MMM-OneCallWeather.
 *
 * This helper is responsible for the data pull from OpenWeather.
 * At a minimum the API key, Latitude and Longitude parameters
 * must be provided.  If any of these are missing, the request
 * to OpenWeather will not be executed, and instead an error
 * will be output the the MagicMirror log.
 *
 * Additional, this module supplies two optional parameters:
 *
 *  units - one of "metric", "imperial", or "" (blank)
 */

const NodeHelper = require('node_helper')
const Log = require('logger')

module.exports = NodeHelper.create({

  async socketNotificationReceived(notification, config) {
    if (notification === 'OPENWEATHER_ONECALL_GET') {
      Log.debug('Node received')
      if (!config.apikey) {
        Log.error('No API key configured. Get an API key at https://openweathermap.org/api/one-call-api')
        return
      }
      const coordinates = [config.latitude, config.longitude]
      const coordinatesMissing = coordinates.some(coordinate => !coordinate && coordinate !== 0)
      if (coordinatesMissing) {
        Log.error('Latitude and/or longitude not provided.')
        return
      }

      const url = new URL(`https://api.openweathermap.org/data/${config.apiVersion}/onecall`)
      url.searchParams.set('lat', config.latitude)
      url.searchParams.set('lon', config.longitude)
      url.searchParams.set('exclude', config.exclude)
      url.searchParams.set('appid', config.apikey)
      url.searchParams.set('lang', config.language)
      if (config.units) {
        url.searchParams.set('units', config.units)
      }

      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        Log.debug(`Got weather data for ${config.latitude},${config.longitude}`)

        // Inject demo alert for testing if DEMO_ALERT env var is set
        if (process.env.DEMO_ALERT === '1' && data.current && !data.alerts) {
          const now = Math.floor(Date.now() / 1000)
          data.alerts = [
            {
              sender_name: 'NWS Test Station', // eslint-disable-line camelcase
              event: 'Winter Weather Advisory',
              start: now - 3600,
              end: now + 28800,
              description: '* WHAT...Two periods of accumulating lake effect snow expected. Total snow accumulations could locally exceed 5 inches, particularly near the lake.\n\n* WHERE...Northern regions.\n\n* WHEN...Until 8 PM CST this evening. For the second Winter Weather Advisory, from 6 AM to 4 PM CST Saturday.\n\n* IMPACTS...Roads, and especially bridges and overpasses, will likely become slick and hazardous. The hazardous conditions will impact this evenings commute.\n\n* ADDITIONAL DETAILS...Lake effect snow is expected to impact the area in two waves.',
              tags: ['Snow/Ice'],
            },
          ]
          Log.info('Demo alert injected')
        }

        this.sendSocketNotification('OPENWEATHER_ONECALL_DATA', {
          identifier: config.identifier,
          data,
        })
        Log.debug('Sent the data back')
      }
      catch (error) {
        Log.error(error)
        // Send error to frontend so module doesn't stay in "Loading..." state
        this.sendSocketNotification('OPENWEATHER_ONECALL_ERROR', {
          identifier: config.identifier,
          error: error.message,
        })
      }
    }
  },
})
