/*
 * Node Helper for MMM-OneCallWeather.
 *
 * This helper is responsible for the data pull from OpenWeather.
 * The frontend sends its configuration once (OPENWEATHER_ONECALL_INIT);
 * the helper then fetches periodically, caches the last result per module
 * instance and pushes data or errors to the frontend. A reconnecting client
 * gets the cached result instead of triggering a new API call.
 *
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

// Maps a failed request to one of the MODULE_ERROR_* keys of the MagicMirror core translations
function getErrorTranslationKey(error) {
  const { status } = error
  if (status === 401 || status === 403) {
    return 'MODULE_ERROR_UNAUTHORIZED'
  }
  if (status === 429) {
    return 'MODULE_ERROR_RATE_LIMITED'
  }
  if (status >= 500) {
    return 'MODULE_ERROR_SERVER_ERROR'
  }
  if (status >= 400) {
    return 'MODULE_ERROR_CLIENT_ERROR'
  }
  if (error.name === 'TimeoutError' || error.cause?.code) {
    return 'MODULE_ERROR_NO_CONNECTION'
  }
  return 'MODULE_ERROR_UNSPECIFIED'
}

module.exports = NodeHelper.create({
  // Keyed by module identifier: { config, timer, lastData, lastError }
  instances: {},

  socketNotificationReceived(notification, config) {
    if (notification === 'OPENWEATHER_ONECALL_INIT') {
      return this.initInstance(config)
    }
    return undefined
  },

  async initInstance(config) {
    const existing = this.instances[config.identifier]
    if (existing) {
      // The client reloaded: replay the last result instead of fetching again
      if (existing.lastData) {
        this.sendSocketNotification('OPENWEATHER_ONECALL_DATA', existing.lastData)
      }
      else if (existing.lastError) {
        this.sendSocketNotification('OPENWEATHER_ONECALL_ERROR', existing.lastError)
      }
      return
    }

    if (!config.apikey) {
      Log.error('No API key configured. Get an API key at https://openweathermap.org/api/one-call-api')
      return
    }
    const coordinates = [config.latitude, config.longitude]
    const coordinatesMissing = coordinates.some(coordinate => !coordinate && coordinate !== 0)
    if (coordinatesMissing) {
      Log.error('Latitude and/or longitude not provided.')
      this.sendSocketNotification('OPENWEATHER_ONECALL_ERROR', {
        identifier: config.identifier,
        error: 'Latitude and/or longitude not provided.',
      })
      return
    }

    const instance = { config, timer: null, lastData: null, lastError: null }
    this.instances[config.identifier] = instance

    if (config.initialLoadDelay > 0) {
      this.scheduleFetch(instance, config.initialLoadDelay)
    }
    else {
      await this.fetchWeather(instance)
    }
  },

  scheduleFetch(instance, delay) {
    // Like the core HTTPFetcher: no timers in test mode
    if (process.env.mmTestMode === 'true') {
      return
    }
    instance.timer = setTimeout(() => this.fetchWeather(instance), delay)
  },

  async fetchWeather(instance) {
    const { config } = instance
    const url = new URL(`https://api.openweathermap.org/data/${config.apiVersion}/onecall`)
    url.searchParams.set('lat', config.latitude)
    url.searchParams.set('lon', config.longitude)
    // The module only shows current, daily and alerts
    url.searchParams.set('exclude', 'minutely,hourly')
    url.searchParams.set('appid', config.apikey)
    url.searchParams.set('lang', config.language)
    if (config.units) {
      url.searchParams.set('units', config.units)
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const requestError = new Error(`HTTP ${response.status}: ${body.message || response.statusText}`)
        requestError.status = response.status
        throw requestError
      }

      const data = await response.json()

      Log.debug(`Got weather data for ${config.latitude},${config.longitude}`)

      // Inject demo alert for testing if DEMO_ALERT env var is set
      if (process.env.DEMO_ALERT === '1' && data.current && !data.alerts) {
        const now = Math.floor(Date.now() / 1000)
        data.alerts = [
          {
            sender_name: 'NWS Test Station',
            event: 'Winter Weather Advisory',
            start: now - 3600,
            end: now + 28800,
            description: '* WHAT...Two periods of accumulating lake effect snow expected. Total snow accumulations could locally exceed 5 inches, particularly near the lake.\n\n* WHERE...Northern regions.\n\n* WHEN...Until 8 PM CST this evening. For the second Winter Weather Advisory, from 6 AM to 4 PM CST Saturday.\n\n* IMPACTS...Roads, and especially bridges and overpasses, will likely become slick and hazardous. The hazardous conditions will impact this evenings commute.\n\n* ADDITIONAL DETAILS...Lake effect snow is expected to impact the area in two waves.',
            tags: ['Snow/Ice'],
          },
        ]
        Log.info('Demo alert injected')
      }

      instance.lastData = { identifier: config.identifier, data }
      instance.lastError = null
      this.sendSocketNotification('OPENWEATHER_ONECALL_DATA', instance.lastData)
      Log.debug('Sent the data back')
    }
    catch (error) {
      // fetch reports network problems only as "fetch failed"; the real reason is in the cause
      const reason = error.cause?.code ? `${error.message} (${error.cause.code})` : error.message
      Log.error(`Failed to fetch weather data for ${config.latitude},${config.longitude}: ${reason}`)
      // Send error to frontend so module doesn't stay in "Loading..." state
      instance.lastError = {
        identifier: config.identifier,
        error: reason,
        translationKey: getErrorTranslationKey(error),
      }
      this.sendSocketNotification('OPENWEATHER_ONECALL_ERROR', instance.lastError)
    }

    this.scheduleFetch(instance, config.updateInterval)
  },
})
