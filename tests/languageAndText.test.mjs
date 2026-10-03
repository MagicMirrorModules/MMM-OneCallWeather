import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getOpenWeatherLanguage } from '../core/utils.mjs'

describe('getOpenWeatherLanguage', () => {
  it('should keep codes that are identical in MagicMirror and OpenWeatherMap', () => {
    assert.equal(getOpenWeatherLanguage('en'), 'en')
    assert.equal(getOpenWeatherLanguage('de'), 'de')
    assert.equal(getOpenWeatherLanguage('fr'), 'fr')
  })

  it('should map codes that differ', () => {
    assert.equal(getOpenWeatherLanguage('cs'), 'cz')
    assert.equal(getOpenWeatherLanguage('ko'), 'kr')
    assert.equal(getOpenWeatherLanguage('nb'), 'no')
    assert.equal(getOpenWeatherLanguage('nn'), 'no')
    assert.equal(getOpenWeatherLanguage('pt-br'), 'pt_br')
    assert.equal(getOpenWeatherLanguage('zh-cn'), 'zh_cn')
    assert.equal(getOpenWeatherLanguage('zh-tw'), 'zh_tw')
  })

  it('should ignore the case and default to English', () => {
    assert.equal(getOpenWeatherLanguage('PT-BR'), 'pt_br')
    assert.equal(getOpenWeatherLanguage(undefined), 'en')
  })
})
