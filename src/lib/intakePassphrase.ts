/**
 * Passphrase suggestions for intake lines.
 *
 * Curated, unambiguous lowercase words — readable enough to relay on a poster or
 * verbally, yet the digit + symbol suffix guarantees validatePasswordComplexity.
 * Shared by the mint flow and every line's rotate flow, which is why it does not
 * live in either component.
 */

const PASSPHRASE_WORDS = [
  'falcon', 'river', 'cedar', 'anchor', 'summit', 'harbor', 'meadow', 'canyon',
  'ember', 'quartz', 'willow', 'beacon', 'tundra', 'cobalt', 'marble', 'spruce',
  'orchid', 'pewter', 'garnet', 'cypress', 'basalt', 'juniper', 'saffron', 'onyx',
] as const

function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

export function generatePassphrase(): string {
  const words = Array.from({ length: 3 }, () => PASSPHRASE_WORDS[randomInt(PASSPHRASE_WORDS.length)])
  const head = words[0][0].toUpperCase() + words[0].slice(1)
  const symbols = '!@#$%&*?'
  return `${[head, words[1], words[2]].join('-')}${randomInt(10)}${symbols[randomInt(symbols.length)]}`
}
