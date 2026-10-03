import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { localizeDecimal } from '../core/utils.mjs'

describe('localizeDecimal', () => {
  it('should replace the decimal point with the given symbol', () => {
    assert.equal(localizeDecimal('23.5', ','), '23,5')
    assert.equal(localizeDecimal(-5.7, ','), '-5,7')
  })

  it('should keep the default symbol', () => {
    assert.equal(localizeDecimal('23.5', '.'), '23.5')
  })

  it('should leave integers untouched', () => {
    assert.equal(localizeDecimal('24', ','), '24')
    assert.equal(localizeDecimal(0, ','), '0')
  })
})
