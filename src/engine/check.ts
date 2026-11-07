import { readFileSync } from "node:fs"
import { initCatalog } from "./catalog.ts"
import { calcStat } from "./chart.ts"
import { buildNext } from "./build.ts"
import { validateSets } from "./sets.ts"

const root = new URL("../data/", import.meta.url)
initCatalog(readFileSync(new URL("pokemon.txt", root), "utf8"), readFileSync(new URL("items.txt", root), "utf8"))

const hp = calcStat(95, 0, "やんちゃ", "H")
const atk = calcStat(145, 19, "やんちゃ", "A")
const def = calcStat(130, 0, "やんちゃ", "B")
const spa = calcStat(120, 15, "やんちゃ", "C")
const spd = calcStat(90, 0, "やんちゃ", "D")
const spe = calcStat(120, 32, "やんちゃ", "S")
const stats = [hp, atk, def, spa, spd, spe]
if (stats.join(",") !== "170,202,150,155,99,172") {
  console.error("stat formula", stats.join(","))
  process.exitCode = 1
}

const problems = validateSets()
console.log(`problems ${problems.length}`)
for (const problem of problems) console.log(problem)

for (const name of ["メガカイリュー", "カイリュー", "ブラッキー", "ミミッキュ", "ペリッパー"]) {
  const avoid = new Set<string>()
  console.log(`\n# ${name}`)
  for (let index = 0; index < 3; index += 1) {
    const team = buildNext(name, "1", 1, index, avoid)
    if (!team) {
      console.log("  failed")
      continue
    }
    avoid.add(team.members.map((member) => member.name).sort().join("|"))
    console.log(
      `  ${team.theme} 物${team.physical}/特${team.special} ${team.members.map((member) => `${member.name}(${member.item})`).join(" / ")}`,
    )
    console.log(`  選出 ${team.bring.join("、")}`)
    if (team.holes.length) console.log(`  穴 ${team.holes.join(" / ")}`)
  }
}
