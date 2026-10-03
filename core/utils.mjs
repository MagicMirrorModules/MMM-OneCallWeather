/**
 * Pure utility functions for weather data processing.
 * These functions have no side effects and can be tested independently.
 */

/**
 * Converts mph to Beaufort scale (wind speed).
 *
 * @see https://www.spc.noaa.gov/faq/tornado/beaufort.html
 * @see https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
 *
 * @param {number} mph - Wind speed in mph.
 * @returns {number} Wind speed in Beaufort scale (0-12).
 */
export function mph2Beaufort(mph) {
  const kmh = mph * 1.60934
  const speeds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117, 1000]
  for (const [beaufort, speed] of speeds.entries()) {
    if (speed > kmh) {
      return beaufort
    }
  }
  return 12
}

/**
 * Get wind speed conversion factor based on API units and desired display units.
 *
 * OpenWeatherMap API returns wind speed in different units depending on the units parameter:
 * - units: "imperial" → wind speed in mph
 * - units: "metric" or "standard" → wind speed in m/s
 *
 * @param {string} apiUnits - API units parameter ("imperial", "metric", or "standard").
 * @param {string} windUnits - Desired wind speed units ("mph", "kmph", "ms", or "knots").
 * @returns {number} Conversion factor to multiply API wind speed with.
 */
export function getWindSpeedFactor(apiUnits, windUnits) {
  const apiUnitsImperial = apiUnits === 'imperial'

  if (apiUnitsImperial) {
    // API returns mph, convert to desired unit
    if (windUnits === 'kmph') {
      // Mph to km/h
      return 1.60934
    }
    if (windUnits === 'ms') {
      // Mph to m/s
      return 0.44704
    }
    if (windUnits === 'knots') {
      // Mph to knots
      return 0.868976
    }
    // WindUnits === "mph": no conversion needed
    return 1
  }

  // API returns m/s, convert to desired unit
  if (windUnits === 'mph') {
    // M/s to mph
    return 2.237
  }
  if (windUnits === 'kmph') {
    // M/s to km/h
    return 3.6
  }
  if (windUnits === 'knots') {
    // M/s to knots
    return 1.94384
  }
  // WindUnits === "ms": no conversion needed
  return 1
}

/**
 * Get the display label for a wind speed unit.
 *
 * @param {string} windUnits - Wind speed unit ("mph", "kmph", "ms", or "knots").
 * @returns {string} Human-readable label for the unit.
 */
export function getWindSpeedLabel(windUnits) {
  const labels = {
    mph: 'mph',
    kmph: 'km/h',
    ms: 'm/s',
    knots: 'kts',
  }
  return labels[windUnits] ?? windUnits
}

/**
 * Round temperature value based on configuration.
 *
 * @param {number} temperature - Temperature value to round.
 * @param {boolean} roundTemp - Whether to round to integer (true) or 1 decimal (false).
 * @returns {string} Rounded temperature as string.
 */
export function roundValue(temperature, roundTemp) {
  const decimals = roundTemp ? 0 : 1
  return parseFloat(temperature).toFixed(decimals)
}

// OpenWeatherMap uses some country codes and POSIX-style codes where MagicMirror uses ISO 639-1/BCP 47.
const OPENWEATHER_LANGUAGES = {
  'cs': 'cz',
  'ko': 'kr',
  'nb': 'no',
  'nn': 'no',
  'pt-br': 'pt_br',
  'zh-cn': 'zh_cn',
  'zh-tw': 'zh_tw',
}

/**
 * Convert a MagicMirror language code to the code OpenWeatherMap expects for the lang parameter.
 *
 * @param {string} [language] - MagicMirror language code, e.g. "cs" or "pt-br".
 * @returns {string} OpenWeatherMap language code. Unsupported languages fall back to English on the API side.
 */
export function getOpenWeatherLanguage(language) {
  const code = String(language ?? 'en').toLowerCase()
  return OPENWEATHER_LANGUAGES[code] ?? code
}

/**
 * Replace the decimal point of a formatted number with the configured symbol.
 *
 * @param {number|string} value - Number or formatted number string.
 * @param {string} decimalSymbol - Symbol to use as decimal separator.
 * @returns {string} Number string with the given decimal symbol.
 */
export function localizeDecimal(value, decimalSymbol) {
  return String(value).replace('.', decimalSymbol)
}

/**
 * Convert wind direction in degrees to cardinal direction abbreviation.
 *
 * @param {number} windDir - Wind direction in degrees (0-360).
 * @returns {string} Cardinal direction (N, NNE, NE, etc.).
 */
export function cardinalWindDirection(windDir) {
  if (windDir > 11.25 && windDir <= 33.75) {
    return 'NNE'
  }
  if (windDir > 33.75 && windDir <= 56.25) {
    return 'NE'
  }
  if (windDir > 56.25 && windDir <= 78.75) {
    return 'ENE'
  }
  if (windDir > 78.75 && windDir <= 101.25) {
    return 'E'
  }
  if (windDir > 101.25 && windDir <= 123.75) {
    return 'ESE'
  }
  if (windDir > 123.75 && windDir <= 146.25) {
    return 'SE'
  }
  if (windDir > 146.25 && windDir <= 168.75) {
    return 'SSE'
  }
  if (windDir > 168.75 && windDir <= 191.25) {
    return 'S'
  }
  if (windDir > 191.25 && windDir <= 213.75) {
    return 'SSW'
  }
  if (windDir > 213.75 && windDir <= 236.25) {
    return 'SW'
  }
  if (windDir > 236.25 && windDir <= 258.75) {
    return 'WSW'
  }
  if (windDir > 258.75 && windDir <= 281.25) {
    return 'W'
  }
  if (windDir > 281.25 && windDir <= 303.75) {
    return 'WNW'
  }
  if (windDir > 303.75 && windDir <= 326.25) {
    return 'NW'
  }
  if (windDir > 326.25 && windDir <= 348.75) {
    return 'NNW'
  }
  return 'N'
}

/**
 * Calculates snow-to-water ratio based on temperature.
 * Provides a scientific estimate of how much snow depth results
 * from a given amount of liquid water equivalent.
 *
 * Temperature ranges based on research:
 * - Below -15°C: Very light, fluffy powder snow (ratio: 20:1)
 * - -15°C to -10°C: Light powder snow (ratio: 15:1)
 * - -10°C to -5°C: Dry snow (ratio: 12:1)
 * - -5°C to 0°C: Normal snow (ratio: 10:1)
 * - 0°C to +2°C: Wet, heavy snow (ratio: 6:1)
 * - Above +2°C: Very wet snow (ratio: 5:1)
 *
 * @param {number} tempCelsius - Temperature in Celsius.
 * @param {number} snowDensityFactor - User-configured density multiplier.
 * @returns {number} Snow depth multiplier adjusted by density factor.
 */
export function getSnowDepthRatio(tempCelsius, snowDensityFactor) {
  // Default ratio for temperatures >= 2°C (very wet/slushy snow)
  let baseRatio = 5

  if (tempCelsius < -15) {
    baseRatio = 20
  }
  else if (tempCelsius < -10) {
    baseRatio = 15
  }
  else if (tempCelsius < -5) {
    baseRatio = 12
  }
  else if (tempCelsius < 0) {
    baseRatio = 10
  }
  else if (tempCelsius < 2) {
    baseRatio = 6
  }

  return baseRatio * snowDensityFactor
}

/**
 * Formats a snow precipitation value for display,
 * optionally converting water equivalent to snow depth.
 *
 * @param {number} snowMm - Snow amount in mm (metric) or inches (imperial) - water equivalent.
 * @param {{ maxTemperature: number, minTemperature: number }} dailyForecast - Daily forecast with temperatures.
 * @param {{ units: string, convertSnowToDepth: boolean, snowDensityFactor: number }} config - Relevant config values.
 * @returns {{ value: number, unit: string }} Formatted snow value and unit.
 */
export function formatSnowValue(snowMm, dailyForecast, { units, convertSnowToDepth, snowDensityFactor }) {
  let snowValue = snowMm
  let unit = units === 'imperial' ? 'in' : 'mm'

  if (convertSnowToDepth) {
    // Calculate average temperature in Celsius for ratio calculation
    const avgTemp = (dailyForecast.maxTemperature + dailyForecast.minTemperature) / 2
    // Temperatures from imperial API are in Fahrenheit, convert to Celsius
    const avgTempCelsius = units === 'imperial' ? (avgTemp - 32) * (5 / 9) : avgTemp
    const ratio = getSnowDepthRatio(avgTempCelsius, snowDensityFactor)

    if (units === 'imperial') {
      // SnowValue is in inches (water equivalent)
      // Inches water × ratio = inches snow depth
      snowValue *= ratio
      unit = 'in'
    }
    else {
      // SnowValue is in mm (water equivalent)
      // Mm water × ratio = mm snow depth → convert to cm
      snowValue = (snowValue * ratio) / 10
      unit = 'cm'
    }
  }

  return { value: snowValue, unit }
}
