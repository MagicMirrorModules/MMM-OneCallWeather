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
    showWindSpeedUnit: false,
    showHumidity: true,
    showCurrentRain: true,
    showFeelsLike: true,
    tempUnits: 'c',
    windUnits: 'mph',
    useBeaufortInCurrent: false,

    initialLoadDelay: 2500, // 2.5 seconds delay. This delay is used to keep the OpenWeather API happy.
    updateInterval: 10 * 60 * 1000, // every 10 minutes
    animationSpeed: 1000,
    updateFadeSpeed: 500,
    requestDelay: 0,

    decimalSymbol: '.',
    fade: true,
    scale: false,
    exclude: 'minutely',

    tableClass: 'small',
    iconset: '4a',
    iconsetFormat: 'png',

    onlyTemp: false,
    maxHourliesToShow: 30,
    maxDailiesToShow: 6,
    colored: true,
    roundTemp: true,
    showCurrent: true,
    showForecast: true,
    showAlerts: true,
    showAlertsHours: 12,
    forecastLayout: 'columns', // "columns" (days as columns) or "rows" (days as rows)
    arrangement: 'vertical', // "vertical" (forecast below current) or "horizontal" (forecast next to current)

    labelOrdinals: [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ],
    moduleTimestampIdPrefix: 'OPENWEATHER_ONE_CALL_TIMESTAMP_',
  },

  // create a variable for the first upcoming calendar event. Used if no location is specified.
  firstEvent: false,

  // Define required CSS files.
  getStyles() {
    return ['MMM-OneCallWeather.css']
  },

  // Define start sequence.
  async start() {
    Log.info(`Starting module: ${this.name}`)

    // Load utilities
    this.utils = await import('./core/utils.mjs')

    this.forecast = []
    this.loaded = false
    this.errorMessage = null
    this.scheduleUpdate(this.config.initialLoadDelay)
    this.updateTimer = null
  },

  scheduleUpdate(delay) {
    let nextLoad = this.config.updateInterval
    if (typeof delay !== 'undefined' && delay >= 0) {
      nextLoad = delay
    }

    const that = this
    clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(() => {
      that.updateWeather()
    }, nextLoad)
  },

  updateWeather() {
    this.sendSocketNotification('OPENWEATHER_ONECALL_GET', {
      identifier: this.identifier,
      apikey: this.config.apikey,
      apiVersion: this.config.apiVersion,
      exclude: this.config.exclude,
      latitude: this.config.latitude,
      longitude: this.config.longitude,
      units: this.config.units,
      language: this.config.language,
      requestDelay: this.config.requestDelay,
    })
  },

  socketNotificationReceived(notification, payload) {
    if (notification === 'OPENWEATHER_ONECALL_DATA' && payload.identifier === this.identifier) {
      // process weather data
      const { data } = payload
      this.forecast = this.processOnecall(data)
      this.loaded = true
      this.errorMessage = null
      this.updateDom()
      this.scheduleUpdate()
    }
    else if (notification === 'OPENWEATHER_ONECALL_ERROR' && payload.identifier === this.identifier) {
      Log.error(`${this.name}: Failed to fetch weather data: ${payload.error}`)
      this.errorMessage = payload.error
      // Only redraw for the error state if we never managed to load data before
      if (!this.loaded) {
        this.updateDom()
      }
      // Retry on the normal schedule instead of getting stuck
      this.scheduleUpdate()
    }
  },

  processOnecall(data) {
    const wsfactor = this.utils.getWindSpeedFactor(this.config.units, this.config.windUnits)
    const weekdayFormatter = new Intl.DateTimeFormat(config.language, { weekday: 'short' })
    const current = []

    if (Object.hasOwn(data, 'current')) {
      const currently = {
        date: new Date((data.current.dt + data.timezone_offset) * 1000),
        dayOfWeek: weekdayFormatter.format(data.current.dt),
        windSpeed: (data.current.wind_speed * wsfactor).toFixed(0),
        windDirection: data.current.wind_deg,
        sunrise: new Date((data.current.sunrise + data.timezone_offset) * 1000),
        sunset: new Date((data.current.sunset + data.timezone_offset) * 1000),
        temperature: this.roundValue(data.current.temp),
        weatherIcon: data.current.weather[0].icon,
        weatherType: this.convertWeatherType(data.current.weather[0].icon),
        humidity: data.current.humidity,
        feelsLikeTemp: data.current.feels_like.toFixed(1),
        precipitation: this.config.units === 'imperial'
          ? ((data.current.rain?.['1h'] || 0) + (data.current.snow?.['1h'] || 0)) / 25.4
          : (data.current.rain?.['1h'] || 0) + (data.current.snow?.['1h'] || 0),
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

    // get hourly weather, if requested
    const hours = []
    this.hourForecast = []
    let forecastData

    if (Object.hasOwn(data, 'hourly')) {
      for (const hour of data.hourly) {
        let rain = 0
        let snow = 0

        if (
          Object.hasOwn(hour, 'rain')
          && !Number.isNaN(hour.rain['1h'])
        ) {
          if (this.config.units === 'imperial') {
            rain = hour.rain['1h'] / 25.4
          }
          else {
            rain = hour.rain['1h']
          }
        }
        if (
          Object.hasOwn(hour, 'snow')
          && !Number.isNaN(hour.snow['1h'])
        ) {
          if (this.config.units === 'imperial') {
            snow = hour.snow['1h'] / 25.4
          }
          else {
            snow = hour.snow['1h']
          }
        }

        forecastData = {
          date: new Date((hour.dt + data.timezone_offset) * 1000),
          temperature: hour.temp,
          humidity: hour.humidity,
          windSpeed: hour.wind_speed,
          windDirection: hour.wind_deg,
          feelsLikeTemp: hour.feels_like.day,
          weatherIcon: hour.weather[0].icon,
          weatherType: this.convertWeatherType(hour.weather[0].icon),
          rain,
          snow,
        }
        hours.push(forecastData)
      }
    }

    // get daily weather, if requested
    this.dayForecast = []

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

        forecastData = {
          dayOfWeek: weekdayFormatter.format(day.dt * 1000),
          date: new Date((day.dt + data.timezone_offset) * 1000),
          sunrise: new Date((day.sunrise + data.timezone_offset) * 1000),
          sunset: new Date((day.sunset + data.timezone_offset) * 1000),
          minTemperature: this.roundValue(day.temp.min),
          maxTemperature: this.roundValue(day.temp.max),
          humidity: day.humidity,
          windSpeed: (day.wind_speed * wsfactor).toFixed(0),
          windDirection: day.wind_deg,
          feelsLikeTemp: day.feels_like.day,
          weatherIcon: day.weather[0].icon,
          weatherType: this.convertWeatherType(day.weather[0].icon),
          rain,
          snow,
        }

        days.push(forecastData)
      }
    }

    return { current,
      hours,
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
      wrapper.innerHTML = this.errorMessage
        ? `Error loading weather data: ${this.errorMessage}`
        : this.translate('LOADING')
      wrapper.className = 'dimmed light small'
      return wrapper
    }

    if (this.config.decimalSymbol === '' || this.config.decimalSymbol === ' ') {
      this.config.decimalSymbol = '.'
    }

    // Check if we have forecast data
    if (!this.forecast || !this.forecast.current || this.forecast.current.length === 0) {
      wrapper.innerHTML = this.translate('LOADING')
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

  // Forecast layout: "rows" - each day as a row (vertical list)
  createRowsForecastTable(degreeLabel) {
    const forecastTable = document.createElement('table')
    forecastTable.className = 'forecast-table small'

    const hasAnyRain = this.forecast.days.slice(0, this.config.maxDailiesToShow).some(day => day.rain > 0)
    const hasAnySnow = this.forecast.days.slice(0, this.config.maxDailiesToShow).some(day => day.snow > 0)

    for (let i = 0; i < this.config.maxDailiesToShow; i += 1) {
      const dailyForecast = this.forecast.days[i]

      const row = document.createElement('tr')
      row.className = 'vertical-row'
      if (this.config.colored) {
        row.className += ' colored'
      }
      forecastTable.appendChild(row)

      const dayCell = document.createElement('td')
      dayCell.className = 'day'
      dayCell.innerHTML = dailyForecast.dayOfWeek
      row.appendChild(dayCell)

      const iconCell = document.createElement('td')
      iconCell.className = 'bright weather-icon'
      const icon = document.createElement('span')
      const iconImg = document.createElement('img')
      iconImg.className = 'forecast-icon'
      iconImg.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${dailyForecast.weatherIcon}.${this.config.iconsetFormat}`
      icon.appendChild(iconImg)
      iconCell.appendChild(icon)
      row.appendChild(iconCell)

      const minTempCell = document.createElement('td')
      minTempCell.innerHTML = `${dailyForecast.minTemperature}${degreeLabel}`
      minTempCell.className = 'min-temp'
      row.appendChild(minTempCell)

      const tempSepCell = document.createElement('td')
      tempSepCell.className = 'temp-sep dimmed'
      tempSepCell.textContent = '–'
      row.appendChild(tempSepCell)

      const maxTempCell = document.createElement('td')
      maxTempCell.innerHTML = `${dailyForecast.maxTemperature}${degreeLabel}`
      maxTempCell.className = 'bright max-temp'
      row.appendChild(maxTempCell)

      if (this.config.showWind) {
        const windCell = document.createElement('td')
        windCell.className = 'bright weather-icon'
        windCell.appendChild(this.createWindBadge(dailyForecast.windSpeed, dailyForecast.windDirection))
        row.appendChild(windCell)
      }

      if (this.config.showRainAmount) {
        const rainCell = document.createElement('td')
        if (dailyForecast.rain > 0) {
          rainCell.innerHTML = this.config.units === 'imperial'
            ? `${parseFloat(dailyForecast.rain).toFixed(2)} <span class="precip-unit">in</span>`
            : `${parseFloat(dailyForecast.rain).toFixed(1)} <span class="precip-unit">mm</span>`
        }
        else if (hasAnyRain) {
          rainCell.innerHTML = '—'
        }
        rainCell.className = 'align-right bright rain precip-rain'
        row.appendChild(rainCell)
      }

      if (this.config.showSnowAmount) {
        const snowCell = document.createElement('td')
        if (dailyForecast.snow > 0) {
          const formatted = this.formatSnowValue(dailyForecast.snow, dailyForecast)
          snowCell.innerHTML = this.config.units === 'imperial'
            ? `${parseFloat(formatted.value).toFixed(2)} <span class="precip-unit">${formatted.unit}</span>`
            : `${parseFloat(formatted.value).toFixed(1)} <span class="precip-unit">${formatted.unit}</span>`
        }
        else if (hasAnySnow) {
          snowCell.innerHTML = '—'
        }
        snowCell.className = 'align-right bright snow precip-snow'
        row.appendChild(snowCell)
      }
    }

    return forecastTable
  },

  // Forecast layout: "columns" - each day as a column
  createColumnsForecastTable(degreeLabel) {
    const forecastTable = document.createElement('table')
    forecastTable.className = 'forecast-table small'

    const dayRow = document.createElement('tr')
    const iconRow = document.createElement('tr')
    const maxTempRow = document.createElement('tr')
    const minTempRow = document.createElement('tr')
    const windRow = document.createElement('tr')
    const rainRow = this.config.showRainAmount ? document.createElement('tr') : null
    const snowRow = this.config.showSnowAmount ? document.createElement('tr') : null

    const hasAnyRain = this.forecast.days.slice(0, this.config.maxDailiesToShow).some(day => day.rain > 0)
    const hasAnySnow = this.forecast.days.slice(0, this.config.maxDailiesToShow).some(day => day.snow > 0)

    for (let j = 0; j < this.config.maxDailiesToShow; j += 1) {
      const dailyForecast = this.forecast.days[j]

      // Day cell
      const dayCell = document.createElement('td')
      dayCell.className = 'day'
      if (this.config.colored) {
        dayCell.className += ' colored'
      }
      dayCell.innerHTML = dailyForecast.dayOfWeek
      dayRow.appendChild(dayCell)

      // Icon cell
      const iconCell = document.createElement('td')
      iconCell.className = 'bright weather-icon'
      if (this.config.colored) {
        iconCell.className += ' colored'
      }
      const icon = document.createElement('span')
      const iconImg = document.createElement('img')
      iconImg.className = 'forecast-icon'
      iconImg.src = `modules/MMM-OneCallWeather/icons/${this.config.iconset}/${dailyForecast.weatherIcon}.${this.config.iconsetFormat}`
      icon.appendChild(iconImg)
      iconCell.appendChild(icon)
      iconRow.appendChild(iconCell)

      // Max temp cell
      const maxTempCell = document.createElement('td')
      maxTempCell.innerHTML = `${dailyForecast.maxTemperature}${degreeLabel}`
      maxTempCell.className = 'bright max-temp'
      if (this.config.colored) {
        maxTempCell.className += ' colored'
      }
      maxTempRow.appendChild(maxTempCell)

      // Min temp cell
      const minTempCell = document.createElement('td')
      if (this.config.tempUnits === 'f') {
        minTempCell.innerHTML = ` ${(
          dailyForecast.minTemperature * (9 / 5)
          + 32
        ).toFixed(0)}${degreeLabel}`
      }
      else {
        minTempCell.innerHTML = `${dailyForecast.minTemperature}${degreeLabel}`
      }
      minTempCell.className = 'min-temp'
      if (this.config.colored) {
        minTempCell.className += ' colored'
      }
      minTempRow.appendChild(minTempCell)

      // Wind cell
      if (this.config.showWind) {
        const windCell = document.createElement('td')
        windCell.className = 'bright weather-icon'
        if (this.config.colored) {
          windCell.className += ' colored'
        }
        windCell.appendChild(this.createWindBadge(dailyForecast.windSpeed, dailyForecast.windDirection))
        windRow.appendChild(windCell)
      }

      // Rain cell
      if (this.config.showRainAmount) {
        const rainCell = document.createElement('td')
        if (dailyForecast.rain > 0) {
          rainCell.innerHTML = this.config.units === 'imperial'
            ? `${parseFloat(dailyForecast.rain).toFixed(2)} <span class="precip-unit">in</span>`
            : `${parseFloat(dailyForecast.rain).toFixed(1)} <span class="precip-unit">mm</span>`
        }
        else if (hasAnyRain) {
          rainCell.innerHTML = '—'
        }
        rainCell.className = 'align-right bright rain precip-rain'
        if (this.config.colored) {
          rainCell.className += ' colored'
        }
        rainRow.appendChild(rainCell)
      }

      // Snow cell
      if (this.config.showSnowAmount) {
        const snowCell = document.createElement('td')
        if (dailyForecast.snow > 0) {
          const formatted = this.formatSnowValue(dailyForecast.snow, dailyForecast)
          snowCell.innerHTML = this.config.units === 'imperial'
            ? `${parseFloat(formatted.value).toFixed(2)} <span class="precip-unit">${formatted.unit}</span>`
            : `${parseFloat(formatted.value).toFixed(1)} <span class="precip-unit">${formatted.unit}</span>`
        }
        else if (hasAnySnow) {
          snowCell.innerHTML = '—'
        }
        snowCell.className = 'align-right bright snow precip-snow'
        if (this.config.colored) {
          snowCell.className += ' colored'
        }
        snowRow.appendChild(snowCell)
      }
    }

    // Append all rows to forecast table
    forecastTable.appendChild(dayRow)
    forecastTable.appendChild(iconRow)
    forecastTable.appendChild(maxTempRow)
    forecastTable.appendChild(minTempRow)
    if (this.config.showWind) {
      forecastTable.appendChild(windRow)
    }
    if (this.config.showRainAmount) {
      forecastTable.appendChild(rainRow)
    }
    if (this.config.showSnowAmount) {
      forecastTable.appendChild(snowRow)
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
      this.convSpd = this.mph2Beaufort(currentWeather.windSpeed)
      windySpeed.innerHTML = `F${this.convSpd}`
    }
    else {
      const unitLabel = this.config.showWindSpeedUnit ? `\u00a0${this.getWindSpeedLabel()}` : ''
      windySpeed.innerHTML = `${currentWeather.windSpeed}${unitLabel}`
    }
    windGroup.appendChild(windySpeed)

    if (this.config.showWindDirection) {
      const windyDirection = document.createElement('sup')
      if (this.config.showWindDirectionAsArrow) {
        windyDirection.innerHTML = ` &nbsp;<i class="fa fa-long-arrow-down" style="transform:rotate(${currentWeather.windDirection}deg);"></i>&nbsp;`
      }
      else {
        windyDirection.innerHTML = `\u00a0${this.cardinalWindDirection(currentWeather.windDirection)}`
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
        ? `${parseFloat(amount).toFixed(2)} in`
        : `${parseFloat(amount).toFixed(1)} mm`
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
    if (this.config.tempUnits === 'f') {
      currTemperature.innerHTML = ` ${(
        currentWeather.temperature * (9 / 5)
        + 32
      ).toFixed(0)}${degreeLabel}`
    }
    else {
      currTemperature.innerHTML = ` ${currentWeather.temperature}${degreeLabel}`
    }

    largeWeatherIcon.appendChild(currTemperature)
    currentCell2.appendChild(largeWeatherIcon)
    currentRow2.appendChild(currentCell2)
    table.appendChild(currentRow2)

    // Row 3: Feels like temperature
    const currentRow3 = document.createElement('tr')
    const currentCell3 = document.createElement('td')
    currentCell3.colSpan = colspan
    currentCell3.className = 'current'

    if (this.config.showFeelsLike && this.config.onlyTemp === false) {
      const feelsLikeContainer = document.createElement('div')
      feelsLikeContainer.className = 'wind-container small dimmed'
      const currFeelsLike = document.createElement('span')
      currFeelsLike.className = 'small dimmed'

      if (this.config.tempUnits === 'f') {
        currFeelsLike.innerHTML = ` ${(
          currentWeather.feelsLikeTemp * (9 / 5)
          + 32
        ).toFixed(0)}${degreeLabel}`
      }
      else {
        const feelsLikeString = this.translate('FEELS')
        const feelsLikeText = feelsLikeString.replace('{DEGREE}', `${currentWeather.feelsLikeTemp}${degreeLabel}`)
        currFeelsLike.innerHTML = feelsLikeText
      }
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
          && alert.start < alertWindow  // Starts within the configured time window
          && alert.end > now,             // Is still active (not expired)
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

          span.textContent = `${alert.event} (${startTime} - ${endTime})`
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

  getOrdinal(bearing) {
    return this.utils.getOrdinal(bearing, this.config.labelOrdinals)
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

  /*
   * Convert the OpenWeatherMap icons to a more usable name.
   */
  convertWeatherType(weatherType) {
    return this.utils.convertWeatherType(weatherType)
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
    overlay.style.zIndex = '99999'        // on top of everything
    overlay.style.pointerEvents = 'auto'  // ensure overlay captures all clicks
    // Stop clicks inside overlay from propagating
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        removeOverlay()  // clicking outside the box closes
      }
    })
    // Close on ESC key for keyboard/mouse users
    document.addEventListener('keydown', handleEscape, { signal: escapeController.signal })
    // Create alert box
    const box = document.createElement('div')
    box.className = 'alert-box'
    const title = document.createElement('h2')
    title.textContent = alert.event
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
      description.textContent = 'No additional details provided.'
    }

    const meta = document.createElement('p')
    meta.className = 'alert-meta'
    meta.appendChild(document.createTextNode(`Source: ${alert.sender || 'NWS'}`))
    meta.appendChild(document.createElement('br'))
    meta.appendChild(document.createTextNode(`Valid: ${this.formatAlertDateTime(alert.start)} – ${this.formatAlertDateTime(alert.end)}`))
    const closeButton = document.createElement('div')
    closeButton.className = 'alert-close'
    closeButton.textContent = 'Click to close (or press ESC)'
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
