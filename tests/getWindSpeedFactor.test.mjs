import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getWindSpeedFactor } from '../core/utils.mjs'

const conversionCases = [
  ['imperial', 'mph', 1],
  ['imperial', 'kmph', 1.60934],
  ['imperial', 'ms', 0.44704],
  ['imperial', 'knots', 0.868976],
  ['metric', 'mph', 2.237],
  ['metric', 'kmph', 3.6],
  ['metric', 'ms', 1],
  ['metric', 'knots', 1.94384],
  ['standard', 'mph', 2.237],
  ['standard', 'kmph', 3.6],
  ['standard', 'ms', 1],
  ['standard', 'knots', 1.94384],
]

describe('getWindSpeedFactor', () => {
  for (const [apiUnits, windUnits, expectedFactor] of conversionCases) {
    it(`should return ${expectedFactor} for ${apiUnits} API units to ${windUnits}`, () => {
      assert.equal(getWindSpeedFactor(apiUnits, windUnits), expectedFactor)
    })
  }

  it('should not double imperial wind speed when display units are mph (Issue #30)', () => {
    const apiWindSpeed = 18,
      result = apiWindSpeed * getWindSpeedFactor('imperial', 'mph')

    assert.equal(result, 18)
  })
})
