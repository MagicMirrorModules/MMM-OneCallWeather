import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const baseConfig = {
    apikey: 'test-key',
    apiVersion: '3.0',
    exclude: 'minutely',
    language: 'en',
    units: 'metric',
    identifier: 'weather',
    latitude: '51.5',
    longitude: '-0.1',
  },
  createNodeHelper = (fetchImpl) => {
    const debugMessages = [],
      errors = [],
      helperModule = { exports: {} },
      logger = {
        debug: message => debugMessages.push(message),
        error: message => errors.push(message),
      },
      source = readFileSync(new URL('../node_helper.js', import.meta.url), 'utf8')

    runInNewContext(source, {
      URL,
      fetch: fetchImpl,
      module: helperModule,
      process: { env: {} },
      require(name) {
        if (name === 'node_helper') {
          return { create: definition => definition }
        }
        if (name === 'logger') {
          return logger
        }
        throw new Error(`Unexpected dependency: ${name}`)
      },
    })

    return { helper: helperModule.exports, errors }
  }

describe('node helper coordinate validation', () => {
  it('should allow zero coordinates and request the API', async () => {
    const apiRequests = [],
      { helper } = createNodeHelper((url) => {
        apiRequests.push(new URL(url))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: {} }) })
      }),
      notifications = []

    await helper.socketNotificationReceived.call({
      sendSocketNotification(notification, payload) {
        notifications.push({ notification, payload })
      },
    }, 'OPENWEATHER_ONECALL_GET', {
      ...baseConfig,
      latitude: 0,
      longitude: 0,
    })

    assert.equal(apiRequests.length, 1)
    assert.equal(apiRequests[0].searchParams.get('lat'), '0')
    assert.equal(apiRequests[0].searchParams.get('lon'), '0')
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].notification, 'OPENWEATHER_ONECALL_DATA')
    assert.equal(notifications[0].payload.identifier, baseConfig.identifier)
  })

  it('should reject missing coordinates before requesting the API', async () => {
    let requestCount = 0
    const { errors, helper } = createNodeHelper(() => {
        requestCount += 1
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }),
      missingCoordinates = [false, undefined, null, ''],
      notifications = [],
      context = {
        sendSocketNotification(notification, payload) {
          notifications.push({ notification, payload })
        },
      },
      requests = []

    missingCoordinates.forEach((missingCoordinate) => {
      requests.push(
        helper.socketNotificationReceived.call(context, 'OPENWEATHER_ONECALL_GET', {
          ...baseConfig,
          latitude: missingCoordinate,
        }),
        helper.socketNotificationReceived.call(context, 'OPENWEATHER_ONECALL_GET', {
          ...baseConfig,
          longitude: missingCoordinate,
        }),
      )
    })
    await Promise.all(requests)

    assert.equal(requestCount, 0)
    assert.equal(errors.length, missingCoordinates.length * 2)
    assert.equal(notifications.length, missingCoordinates.length * 2)
    assert.ok(notifications.every(({ notification }) => notification === 'OPENWEATHER_ONECALL_ERROR'))
  })
})
