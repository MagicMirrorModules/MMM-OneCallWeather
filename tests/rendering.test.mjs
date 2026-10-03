import { byClass, byTag, loadModule } from './helpers/fakeDom.mjs'
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

const { createInstance, document } = loadModule()

const texts = elements => elements.map(element => element.textContent)
const nowSeconds = () => Math.floor(Date.now() / 1000)

const day = (n, overrides = {}) => ({
  dayOfWeek: `D${n}`, weatherIcon: '10d', minTemperature: '5.5', maxTemperature: '12', windSpeed: '7', windDirection: 180, rain: 0, snow: 0, ...overrides,
})

const current = (overrides = {}) => ({
  windSpeed: '12', windDirection: 135, humidity: 55, dailyRain: 1.26, temperature: '12.5', feelsLikeTemp: '11.2', weatherIcon: '01d', weatherDescription: 'broken clouds', alerts: [], ...overrides,
})

const forecast = (days, config) => createInstance(config, { forecast: { days } })
const block = (config, weather = current()) => createInstance(config).createCurrentWeatherBlock(weather, 6, '°C')

describe('forecast', () => {
  it('should show temperatures and amounts with the configured decimal symbol', () => {
    const table = forecast([day(0, { rain: 2.34 }), day(1, { snow: 4 }), day(2)]).createColumnsForecastTable('°C')

    assert.deepEqual(texts(table.children[0].children), ['D0', 'D1', 'D2'])
    assert.deepEqual(texts(byClass(table, 'min-temp')), ['5,5°C', '5,5°C', '5,5°C'])
    assert.deepEqual(texts(byClass(table, 'precip-rain')), ['2,3 mm', '—', '—'])
    assert.deepEqual(texts(byClass(table, 'precip-snow')), ['—', '2,0 cm', '—'])
  })

  it('should leave amount cells empty when it neither rains nor snows', () => {
    const table = forecast([day(0), day(1)]).createColumnsForecastTable('°C')

    assert.deepEqual(texts(byClass(table, 'precip-rain')), ['', ''])
    assert.deepEqual(texts(byClass(table, 'precip-snow')), ['', ''])
  })

  it('should show only the available days if more are configured', () => {
    const days = [day(0), day(1), day(2)]

    assert.equal(forecast(days, { maxDailiesToShow: 10 }).createColumnsForecastTable('°C').children[0].children.length, 3)
    assert.equal(forecast(days, { maxDailiesToShow: 10 }).createRowsForecastTable('°C').children.length, 3)
    assert.equal(forecast(days, { maxDailiesToShow: 2 }).createRowsForecastTable('°C').children.length, 2)
  })

  it('should build one row per day with a separator in the rows layout', () => {
    const table = forecast([day(0, { rain: 2.34 }), day(1)], { colored: true }).createRowsForecastTable('°C')

    assert.deepEqual(texts(table.children[0].children).slice(2, 5), ['5,5°C', '–', '12°C'])
    assert.deepEqual(texts(byClass(table, 'precip-rain')), ['2,3 mm', '—'])
    assert.deepEqual(table.children.map(row => row.className), ['vertical-row colored', 'vertical-row colored'])
  })
})

describe('current weather block', () => {
  it('should show temperature and feels like temperature with the decimal symbol', () => {
    const table = block()

    assert.equal(byClass(table, 'large')[0].textContent.trim(), '12,5°C')
    assert.ok(byTag(table, 'span').some(span => span.textContent === 'Feels like 11,2°C'))
  })

  it('should show the description only when enabled and available', () => {
    assert.equal(byClass(block(), 'weather-description')[0].textContent, 'broken clouds')
    assert.equal(byClass(block({ showDescription: false }), 'weather-description').length, 0)
    assert.equal(byClass(block({}, current({ weatherDescription: undefined })), 'weather-description').length, 0)
  })

  it('should show today\'s precipitation only when it is forecast', () => {
    const rain = table => texts(byClass(table, 'info-badge')).filter(badge => /mm|in$/.test(badge))

    assert.deepEqual(rain(block()), ['1,3 mm'])
    assert.deepEqual(rain(block({}, current({ dailyRain: 0 }))), [])
  })
})

describe('weather alerts', () => {
  const alert = (overrides = {}) => ({
    event: 'Heat Advisory', description: 'Hot\nDry', sender_name: 'DWD', start: nowSeconds() - 3600, end: nowSeconds() + 3600, ...overrides,
  })
  const links = (alerts, config) => byClass(block(config, current({ alerts })), 'weather-alert-link')

  it('should list only active alerts within the time window', () => {
    const expired = alert({ end: nowSeconds() - 60 })
    const later = alert({ start: nowSeconds() + 13 * 3600, end: nowSeconds() + 20 * 3600 })

    assert.equal(links([alert()]).length, 1)
    assert.equal(links([expired, later]).length, 0)
    assert.equal(links([later], { showAlertsHours: 24 }).length, 1)
    assert.equal(links([alert()], { showAlerts: false }).length, 0)
  })

  it('should open a popup with the details and close it by button, outside click and ESC', () => {
    links([alert()])[0].click()
    const overlay = document.body.children.at(-1)

    assert.equal(byTag(overlay, 'h2')[0].textContent, 'Heat Advisory')
    assert.equal(byTag(overlay, 'br').length, 2)
    assert.ok(byClass(overlay, 'alert-meta')[0].textContent.startsWith('Source: DWD'))

    byClass(overlay, 'alert-box')[0].click()
    assert.equal(overlay.removed, false)
    byClass(overlay, 'alert-close')[0].click()
    assert.equal(overlay.removed, true)

    links([alert()])[0].click()
    const second = document.body.children.at(-1)
    second.click({ target: second })
    assert.equal(second.removed, true)

    links([alert()])[0].click()
    const third = document.body.children.at(-1)
    document.dispatch('keydown', { key: 'Escape' })
    assert.equal(third.removed, true)
  })

  it('should show a hint when the alert has no description', () => {
    links([alert({ description: undefined })])[0].click()

    assert.equal(byTag(document.body.children.at(-1), 'p')[0].textContent, 'No details')
  })
})

describe('getDom', () => {
  const state = (config, extra) => createInstance({ apikey: 'key', ...config }, {
    loaded: true,
    errorMessage: null,
    forecast: { current: [current()], days: [day(0)] },
    ...extra,
  })

  it('should show loading and error states as plain text', () => {
    assert.equal(state({}, { loaded: false }).getDom().textContent, 'LOADING')
    assert.equal(state({}, { loaded: false, errorMessage: '<b>Failed</b>' }).getDom().textContent, '<b>Failed</b>')
    assert.equal(state({}, { forecast: { current: [], days: [] } }).getDom().textContent, 'LOADING')
  })

  it('should return the current block, the forecast or both', () => {
    assert.equal(state({ showForecast: false }).getDom().className, 'small')
    assert.equal(state({ showCurrent: false }).getDom().className, 'forecast-table small')
    assert.equal(state().getDom().className, 'weather-layout-vertical')
  })
})
