export interface Mon {
  dex: number
  name: string
  types: string[]
  stats: [number, number, number, number, number, number]
  abilities: string[]
}

let mons: Mon[] = []
let itemNames = new Set<string>()

export function initCatalog(pokemonText: string, itemText: string) {
  mons = parsePokemon(pokemonText)
  itemNames = new Set(parseItemNames(itemText))
}

export function getMons(): Mon[] {
  return mons
}

export function findMon(name: string): Mon | undefined {
  return mons.find((mon) => mon.name === name)
}

export function hasItem(name: string): boolean {
  return itemNames.has(name)
}

export function parsePokemon(text: string): Mon[] {
  const lines = text.split(/\r?\n/)
  const parsed: Mon[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (!/^\d+:$/.test(line)) {
      index += 1
      continue
    }
    const dex = Number(line.slice(0, -1))
    const name = (lines[index + 1] ?? "").trim()
    const types = (lines[index + 2] ?? "")
      .trim()
      .split("タイプ")
      .map((type) => type.trim())
      .filter(Boolean)
    const stats = (lines[index + 3] ?? "")
      .trim()
      .split("-")
      .map((value) => Number(value)) as Mon["stats"]
    const abilities: string[] = []
    index += 4
    while (index < lines.length && lines[index].trim() && !/^\d+:$/.test(lines[index].trim())) {
      abilities.push(lines[index].trim())
      index += 1
    }
    parsed.push({ dex, name, types, stats, abilities })
  }
  return parsed
}

export function parseItemNames(text: string): string[] {
  const names: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes("\t")) continue
    const name = line.split("\t")[0]?.trim() ?? ""
    if (!name || name === "道具名") continue
    names.push(name)
  }
  return names
}
