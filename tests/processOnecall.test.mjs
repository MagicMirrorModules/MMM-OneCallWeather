import * as utils from '../core/utils.mjs'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

let moduleDefinition

const createCurrentWeather = (overrides = {}) => ({
    dt: 1704110400,
    // eslint-disable-next-line camelcase
    wind_speed: 5,
    // eslint-disable-next-line camelcase
    wind_deg: 90,
    sunrise: 1704090000,
    sunset: 1704130000,
    temp: 12.6,
    weather: [{ icon: '01d' }],
    humidity: 55,
    // eslint-disable-next-line camelcase
    feels_like: 11.2,
    ...overrides,
  }),
  processWeatherData = (data, config = {}) => {
    const instance = {
      config: {
        units: 'metric',
        windUnits: 'kmph',
        roundTemp: true,
        ...config,
      },
      utils,
      roundValue: moduleDefinition.roundValue,
      convertWeatherType: moduleDefinition.convertWeatherType,
    }

    return moduleDefinition.processOnecall.call(instance, data)
  },
  source = readFileSync(new URL('../MMM-OneCallWeather.js', import.meta.url), 'utf8')

runInNewContext(source, {
  config: { language: 'en-US', units: 'metric' },
  Log: { debug: () => null },
  Module: {
    register(name, definition) {
      moduleDefinition = definition
    },
  },
})

describe('processOnecall', () => {
  it('should convert current and daily values using metric units', () => {
    const apiTimestamp = 1704110400,
      result = processWeatherData({
        // eslint-disable-next-line camelcase
        timezone_offset: 3600,
        current: createCurrentWeather({
          rain: { '1h': 2 },
          snow: { '1h': 1 },
        }),
        daily: [{
          dt: apiTimestamp,
          sunrise: 1704090000,
          sunset: 1704130000,
          temp: { min: 5.4, max: 14.6 },
          humidity: 60,
          // eslint-disable-next-line camelcase
          wind_speed: 2,
          // eslint-disable-next-line camelcase
          wind_deg: 180,
          // eslint-disable-next-line camelcase
          feels_like: { day: 10 },
          weather: [{ icon: '10d' }],
          rain: 4,
          snow: 2,
        }],
      })

    assert.equal(result.current[0].date.toISOString(), new Date((apiTimestamp + 3600) * 1000).toISOString())
    assert.equal(result.current[0].temperature, '13')
    assert.equal(result.current[0].windSpeed, '18')
    assert.equal(result.current[0].precipitation, 3)
    assert.equal(result.current[0].dailyRain, 6)
    assert.equal(result.days[0].minTemperature, '5')
    assert.equal(result.days[0].maxTemperature, '15')
    assert.equal(result.days[0].windSpeed, '7')
    assert.equal(result.days[0].rain, 4)
    assert.equal(result.days[0].snow, 2)
    assert.equal(result.days[0].weatherType, 'day-rain')
  })

  it('should default missing precipitation values to zero', () => {
    const result = processWeatherData({
      // eslint-disable-next-line camelcase
      timezone_offset: 0,
      current: createCurrentWeather(),
    })

    assert.equal(result.current[0].precipitation, 0)
    assert.equal(result.current[0].dailyRain, 0)
    assert.equal(result.days.length, 0)
  })
})
