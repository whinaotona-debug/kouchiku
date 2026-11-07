import { findMon, hasItem } from "./catalog.ts"
import { calcStat, effectiveness, moveType, weaknesses } from "./chart.ts"
import {
  MEGA_STONES,
  THEMES,
  allSets,
  setsFor,
  type Offense,
  type SetData,
  type Theme,
} from "./sets.ts"

export type Mode = "1" | "2"

export interface MemberView {
  name: string
  dex: number
  types: string[]
  ability: string
  item: string
  role: string
  offense: Offense
  mega: boolean
  nature: string
  points: number[]
  stats: number[]
  moves: string[]
  intent: string
  reason: string
  estimated: boolean
  bring: boolean
}

export interface TeamResult {
  theme: Theme
  concept: string
  plan: string
  bring: string[]
  assumption: string
  holes: string[]
  members: MemberView[]
  physical: number
  special: number
}

interface Placed {
  set: SetData
  item: string
}

interface Weights {
  cover: number
  threat: number
  partner: number
}

const PLANS: Record<Theme, string> = {
  サイクル: "有利な対面へ交代しながら、役割の通る攻撃と定数ダメージで相手を削る。",
  対面: "選出したら前に出て、積みや先制で交換を減らし、そのまま殴り勝つ。",
  受け: "苦手な攻撃を半減以下で受け、回復と状態異常で相手の回数を先になくす。",
  壁: "リフレクターとひかりのかべ、またはオーロラベールでダメージを下げてからアタッカーが動く。",
  バトン: "めいそうやつるぎのまいをバトンタッチで渡し、一匹では止まる相手を連係で抜く。",
}

const WEIGHTS: Weights[] = [
  { cover: 1.35, threat: 1, partner: 1 },
  { cover: 1, threat: 1.5, partner: 1 },
  { cover: 1.05, threat: 1, partner: 1.45 },
]

export function anchorThemes(name: string): Theme[] {
  const found = setsFor(name)
  if (found.length) {
    const themes = new Set<Theme>()
    for (const set of found) for (const theme of set.themes) themes.add(theme)
    return THEMES.filter((theme) => themes.has(theme))
  }
  const mon = findMon(name)
  if (!mon) return []
  return estimate(mon).themes
}

export function buildNext(
  name: string,
  mode: Mode,
  seed: number,
  index: number,
  avoid: Set<string>,
  ban: Set<string> = new Set(),
): TeamResult | null {
  const themes = anchorThemes(name)
  if (!themes.length || (name.startsWith("メガ") && !isMega(name))) return null
  const found = runSearch(name, themes, mode, seed, index, avoid, ban)
  if (found || ban.size === 0) return found
  return runSearch(name, themes, mode, seed, index, avoid, new Set())
}

const BUDGET_MS: Record<Mode, number> = { "1": 50000, "2": 18000 }

export async function buildThree(
  name: string,
  mode: Mode,
  seed: number,
  onTeam: (team: TeamResult) => void,
): Promise<TeamResult[]> {
  const themes = anchorThemes(name)
  if (!themes.length || (name.startsWith("メガ") && !isMega(name))) return []
  const deadline = Date.now() + BUDGET_MS[mode]
  const bag: { team: TeamResult; score: number }[] = []
  const seen = new Set<string>()
  const maxRounds = mode === "1" ? 48 : 60
  let round = 0
  while (Date.now() < deadline && round < maxRounds) {
    const theme = themes[round % themes.length]
    const weights = WEIGHTS[round % WEIGHTS.length]
    const rng = mulberry32((seed * 1009 + round * 97 + 11) >>> 0)
    const found = searchMany(name, theme, weights, rng, {
      beam: mode === "1" ? 16 : 8,
      cap: mode === "1" ? 22 : 14,
      limit: 3,
      ban: bansFor(bag, name, round, themes.length),
      drop: round < themes.length ? 0 : 2 + (round % 4),
      repair: true,
    })
    for (const entry of found) {
      const key = `${entry.team.theme}|${fingerprint(entry.team)}`
      if (seen.has(key)) continue
      seen.add(key)
      bag.push(entry)
    }
    round += 1
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  const picked = pickDiverse(bag, themes)
  for (const team of picked) {
    onTeam(team)
    await new Promise((resolve) => setTimeout(resolve, 40))
  }
  return picked
}

function bansFor(
  bag: { team: TeamResult }[],
  anchor: string,
  round: number,
  themeCount: number,
): Set<string> {
  const ban = new Set<string>()
  if (round < themeCount || bag.length < 2) return ban
  const source = bag[round % bag.length]?.team
  if (!source) return ban
  for (const member of source.members) {
    if (member.name === anchor) continue
    ban.add(member.name)
    if (ban.size >= 4) break
  }
  return ban
}

function sharedCount(a: TeamResult, b: TeamResult): number {
  const names = new Set(a.members.map((member) => member.name))
  return b.members.filter((member) => names.has(member.name)).length
}

function pickDiverse(bag: { team: TeamResult; score: number }[], themes: Theme[]): TeamResult[] {
  const sorted = [...bag].sort((a, b) => b.score - a.score)
  const chosen: { team: TeamResult; score: number }[] = []
  const fits = (entry: { team: TeamResult }, limit: number) =>
    chosen.every((current) => sharedCount(current.team, entry.team) <= limit)
  for (const theme of themes) {
    if (chosen.length >= 3) break
    const next = sorted.find((entry) => entry.team.theme === theme && fits(entry, 3))
    if (next) chosen.push(next)
  }
  for (const limit of [3, 4, 5, 6]) {
    if (chosen.length >= 3) break
    for (const entry of sorted) {
      if (chosen.includes(entry)) continue
      if (!fits(entry, limit)) continue
      chosen.push(entry)
      if (chosen.length >= 3) break
    }
  }
  return chosen
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.team)
}

function runSearch(
  name: string,
  themes: Theme[],
  mode: Mode,
  seed: number,
  index: number,
  avoid: Set<string>,
  ban: Set<string>,
): TeamResult | null {
  const rng = mulberry32(seed * 100 + index * 17 + ban.size + 3)
  for (let attempt = 0; attempt < themes.length + 2; attempt += 1) {
    const theme = themes[(index + attempt) % themes.length]
    const bias = (index + attempt) % WEIGHTS.length
    const team = search(name, theme, mode, WEIGHTS[bias], rng, avoid, ban)
    if (team && !avoid.has(fingerprint(team))) return team
  }
  return search(name, themes[index % themes.length], mode, WEIGHTS[index % WEIGHTS.length], rng, new Set(), ban)
}

function isMega(name: string): boolean {
  const stone = MEGA_STONES[name]
  return Boolean(stone && hasItem(stone))
}

export function buildBlock(name: string): string | null {
  if (!findMon(name)) return "このポケモンは一覧にありません。"
  if (name.startsWith("メガ") && !isMega(name)) return "持ち物一覧に対応するメガストーンがないので、このメガは組めません。"
  if (!anchorThemes(name).length) return "このポケモンからはテーマを決められません。"
  return null
}

interface SearchOptions {
  beam: number
  cap: number
  limit: number
  ban: Set<string>
  drop: number
  repair: boolean
}

function search(
  name: string,
  theme: Theme,
  mode: Mode,
  weights: Weights,
  rng: () => number,
  avoid: Set<string>,
  ban: Set<string>,
): TeamResult | null {
  const found = searchMany(name, theme, weights, rng, {
    beam: mode === "1" ? 12 : 4,
    cap: mode === "1" ? 18 : 10,
    limit: 4,
    ban,
    drop: 0,
    repair: false,
  })
  return found.find((entry) => !avoid.has(fingerprint(entry.team)))?.team ?? null
}

function searchMany(
  name: string,
  theme: Theme,
  weights: Weights,
  rng: () => number,
  options: SearchOptions,
): { team: TeamResult; score: number }[] {
  const anchor = chooseAnchor(name, theme, Math.floor(rng() * 5))
  if (!anchor) return []
  if (!findMon(anchor.name)) return []
  const anchorItem = anchor.items.find((item) => item) ?? ""
  let drafts: Placed[][] = [[{ set: anchor, item: anchorItem }]]
  let pool = poolFor(theme).filter((set) => set.name !== anchor.name && !options.ban.has(set.name))
  if (options.drop > 0) {
    const copy = [...pool]
    for (let count = 0; count < options.drop && copy.length > 12; count += 1) {
      copy.splice(Math.floor(rng() * copy.length), 1)
    }
    pool = copy
  }

  for (let slot = 0; slot < 5; slot += 1) {
    const next: { members: Placed[]; score: number }[] = []
    for (const draft of drafts) {
      const usedItems = new Set(draft.map((member) => member.item))
      const ranked: { placed: Placed; score: number }[] = []
      for (const set of pool) {
        if (draft.some((member) => member.set.name === set.name)) continue
        const mon = findMon(set.name)
        if (!mon || draft.some((member) => findMon(member.set.name)?.dex === mon.dex)) continue
        const item = set.items.find((candidate) => !usedItems.has(candidate))
        if (!item) continue
        const placed = { set, item }
        if (!legal(draft, placed)) continue
        const members = [...draft, placed]
        ranked.push({ placed, score: evaluate(members, theme, weights) + rng() * 1.4 })
      }
      ranked.sort((a, b) => b.score - a.score)
      for (const choice of ranked.slice(0, options.cap)) {
        next.push({ members: [...draft, choice.placed], score: choice.score })
      }
    }
    next.sort((a, b) => b.score - a.score)
    drafts = next.slice(0, options.beam).map((entry) => entry.members)
    if (!drafts.length) return []
  }

  const ranked = drafts
    .filter((members) => members.length === 6)
    .map((members) => ({ members, score: evaluate(members, theme, weights) }))
    .sort((a, b) => b.score - a.score)
  const found: { team: TeamResult; score: number }[] = []
  for (const entry of ranked) {
    const members = options.repair ? repair(entry.members, theme, weights, options.ban) : entry.members
    if (!teamLegal(members)) continue
    const result = describe(members, theme)
    const score = evaluate(members, theme, weights)
    if (found.some((item) => sharedCount(item.team, result) >= 5)) continue
    found.push({ team: result, score })
    if (found.length >= options.limit) break
  }
  return found
}

function teamLegal(members: Placed[]): boolean {
  if (members.length !== 6) return false
  if (new Set(members.map((member) => member.item)).size !== 6) return false
  const dexes = members.map((member) => findMon(member.set.name)?.dex)
  if (dexes.some((dex) => dex === undefined) || new Set(dexes).size !== 6) return false
  const megas = members.filter((member) => isMega(member.set.name)).length
  if (megas < 1 || megas > 2) return false
  const physical = members.filter((member) => member.set.offense === "physical").length
  return physical >= 2 && physical <= 4
}

function repair(members: Placed[], theme: Theme, weights: Weights, ban: Set<string>): Placed[] {
  let current = members
  for (let pass = 0; pass < 2; pass += 1) {
    const holes = openHoles(current, theme)
    if (!holes.length) break
    const threatName = holes[0]?.split("が")[0] ?? ""
    const threat = threatPool(theme).find((set) => set.name === threatName)
    const threatMon = threat ? findMon(threat.name) : undefined
    if (!threat || !threatMon) break
    let best = current
    let bestHoles = holes.length
    let bestScore = evaluate(current, theme, weights)
    for (let index = 1; index < current.length; index += 1) {
      for (const set of poolFor(theme)) {
        if (ban.has(set.name)) continue
        if (current.some((member, memberIndex) => memberIndex !== index && member.set.name === set.name)) continue
        const mon = findMon(set.name)
        if (!mon) continue
        if (current.some((member, memberIndex) => memberIndex !== index && findMon(member.set.name)?.dex === mon.dex)) continue
        const used = new Set(current.filter((_, memberIndex) => memberIndex !== index).map((member) => member.item))
        const item = set.items.find((candidate) => !used.has(candidate))
        if (!item) continue
        const placed = { set, item }
        const trial = current.map((member, memberIndex) => (memberIndex === index ? placed : member))
        if (!teamLegal(trial) || weatherConflict(trial)) continue
        if (!answers(placed, threat, threatMon, weatherOf(trial))) continue
        const nextHoles = openHoles(trial, theme).length
        const score = evaluate(trial, theme, weights)
        if (nextHoles < bestHoles || (nextHoles === bestHoles && score > bestScore)) {
          best = trial
          bestHoles = nextHoles
          bestScore = score
        }
      }
    }
    if (best === current) break
    current = best
  }
  return current
}

function legal(draft: Placed[], candidate: Placed): boolean {
  const members = [...draft, candidate]
  const megas = members.filter((member) => isMega(member.set.name)).length
  const slotsAfter = 6 - members.length
  if (megas > 2 || megas + slotsAfter < 1) return false
  const physical = members.filter((member) => member.set.offense === "physical").length
  const special = members.length - physical
  for (let add = 0; add <= slotsAfter; add += 1) {
    const nextPhysical = physical + add
    const nextSpecial = special + (slotsAfter - add)
    if (nextPhysical >= 2 && nextPhysical <= 4 && nextSpecial >= 2 && nextSpecial <= 4) return true
  }
  return false
}

function evaluate(members: Placed[], theme: Theme, weights: Weights): number {
  let score = 0
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) score += mutual(members[i], members[j]) * weights.cover
  }
  for (const member of members) {
    const mon = findMon(member.set.name)
    if (!mon) continue
    for (const weak of weaknesses(mon.types, member.set.ability)) {
      if (weak.value < 4) continue
      const covered = members.some((other) => {
        if (other === member) return false
        const otherMon = findMon(other.set.name)
        return otherMon ? effectiveness(weak.type, otherMon.types, other.set.ability) <= 0.5 : false
      })
      if (!covered) score -= 16 * weights.cover
    }
  }
  score -= openHoles(members, theme).length * 5 * weights.threat
  for (const member of members) {
    if (member.set.partners.some((partner) => members.some((other) => other.set.name === partner))) {
      score += 36 * weights.partner
    }
    if (member.set.core) score += 2
  }
  if (weatherConflict(members)) score -= 80
  if (members.length === 6) {
    const physical = members.filter((member) => member.set.offense === "physical").length
    if (physical === 3) score += 22
    else if (physical === 2 || physical === 4) score += 8
  }
  return score
}

function mutual(a: Placed, b: Placed): number {
  const aMon = findMon(a.set.name)
  const bMon = findMon(b.set.name)
  if (!aMon || !bMon) return 0
  let score = 0
  for (const weak of weaknesses(aMon.types, a.set.ability)) {
    const value = effectiveness(weak.type, bMon.types, b.set.ability)
    if (value === 0) score += weak.value >= 4 ? 12 : 6
    else if (value <= 0.5) score += weak.value >= 4 ? 9 : 4
  }
  for (const weak of weaknesses(bMon.types, b.set.ability)) {
    const value = effectiveness(weak.type, aMon.types, a.set.ability)
    if (value === 0) score += weak.value >= 4 ? 8 : 4
    else if (value <= 0.5) score += weak.value >= 4 ? 6 : 3
  }
  return score
}

function openHoles(members: Placed[], theme: Theme): string[] {
  const names = new Set(members.map((member) => member.set.name))
  const weather = weatherOf(members)
  const holes: string[] = []
  for (const threat of threatPool(theme)) {
    if (names.has(threat.name)) continue
    const threatMon = findMon(threat.name)
    if (!threatMon) continue
    const victims = members.filter((member) => beats(threat, threatMon, member, weather))
    if (!victims.length) continue
    const answered = members.some((member) => answers(member, threat, threatMon, weather))
    if (!answered) holes.push(`${threat.name}が${victims[0].set.name}に通る`)
  }
  return holes.slice(0, 6)
}

function beats(threat: SetData, threatMon: NonNullable<ReturnType<typeof findMon>>, defender: Placed, weather: ReturnType<typeof weatherOf>): boolean {
  const defenderMon = findMon(defender.set.name)
  if (!defenderMon) return false
  const threatSpeed = speed(threatMon, threat, threat.items[0] ?? "", weather)
  const defenderSpeed = speed(defenderMon, defender.set, defender.item, weather)
  if (threatSpeed <= defenderSpeed) return false
  const moves = attackingTypes(threat, threatMon)
  if (!moves.length) return false
  if (moves.every((type) => effectiveness(type, defenderMon.types, defender.set.ability) <= 0.5)) return false
  return moves.some((type) => effectiveness(type, defenderMon.types, defender.set.ability) > 1)
}

function answers(candidate: Placed, threat: SetData, threatMon: NonNullable<ReturnType<typeof findMon>>, weather: ReturnType<typeof weatherOf>): boolean {
  if (candidate.set.answers.includes(threat.name)) return true
  const mon = findMon(candidate.set.name)
  if (!mon) return false
  const moves = attackingTypes(threat, threatMon)
  if (moves.length && moves.every((type) => effectiveness(type, mon.types, candidate.set.ability) <= 0.5)) return true
  const faster = speed(mon, candidate.set, candidate.item, weather) > speed(threatMon, threat, threat.items[0] ?? "", weather)
  if (!faster) return false
  return attackingTypes(candidate.set, mon).some((type) => effectiveness(type, threatMon.types, threat.ability) >= 2)
}

function attackingTypes(set: SetData, mon: NonNullable<ReturnType<typeof findMon>>): string[] {
  const types = new Set<string>()
  for (const move of set.moves) {
    const type = moveType(move, set.ability)
    if (type) types.add(type)
  }
  if (!types.size) for (const type of mon.types) types.add(type)
  return [...types]
}

function weatherConflict(members: Placed[]): boolean {
  const tags = new Set<string>()
  for (const member of members) {
    if (["ひでり", "あめふらし", "すなおこし", "ゆきふらし"].includes(member.set.ability)) tags.add(member.set.ability)
  }
  return tags.size > 1
}

function weatherOf(members: Placed[]): "sun" | "rain" | "sand" | "snow" | null {
  const abilities = members.map((member) => member.set.ability)
  if (abilities.includes("ひでり")) return "sun"
  if (abilities.includes("あめふらし")) return "rain"
  if (abilities.includes("すなおこし")) return "sand"
  if (abilities.includes("ゆきふらし")) return "snow"
  return null
}

function speed(mon: NonNullable<ReturnType<typeof findMon>>, set: SetData, item: string, weather: ReturnType<typeof weatherOf>): number {
  let value = calcStat(mon.stats[5], set.points[5], set.nature, "S")
  if (item === "こだわりスカーフ") value = Math.floor(value * 1.5)
  if (weather === "sun" && set.ability === "ようりょくそ") value *= 2
  if (weather === "rain" && set.ability === "すいすい") value *= 2
  if (weather === "sand" && set.ability === "すなかき") value *= 2
  if (weather === "snow" && set.ability === "ゆきかき") value *= 2
  return value
}

function describe(members: Placed[], theme: Theme): TeamResult {
  const anchor = members[0]
  const ranked = members.slice(1).map((member) => ({
    member,
    score: mutual(anchor, member) + (member.set.partners.includes(anchor.set.name) || anchor.set.partners.includes(member.set.name) ? 20 : 0) + (member.set.core ? 4 : 0),
  }))
  ranked.sort((a, b) => b.score - a.score)
  const bringNames = new Set([anchor.set.name, ...ranked.slice(0, 2).map((entry) => entry.member.set.name)])
  const views = members.map((member) => toView(member, members, bringNames.has(member.set.name)))
  const holes = openHoles(members, theme)
  const physical = views.filter((member) => member.offense === "physical").length
  const extras: string[] = []
  if (members.some((member) => member.set.moves.includes("ステルスロック"))) extras.push("ステルスロックで交代を削る。")
  if (members.some((member) => member.set.ability === "あめふらし")) extras.push("雨を軸に、水と地面の通りを作る。")
  if (members.some((member) => member.set.ability === "ひでり")) extras.push("晴れで炎と草を強める。")
  if (members.some((member) => member.set.ability === "すなおこし")) extras.push("砂で特防を補い、砂下の抜きを使う。")
  if (members.some((member) => member.set.ability === "ゆきふらし")) extras.push("雪で氷の通りと、オーロラベールの条件を作る。")
  if (members.some((member) => member.set.moves.includes("どくどく") || member.set.ability === "どくげしょう")) extras.push("毒で回復しない相手のHPを削る。")
  const answered = answeredNames(members, theme).slice(0, 3)
  const assumption = [
    answered.length ? `${answered.join("、")}は誰かが受けるか、抜いて返せる想定。` : "登録した型の範囲で、相手の主要アタッカーを役割で見る。",
    holes.length ? `まだ重いのは${holes.slice(0, 3).join("、")}。` : "4倍弱点は、組んだ中の誰かが半減以下で受ける。",
  ].join("")
  return {
    theme,
    concept: `${theme}。${conceptLine(theme, members)}`,
    plan: `${PLANS[theme]}${extras.join("")}`,
    bring: views.filter((member) => member.bring).map((member) => member.name),
    assumption,
    holes: holes.slice(0, 3),
    members: views,
    physical,
    special: views.length - physical,
  }
}

function conceptLine(theme: Theme, members: Placed[]): string {
  const anchor = members[0]?.set.name ?? ""
  if (theme === "受け") return `${anchor}を含む受けで、攻撃を耐えてから毒やかく乱で崩す。`
  if (theme === "対面") return `${anchor}を前に出し、交換の少ない展開で通す。`
  if (theme === "壁") return `${anchor}を壁の後ろで通す。`
  if (theme === "バトン") return `積んだ能力を${anchor}か受け先へ渡す。`
  return `${anchor}の弱点を半減以下で受け合う並びで回す。`
}

function answeredNames(members: Placed[], theme: Theme): string[] {
  const names = new Set(members.map((member) => member.set.name))
  const weather = weatherOf(members)
  const answered: string[] = []
  for (const threat of threatPool(theme)) {
    if (names.has(threat.name)) continue
    const threatMon = findMon(threat.name)
    if (!threatMon) continue
    const hits = members.some((member) => beats(threat, threatMon, member, weather))
    const held = members.some((member) => answers(member, threat, threatMon, weather))
    if (hits && held) answered.push(threat.name)
  }
  return answered
}

function toView(member: Placed, team: Placed[], bring: boolean): MemberView {
  const mon = findMon(member.set.name)!
  const stats = (["H", "A", "B", "C", "D", "S"] as const).map((stat, index) =>
    calcStat(mon.stats[index], member.set.points[index], member.set.nature, stat),
  )
  return {
    name: mon.name,
    dex: mon.dex,
    types: mon.types,
    ability: member.set.ability,
    item: member.item,
    role: member.set.role,
    offense: member.set.offense,
    mega: isMega(mon.name),
    nature: member.set.nature,
    points: [...member.set.points],
    stats,
    moves: member.set.moves,
    intent: member.set.intent,
    reason: reasonFor(member, team),
    estimated: member.set.estimated,
    bring,
  }
}

function reasonFor(member: Placed, team: Placed[]): string {
  const mon = findMon(member.set.name)
  if (!mon) return ""
  const covered: string[] = []
  for (const other of team) {
    if (other === member) continue
    const otherMon = findMon(other.set.name)
    if (!otherMon) continue
    for (const weak of weaknesses(otherMon.types, other.set.ability)) {
      if (effectiveness(weak.type, mon.types, member.set.ability) > 0.5) continue
      const already = covered.includes(weak.type)
      const someoneElse = team.some((third) => {
        if (third === member || third === other) return false
        const thirdMon = findMon(third.set.name)
        return thirdMon ? effectiveness(weak.type, thirdMon.types, third.set.ability) <= 0.5 : false
      })
      if (!already && !someoneElse) covered.push(weak.value >= 4 ? `${weak.type}4倍` : weak.type)
    }
  }
  if (!covered.length) return member.set.role
  return `${covered.slice(0, 3).join("・")}を半減以下で受ける`
}

function chooseAnchor(name: string, theme: Theme, bias: number): SetData | null {
  const found = setsFor(name).filter((set) => set.themes.includes(theme))
  if (found.length) return found[bias % found.length]
  if (setsFor(name).length) return null
  const mon = findMon(name)
  if (!mon) return null
  const estimated = estimate(mon)
  return estimated.themes.includes(theme) ? estimated : null
}

function estimate(mon: NonNullable<ReturnType<typeof findMon>>): SetData {
  const offense: Offense = mon.stats[1] >= mon.stats[3] ? "physical" : "special"
  const speed = mon.stats[5]
  const offenseStat = Math.max(mon.stats[1], mon.stats[3])
  const bulk = mon.stats[0] + mon.stats[2] + mon.stats[4]
  const themes: Theme[] = []
  if (bulk >= 280 && speed <= 80) themes.push("受け")
  if (offenseStat >= 110 && speed >= 90) themes.push("対面")
  themes.push("サイクル")
  const fast = speed >= 90
  const nature = offense === "physical" ? (fast ? "ようき" : "いじっぱり") : fast ? "おくびょう" : "ひかえめ"
  const points: SetData["points"] =
    offense === "physical"
      ? fast
        ? [0, 32, 0, 0, 2, 32]
        : [32, 32, 0, 0, 2, 0]
      : fast
        ? [0, 0, 0, 32, 2, 32]
        : [32, 0, 0, 32, 2, 0]
  const stone = MEGA_STONES[mon.name]
  return {
    name: mon.name,
    themes,
    offense,
    ability: mon.abilities[0] ?? "",
    items: stone ? [stone] : ["いのちのたま"],
    nature,
    points,
    moves: [],
    role: offense === "physical" ? "物理アタッカー" : "特殊アタッカー",
    intent: "種族値から仮に置いた型。技・性格・努力値の確定データはない。",
    answers: [],
    losesTo: [],
    partners: [],
    core: false,
    estimated: true,
  }
}

const poolCache = new Map<Theme, SetData[]>()
const threatCache = new Map<Theme, SetData[]>()

function poolFor(theme: Theme): SetData[] {
  const cached = poolCache.get(theme)
  if (cached) return cached
  const best = new Map<string, SetData>()
  for (const set of allSets()) {
    if (!set.themes.includes(theme)) continue
    const previous = best.get(set.name)
    if (!previous || (set.core && !previous.core) || (set.themes[0] === theme && previous.themes[0] !== theme)) {
      best.set(set.name, set)
    }
  }
  const list = [...best.values()]
  poolCache.set(theme, list)
  return list
}

function threatPool(theme: Theme): SetData[] {
  const cached = threatCache.get(theme)
  if (cached) return cached
  const best = new Map<number, SetData>()
  for (const set of allSets()) {
    if (!set.themes.includes("対面") && !set.themes.includes(theme)) continue
    const mon = findMon(set.name)
    if (!mon) continue
    const previous = best.get(mon.dex)
    const previousMon = previous ? findMon(previous.name) : undefined
    if (!previous || mon.stats[5] > (previousMon?.stats[5] ?? 0)) best.set(mon.dex, set)
  }
  const list = [...best.values()]
  threatCache.set(theme, list)
  return list
}

function fingerprint(team: TeamResult): string {
  return team.members
    .map((member) => member.name)
    .slice()
    .sort()
    .join("|")
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) | 0
    let t = Math.imul(value ^ (value >>> 15), 1 | value)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
