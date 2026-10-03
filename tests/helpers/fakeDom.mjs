import * as utils from '../../core/utils.mjs'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

class FakeText {
  constructor(text) {
    this.text = text
  }
}

/** Minimal DOM element: just enough for the DOM code of the module. */
export class FakeElement {
  constructor(tag) {
    this.tag = tag
    this.children = []
    this.className = ''
    this.style = {}
    this.listeners = {}
    this.removed = false
  }

  get textContent() {
    return this.children.map(child => (child instanceof FakeElement ? child.textContent : child.text)).join('')
  }

  set textContent(value) {
    this.children = value === '' ? [] : [new FakeText(String(value))]
  }

  appendChild(child) {
    // A fragment hands over its children
    this.children.push(...(child.tag === '#fragment' ? child.children : [child]))
    return child
  }

  append(...items) {
    items.forEach(item => this.appendChild(typeof item === 'string' ? new FakeText(item) : item))
  }

  addEventListener(type, handler) {
    (this.listeners[type] ??= []).push(handler)
  }

  click(event = { target: this }) {
    (this.listeners.click ?? []).forEach(handler => handler({ stopPropagation() {}, ...event }))
  }

  remove() {
    this.removed = true
  }
}

const findAll = (node, predicate) => (node instanceof FakeElement
  ? [...(predicate(node) ? [node] : []), ...node.children.flatMap(child => findAll(child, predicate))]
  : [])

export const byClass = (node, className) => findAll(node, element => element.className.split(' ').includes(className))

export const byTag = (node, tag) => findAll(node, element => element.tag === tag)

const translations = {
  FEELS: 'Feels like {DEGREE}',
  ALERT_SOURCE: 'Source',
  ALERT_NO_DETAILS: 'No details',
}

/** Loads the module definition with a fake document and returns a factory for module instances. */
export function loadModule() {
  const documentListeners = {}
  const document = {
    body: new FakeElement('body'),
    createElement: tag => new FakeElement(tag),
    createTextNode: text => new FakeText(text),
    createDocumentFragment: () => new FakeElement('#fragment'),
    addEventListener: (type, handler) => (documentListeners[type] ??= []).push(handler),
    dispatch: (type, event) => (documentListeners[type] ?? []).forEach(handler => handler(event)),
  }
  let definition

  runInNewContext(readFileSync(new URL('../../MMM-OneCallWeather.js', import.meta.url), 'utf8'), {
    AbortController,
    Intl,
    config: { language: 'en', units: 'metric' },
    document,
    Log: { debug() {}, error() {}, info() {} },
    Module: { register(name, moduleDefinition) { definition = moduleDefinition } },
  })

  const createInstance = (config = {}, state = {}) => Object.assign(Object.create(definition), {
    config: { ...definition.defaults, decimalSymbol: ',', windUnits: 'kmph', ...config },
    utils,
    translate: key => translations[key] ?? key,
    ...state,
  })

  return { createInstance, document }
}
