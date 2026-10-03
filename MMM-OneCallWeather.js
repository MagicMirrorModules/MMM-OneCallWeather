Module.register('MMM-OneCallWeather', {
  // Import utilities
  utils: null,

  defaults: {
    latitude: false,
    longitude: false,
    apikey: '',
    apiVersion: '3.0',
    units: config.units,
    showRainAmount: true,
    showSnowAmount: true,
    convertSnowToDepth: true,
    snowDensityFactor: 1.0,
    showWind: true,
    showWindDirection: true,
    showWindDirectionAsArrow: false,
    showWindSpeedUnit: false,
    showHumidity: true,
    showCurrentRain: true,
    showFeelsLike: true,
    showDescription: true,
    windUnits: 'mph',
    useBeaufortInCurrent: false,

    initialLoadDelay: 2500, // 2.5 seconds delay. This delay is used to keep the OpenWeather API happy.
    updateInterval: 10 * 60 * 1000, // every 10 minutes
    animationSpeed: 1000,

    decimalSymbol: '.',
    scale: false,

    tableClass: 'small',
    iconset: '4a',
    iconsetFormat: 'png',

    maxDailiesToShow: 6,
    colored: true,
    roundTemp: true,
    showCurrent: true,
    showForecast: true,
    showAlerts: true,
    showAlertsHours: 12,
    forecastLayout: 'columns', // "columns" (days as columns) or "rows" (days as rows)
    arrangement: 'vertical', // "vertical" (forecast below current) or "horizontal" (forecast next to current)
  },

  // Define required CSS files.
  getStyles() {
    return ['MMM-OneCallWeather.css']
  },

  getTranslations() {
    const languages = [
      'en', 'af', 'ar', 'az', 'bg', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'eo', 'es', 'et', 'fi', 'fr', 'fy', 'gl', 'gu',
      'he', 'hi', 'hr', 'hu', 'id', 'is', 'it', 'ja', 'ko', 'lt', 'ms-my', 'nb', 'nl', 'nn', 'pl', 'pt', 'pt-br', 'ro',
      'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'zh-cn', 'zh-tw',
    ]
    return Object.fromEntries(languages.map(language => [language, `translations/${language}.json`]))
  },

  // Define start sequence.
  async start() {
    Log.info(`Starting module: ${this.name}`)

    // Load utilities
    this.utils = await import('./core/utils.mjs')

    this.forecast = []
    this.loaded = false
    this.errorMessage = null

    // The node helper fetches periodically and pushes the results
    this.sendSocketNotification('OPENWEATHER_ONECALL_INIT', {
      identifier: this.identifier,
      apikey: this.config.apikey,
      apiVersion: this.config.apiVersion,
      latitude: this.config.latitude,
      longitude: this.config.longitude,
      units: this.config.units,
      language: this.utils.getOpenWeatherLanguage(this.config.language ?? config.language),
      initialLoadDelay: this.config.initialLoadDelay,
      updateInterval: this.config.updateInterval,
    })
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'OPENWEATHER_ONECALL_DATA' && payload.identifier === this.identifier) {
      // process weather data
      const { data } = payload
      this.forecast = this.processOnecall(data)
      this.loaded = true
      this.errorMessage = null
      this.updateDom(this.config.animationSpeed)
    }
    else if (notification === 'OPENWEATHER_ONECALL_ERROR' && payload.identifier === this.identifier) {
      Log.error(`${this.name}: Failed to fetch weather data: ${payload.error}`)
      this.errorMessage = payload.translationKey ? this.translate(payload.translationKey) : payload.error
      // Only redraw for the error state if we never managed to load data before
      if (!this.loaded) {
        this.updateDom(this.config.animationSpeed)
      }
    }
  },

  processOnecall(data) {
    const wsfactor = this.utils.getWindSpeedFactor(this.config.units, this.config.windUnits)
    const weekdayFormatter = new Intl.DateTimeFormat(config.language, { weekday: 'short', timeZone: data.timezone })
    const current = []

    if (Object.hasOwn(data, 'current')) {
      const currently = {
        windSpeed: (data.current.wind_speed * wsfactor).toFixed(0),
        windDirection: data.current.wind_deg,
        temperature: this.roundValue(data.current.temp),
        weatherIcon: data.current.weather[0].icon,
        weatherDescription: data.current.weather[0].description,
        humidity: data.current.humidity,
        feelsLikeTemp: data.current.feels_like.toFixed(1),
        dailyRain: (() => {
          const d = data.daily?.[0]
          if (!d) {
            return 0
          }
          const rain = d.rain && !Number.isNaN(d.rain) ? d.rain : 0
          const snow = d.snow && !Number.isNaN(d.snow) ? d.snow : 0
          return this.config.units === 'imperial' ? (rain + snow) / 25.4 : rain + snow
        })(),
      }

      if (Object.hasOwn(data, 'alerts')) {
        currently.alerts = data.alerts
      }
      else {
        currently.alerts = []
      }

      current.push(currently)
      Log.debug(`current weather is ${JSON.stringify(currently)}`)
    }

    const days = []
    if (Object.hasOwn(data, 'daily')) {
      for (const day of data.daily) {
        let rain = 0
        let snow = 0

        if (day.rain && !Number.isNaN(day.rain)) {
          const { rain: dayRain } = day
          if (this.config.units === 'imperial') {
            rain = dayRain / 25.4
          }
          else {
            rain = dayRain
          }
        }
        if (day.snow && !Number.isNaN(day.snow)) {
          const { snow: daySnow } = day
          if (this.config.units === 'imperial') {
            snow = daySnow / 25.4
          }
          else {
            snow = daySnow
          }
        }

        const forecastData = {
          dayOfWeek: weekdayFormatter.format(day.dt * 1000),
          minTemperature: this.roundValue(day.temp.min),
          maxTemperature: this.roundValue(day.temp.max),
          windSpeed: (day.wind_speed * wsfactor).toFixed(0),
          windDirection: day.wind_deg,
          weatherIcon: day.weather[0].icon,
          rain,
          snow,
        }

        days.push(forecastData)
      }
    }

    return { current,
      days }
  },

  // Override dom generator.
  getDom() {
    const wrapper = document.createElement('div')

    if (this.config.apikey === '') {
      wrapper.innerHTML = `Please set the correct openweather <i>apikey</i> in the config for module: ${this.name}.`
      wrapper.className = 'dimmed light small'
      return wrapper
    }

    if (!this.loaded) {
      wrapper.textContent = this.errorMessage || this.translate('LOADING')
      wrapper.className = 'dimmed light small'
      return wrapper
    }

    if (this.config.decimalSymbol === '' || this.config.decimalSymbol === ' ') {
      this.config.decimalSymbol = '.'
    }

    // Check if we have forecast data
    if (!this.forecast || !this.forecast.current || this.forecast.current.length === 0) {
      wrapper.textContent = this.translate('LOADING')
      wrapper.className = 'dimmed light small'
      return wrapper
    }

    let degreeLabel = '°'
    if (this.config.scale) {
      switch (this.config.units) {
        case 'metric':
          degreeLabel += 'C'
          break
        case 'imperial':
          degreeLabel += 'F'
          break
        default:
          degreeLabel = 'K'
          break
      }
    }

    const [currentWeather] = this.forecast.current
    const colspan = this.config.forecastLayout === 'rows' ? '6' : this.config.maxDailiesToShow
    let table = document.createElement('table')
    table.className = this.config.tableClass

    if (this.config.showCurrent) {
      table = this.createCurrentWeatherBlock(currentWeather, colspan, degreeLabel)
    }

    if (!this.config.showForecast) {
      return table
    }

    const forecastTable = this.config.forecastLayout === 'rows'
      ? this.createRowsForecastTable(degreeLabel)
      : this.createColumnsForecastTable(degreeLabel)

    if (!this.config.showCurrent) {
      return forecastTable
    }

    const weatherContainer = document.createElement('div')
    weatherContainer.className = this.config.arrangement === 'horizontal'
      ? 'weather-layout-horizontal'
      : 'weather-layout-vertical'

    weatherContainer.appendChild(table)
    weatherContainer.appendChild(forecastTable)

    return weatherContainer
  },

  // Forecast days to show and whether any of them has rain or snow (empty cells show a dash then)
  getVisibleForecastDays() {
    const days = this.forecast.days.slice(0, this.config.maxDailiesToShow)
    return {
      days,
      hasAnyRain: days.some(day => day.rain > 0),
      hasAnySnow: days.some(day => day.snow > 0),
    }
  },

  // Cells of one forecast day, shared by both layouts. "coloredCells": add the colored class to each cell instead of the row.
  createForecastCells(dailyForecast, degreeLabel, { hasAnyRain, hasAnySnow, coloredCells }) {
    const colored = coloredCells && this.config.colored ? ' colored' : ''
    const createCell = (className, ...content) => {
      const cell = document.createElement('td')
      cell.className = className + colored
      cell.append(...content.filter(Boolean))
      return cell
    }
    const amountNodes = (amount, unit) => {
      const digits = this.config.units === 'imperial' ? 2 : 1
      const unitSpan = document.createElement('span')
      unitSpan.className = 'precip-unit'
      unitSpan.textContent = unit
      return [`${this.formatAmount(amount, digits)} `, unitSpan]
    }

    const cells = {
      day: createCell('day', dailyForecast.dayOfWeek),
      icon: createCell('bright weather-icon'),
      minTemp: createCell('min-temp', `${this.localizeDecimal(dailyForecast.minTemperature)}${degreeLabel}`),
      maxTemp: createCell('bright max-temp', `${this.localizeDecimal(dailyForecast.maxTemperature)}${degreeLabel}`),
    }

    const icon = document.createElement('span')
    const iconImg = document.createElement('img')
    iconImg.className = 'forecast-icon'
    iconImg.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${dailyForecast.weatherIcon}.${this.config.iconsetFormat}`
    icon.appendChild(iconImg)
    cells.icon.appendChild(icon)

    if (this.config.showWind) {
      cells.wind = createCell('bright weather-icon')
      cells.wind.appendChild(this.createWindBadge(dailyForecast.windSpeed, dailyForecast.windDirection))
    }

    if (this.config.showRainAmount) {
      const rainContent = dailyForecast.rain > 0
        ? amountNodes(dailyForecast.rain, this.config.units === 'imperial' ? 'in' : 'mm')
        : [hasAnyRain ? '—' : '']
      cells.rain = createCell('align-right bright rain precip-rain', ...rainContent)
    }

    if (this.config.showSnowAmount) {
      let snowContent = [hasAnySnow ? '—' : '']
      if (dailyForecast.snow > 0) {
        const formatted = this.formatSnowValue(dailyForecast.snow, dailyForecast)
        snowContent = amountNodes(formatted.value, formatted.unit)
      }
      cells.snow = createCell('align-right bright snow precip-snow', ...snowContent)
    }

    return cells
  },

  // Forecast layout: "rows" - each day as a row (vertical list)
  createRowsForecastTable(degreeLabel) {
    const forecastTable = document.createElement('table')
    forecastTable.className = 'forecast-table small'

    const { days, hasAnyRain, hasAnySnow } = this.getVisibleForecastDays()

    for (const dailyForecast of days) {
      const cells = this.createForecastCells(dailyForecast, degreeLabel, { hasAnyRain, hasAnySnow, coloredCells: false })

      const row = document.createElement('tr')
      row.className = 'vertical-row'
      if (this.config.colored) {
        row.className += ' colored'
      }
      forecastTable.appendChild(row)

      const tempSepCell = document.createElement('td')
      tempSepCell.className = 'temp-sep dimmed'
      tempSepCell.textContent = '–'

      for (const cell of [cells.day, cells.icon, cells.minTemp, tempSepCell, cells.maxTemp, cells.wind, cells.rain, cells.snow]) {
        if (cell) {
          row.appendChild(cell)
        }
      }
    }

    return forecastTable
  },

  // Forecast layout: "columns" - each day as a column
  createColumnsForecastTable(degreeLabel) {
    const forecastTable = document.createElement('table')
    forecastTable.className = 'forecast-table small'

    const rowNames = ['day', 'icon', 'maxTemp', 'minTemp']
    if (this.config.showWind) {
      rowNames.push('wind')
    }
    if (this.config.showRainAmount) {
      rowNames.push('rain')
    }
    if (this.config.showSnowAmount) {
      rowNames.push('snow')
    }
    const rows = Object.fromEntries(rowNames.map(name => [name, document.createElement('tr')]))

    const { days, hasAnyRain, hasAnySnow } = this.getVisibleForecastDays()

    for (const dailyForecast of days) {
      const cells = this.createForecastCells(dailyForecast, degreeLabel, { hasAnyRain, hasAnySnow, coloredCells: true })
      for (const name of rowNames) {
        rows[name].appendChild(cells[name])
      }
    }

    for (const name of rowNames) {
      forecastTable.appendChild(rows[name])
    }

    return forecastTable
  },

  // Helper method to create current weather block (reduces code duplication)
  createCurrentWeatherBlock(currentWeather, colspan, degreeLabel) {
    const table = document.createElement('table')
    table.className = this.config.tableClass

    // Row 1: Wind information
    const currentRow1 = document.createElement('tr')
    const currentCell1 = document.createElement('td')
    currentCell1.colSpan = colspan
    currentCell1.className = 'current'

    const windContainer = document.createElement('div')
    windContainer.className = 'wind-container normal medium'

    const windGroup = document.createElement('span')
    windGroup.className = 'info-badge dimmed'

    const windIcon = document.createElement('img')
    windIcon.className = 'ui-icon ui-icon-wind'
    windIcon.src = 'modules/MMM-OneCallWeather/icons/ui/wind.svg'
    windGroup.appendChild(windIcon)

    const windySpeed = document.createElement('span')
    if (this.config.useBeaufortInCurrent) {
      windySpeed.textContent = `F${this.mph2Beaufort(currentWeather.windSpeed)}`
    }
    else {
      const unitLabel = this.config.showWindSpeedUnit ? `\u00a0${this.getWindSpeedLabel()}` : ''
      windySpeed.textContent = `${currentWeather.windSpeed}${unitLabel}`
    }
    windGroup.appendChild(windySpeed)

    if (this.config.showWindDirection) {
      const windyDirection = document.createElement('sup')
      if (this.config.showWindDirectionAsArrow) {
        const arrow = document.createElement('i')
        arrow.className = 'fa fa-long-arrow-down'
        arrow.style.transform = `rotate(${currentWeather.windDirection}deg)`
        windyDirection.append(' \u00a0', arrow, '\u00a0')
      }
      else {
        windyDirection.textContent = `\u00a0${this.cardinalWindDirection(currentWeather.windDirection)}`
      }
      windGroup.appendChild(windyDirection)
    }

    windContainer.appendChild(windGroup)

    if (this.config.showHumidity) {
      const humidityContainer = document.createElement('span')
      humidityContainer.className = 'info-badge dimmed'

      const humidityIcon = document.createElement('img')
      humidityIcon.className = 'ui-icon ui-icon-humidity'
      humidityIcon.src = 'modules/MMM-OneCallWeather/icons/ui/humidity.svg'
      humidityContainer.appendChild(humidityIcon)

      const humidityValue = document.createElement('span')
      humidityValue.textContent = `${currentWeather.humidity}%`
      humidityContainer.appendChild(humidityValue)

      windContainer.appendChild(humidityContainer)
    }

    if (this.config.showCurrentRain && currentWeather.dailyRain > 0) {
      const rainContainer = document.createElement('span')
      rainContainer.className = 'info-badge dimmed'

      const rainIcon = document.createElement('img')
      rainIcon.className = 'ui-icon'
      rainIcon.src = 'modules/MMM-OneCallWeather/icons/ui/rain.svg'
      rainContainer.appendChild(rainIcon)

      const rainValue = document.createElement('span')
      const amount = currentWeather.dailyRain
      rainValue.textContent = this.config.units === 'imperial'
        ? `${this.formatAmount(amount, 2)} in`
        : `${this.formatAmount(amount, 1)} mm`
      rainContainer.appendChild(rainValue)

      windContainer.appendChild(rainContainer)
    }

    currentCell1.appendChild(windContainer)
    currentRow1.appendChild(currentCell1)
    table.appendChild(currentRow1)

    // Row 2: Weather icon and temperature
    const currentRow2 = document.createElement('tr')
    const currentCell2 = document.createElement('td')
    currentCell2.colSpan = colspan
    currentCell2.className = 'current'

    const largeWeatherIcon = document.createElement('div')
    largeWeatherIcon.className = 'large-weather-icon-container light'

    const weatherIcon = document.createElement('img')
    weatherIcon.className = 'weathericon'
    weatherIcon.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${currentWeather.weatherIcon}.${this.config.iconsetFormat}`
    largeWeatherIcon.appendChild(weatherIcon)

    let elementType = 'span'
    if (this.config.forecastLayout === 'rows') {
      elementType = 'div'
    }
    const currTemperature = document.createElement(elementType)
    currTemperature.className = 'large bright'
    currTemperature.textContent = ` ${this.localizeDecimal(currentWeather.temperature)}${degreeLabel}`

    largeWeatherIcon.appendChild(currTemperature)
    currentCell2.appendChild(largeWeatherIcon)

    if (this.config.showDescription && currentWeather.weatherDescription) {
      const description = document.createElement('div')
      description.className = 'weather-description small dimmed'
      description.textContent = currentWeather.weatherDescription
      currentCell2.appendChild(description)
    }
    currentRow2.appendChild(currentCell2)
    table.appendChild(currentRow2)

    // Row 3: Feels like temperature
    const currentRow3 = document.createElement('tr')
    const currentCell3 = document.createElement('td')
    currentCell3.colSpan = colspan
    currentCell3.className = 'current'

    if (this.config.showFeelsLike) {
      const feelsLikeContainer = document.createElement('div')
      feelsLikeContainer.className = 'wind-container small dimmed'
      const currFeelsLike = document.createElement('span')
      currFeelsLike.className = 'small dimmed'

      const feelsLikeString = this.translate('FEELS')
      const feelsLikeText = feelsLikeString.replace('{DEGREE}', `${this.localizeDecimal(currentWeather.feelsLikeTemp)}${degreeLabel}`)
      currFeelsLike.textContent = feelsLikeText
      feelsLikeContainer.appendChild(currFeelsLike)
      currentCell3.appendChild(feelsLikeContainer)
    }

    currentRow3.appendChild(currentCell3)
    table.appendChild(currentRow3)

    // Row 4: Current weather alerts
    if (this.config.showAlerts && currentWeather.alerts.length > 0) {
      const currentRow4 = document.createElement('tr')
      const currentCell4 = document.createElement('td')
      currentCell4.colSpan = colspan
      currentCell4.className = 'alert'

      const now = Date.now() / 1000
      const alertWindow = now + (this.config.showAlertsHours * 3600)

      const validAlerts = currentWeather.alerts
        .filter(alert =>
          alert?.event
          && alert.start < alertWindow // Starts within the configured time window
          && alert.end > now, // Is still active (not expired)
        )
        .map(alert => ({
          event: alert.event,
          description: alert.description,
          start: alert.start,
          end: alert.end,
          sender: alert.sender_name,
        }))

      if (validAlerts.length > 0) {
        const fragment = document.createDocumentFragment()

        for (const [index, alert] of validAlerts.entries()) {
          if (index > 0) {
            fragment.appendChild(document.createElement('br'))
          }

          const span = document.createElement('span')
          const startTime = this.formatAlertTime(alert.start)
          const endTime = this.formatAlertTime(alert.end)

          span.textContent = `${this.translate(alert.event)} (${startTime} - ${endTime})`
          span.className = 'weather-alert-link'

          span.addEventListener('click', () => {
            this.showAlertPopup(alert)
          })

          fragment.appendChild(span)
        }

        currentCell4.appendChild(fragment)
        currentRow4.appendChild(currentCell4)
        table.appendChild(currentRow4)
      }
    }

    return table
  },

  cardinalWindDirection(windDir) {
    return this.utils.cardinalWindDirection(windDir)
  },

  getWindSpeedLabel() {
    return this.utils.getWindSpeedLabel(this.config.windUnits)
  },

  // Create a wind badge with centered speed value and compass direction indicator
  createWindBadge(speed, directionDeg) {
    const container = document.createElement('div')
    container.className = 'wind-badge'

    const compass = document.createElement('div')
    compass.className = 'wind-compass'
    compass.style.transform = `rotate(${directionDeg}deg)`
    container.appendChild(compass)

    const value = document.createElement('span')
    value.className = 'wind-value'
    value.textContent = speed
    container.appendChild(value)

    return container
  },

  roundValue(temperature) {
    return this.utils.roundValue(temperature, this.config.roundTemp)
  },

  localizeDecimal(value) {
    return this.utils.localizeDecimal(value, this.config.decimalSymbol)
  },

  formatAmount(value, digits) {
    return this.localizeDecimal(parseFloat(value).toFixed(digits))
  },

  /*
   * mph2Beaufort(mph)
   * Converts mph to beaufort (windspeed).
   *
   * see:
   *  https://www.spc.noaa.gov/faq/tornado/beaufort.html
   *  https://en.wikipedia.org/wiki/Beaufort_scale#Modern_scale
   *
   * argument mph number - Windspeed in mph.
   *
   * return number - Windspeed in beaufort.
   */
  mph2Beaufort(mph) {
    return this.utils.mph2Beaufort(mph)
  },
  getAlertLocale() {
    if (this.config.language) {
      return this.config.language
    }
    return typeof config === 'undefined' ? null : config.language
  },
  formatAlertTime(timestampSeconds) {
    if (!timestampSeconds) {
      return '--'
    }
    const locale = this.getAlertLocale()
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestampSeconds * 1000))
  },
  formatAlertDateTime(timestampSeconds) {
    if (!timestampSeconds) {
      return '--'
    }
    const locale = this.getAlertLocale()
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestampSeconds * 1000))
  },
  showAlertPopup(alert) {
    // Create overlay
    const overlay = document.createElement('div')
    overlay.className = 'alert-overlay'
    const escapeController = new AbortController()
    const removeOverlay = () => {
      overlay.remove()
      escapeController.abort()
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        removeOverlay()
      }
    }
    // Make sure it blocks all clicks to underlying modules
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100vw'
    overlay.style.height = '100vh'
    overlay.style.zIndex = '99999' // on top of everything
    overlay.style.pointerEvents = 'auto' // ensure overlay captures all clicks
    // Stop clicks inside overlay from propagating
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        removeOverlay() // clicking outside the box closes
      }
    })
    // Close on ESC key for keyboard/mouse users
    document.addEventListener('keydown', handleEscape, { signal: escapeController.signal })
    // Create alert box
    const box = document.createElement('div')
    box.className = 'alert-box'
    const title = document.createElement('h2')
    title.textContent = this.translate(alert.event)
    const description = document.createElement('p')
    if (alert.description) {
      const lines = alert.description.split('\n')
      lines.forEach((line, index) => {
        if (index > 0) {
          description.appendChild(document.createElement('br'))
        }
        description.appendChild(document.createTextNode(line))
      })
    }
    else {
      description.textContent = this.translate('ALERT_NO_DETAILS')
    }

    const meta = document.createElement('p')
    meta.className = 'alert-meta'
    meta.appendChild(document.createTextNode(`${this.translate('ALERT_SOURCE')}: ${alert.sender || 'NWS'}`))
    meta.appendChild(document.createElement('br'))
    meta.appendChild(document.createTextNode(`${this.translate('ALERT_VALID')}: ${this.formatAlertDateTime(alert.start)} – ${this.formatAlertDateTime(alert.end)}`))
    const closeButton = document.createElement('div')
    closeButton.className = 'alert-close'
    closeButton.textContent = this.translate('ALERT_CLOSE')
    // Prevent clicks inside the box from bubbling to overlay
    box.addEventListener('click', e => e.stopPropagation())
    closeButton.addEventListener('click', removeOverlay)
    box.appendChild(title)
    box.appendChild(description)
    box.appendChild(meta)
    box.appendChild(closeButton)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
  },

  formatSnowValue(snowMm, dailyForecast) {
    return this.utils.formatSnowValue(snowMm, dailyForecast, {
      units: this.config.units,
      convertSnowToDepth: this.config.convertSnowToDepth,
      snowDensityFactor: this.config.snowDensityFactor,
    })
  },
})
