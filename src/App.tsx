import { useMemo, useState } from "react"
import itemText from "./data/items.txt?raw"
import pokemonText from "./data/pokemon.txt?raw"
import { initCatalog, getMons, type Mon } from "./engine/catalog.ts"
import { buildBlock, buildThree, type Mode, type TeamResult } from "./engine/build.ts"
import { ItemIcon, MonSprite, TypeIcon } from "./ui/sprites.tsx"

initCatalog(pokemonText, itemText)

const STAT_LABEL = ["H", "A", "B", "C", "D", "S"]

const KANA_VOWEL = new Map<string, string>()
for (const [kana, vowel] of [
  ["アカサタナハマヤラワガザダバパァャ", "ア"],
  ["イキシチニヒミリギジヂビピィ", "イ"],
  ["ウクスツヌフムユルグズヅブプゥュヴ", "ウ"],
  ["エケセテネヘメレゲゼデベペェ", "エ"],
  ["オコソトノホモヨロヲゴゾドボポォョ", "オ"],
] as const) {
  for (const char of kana) KANA_VOWEL.set(char, vowel)
}

function foldKana(value: string): string {
  const katakana = value.replace(/[\u3041-\u3096]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
  let folded = ""
  for (const char of katakana) {
    if (char === "ー") {
      folded += KANA_VOWEL.get(folded.slice(-1)) ?? char
    } else {
      folded += char
    }
  }
  return folded
}

export default function App() {
  const mons = useMemo(() => getMons(), [])
  const [mode, setMode] = useState<Mode>("2")
  const [query, setQuery] = useState("")
  const [typeName, setTypeName] = useState("")
  const [selected, setSelected] = useState<Mon | null>(null)
  const [teams, setTeams] = useState<TeamResult[]>([])
  const [building, setBuilding] = useState(false)
  const [seed, setSeed] = useState(1)
  const [notice, setNotice] = useState("")

  const types = useMemo(() => {
    const found = new Set<string>()
    for (const mon of mons) for (const type of mon.types) found.add(type)
    return [...found]
  }, [mons])

  const visible = useMemo(() => {
    const text = query.trim()
    const folded = foldKana(text)
    return mons.filter((mon) => {
      if (typeName && !mon.types.includes(typeName)) return false
      if (text && !foldKana(mon.name).includes(folded) && !String(mon.dex).includes(text)) return false
      return true
    })
  }, [mons, query, typeName])

  async function generate(nextSeed: number) {
    if (!selected || building) return
    const block = buildBlock(selected.name)
    if (block) {
      setNotice(block)
      setTeams([])
      return
    }
    setNotice("テーマを分けて、重なりの少ない構築を探しています。")
    setBuilding(true)
    setTeams([])
    const teams = await buildThree(selected.name, mode, nextSeed, (team) => {
      setTeams((current) => [...current, team])
    })
    setNotice(teams.length ? "" : "このポケモンでは6匹を組めませんでした。")
    setBuilding(false)
  }

  return (
    <div className="page">
      <header className="top">
        <div className="brand">
          <img className="mark" src={`${import.meta.env.BASE_URL}icon.jpg`} alt="" />
          <div>
            <p className="eyebrow">Pokémon Champions</p>
            <h1>構築サポート</h1>
          </div>
        </div>
        <p className="lead">1匹選ぶと、テーマとメンバーを分けた6匹を3つ組む。シングル。メガは1匹か2匹。</p>
      </header>

      <section className="panel">
        <div className="modes" role="tablist">
          <button className={mode === "1" ? "on" : ""} onClick={() => setMode("1")} type="button">
            モード1
            <small>技・性格・努力値まで</small>
          </button>
          <button className={mode === "2" ? "on" : ""} onClick={() => setMode("2")} type="button">
            モード2
            <small>ポケモンと持ち物</small>
          </button>
        </div>

        <div className="filters">
          <label>
            名前
            <input value={query} placeholder="かいりゅう" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="types" aria-label="タイプ">
            <button className={typeName === "" ? "chip on" : "chip"} onClick={() => setTypeName("")} type="button">
              すべて
            </button>
            {types.map((type) => (
              <button key={type} className={typeName === type ? "chip on" : "chip"} onClick={() => setTypeName(type)} type="button">
                <TypeIcon type={type} />
              </button>
            ))}
          </div>
        </div>

        <p className="count">{visible.length}匹</p>
        <div className="grid">
          {visible.map((mon) => (
            <button
              key={mon.name}
              className={selected?.name === mon.name ? "mon on" : "mon"}
              onClick={() => setSelected(mon)}
              type="button"
            >
              <MonSprite name={mon.name} dex={mon.dex} />
              <span>
                <strong>{mon.name}</strong>
                <span className="type-row">
                  {mon.types.map((type) => (
                    <TypeIcon key={type} type={type} />
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="action">
        <div>
          <p className="eyebrow">選択中</p>
          <strong>{selected ? selected.name : "まだ選んでいない"}</strong>
        </div>
        <div className="action-buttons">
          <button className="primary" disabled={!selected || building} onClick={() => generate(seed)} type="button">
            {building ? "組んでいます" : "3つ組む"}
          </button>
          <button
            className="regen"
            disabled={!selected || building}
            onClick={() => {
              const next = seed + 1
              setSeed(next)
              void generate(next)
            }}
            type="button"
          >
            再生成
          </button>
        </div>
      </div>
      {notice ? <p className="notice">{notice}</p> : null}

      <div className="results">
        {teams.map((team, index) => (
          <article className="team" key={`${team.theme}-${team.members.map((member) => member.name).join("-")}-${index}`}>
            <header>
              <h2>構築 {index + 1}</h2>
              <span className="badge">{team.theme}</span>
              <span className="ratio">
                物理{team.physical} / 特殊{team.special}
              </span>
            </header>
            <p>{team.concept}</p>
            <p>{team.plan}</p>
            <p>
              <b>基本選出</b> {team.bring.join("、")}
            </p>
            <p>{team.assumption}</p>
            <div className="members">
              {team.members.map((member) => (
                <section className={member.bring ? "member bring" : "member"} key={member.name}>
                  <div className="member-head">
                    <MonSprite name={member.name} dex={member.dex} />
                    <div>
                      <h3>
                        {member.name}
                        {member.mega ? <em>メガ</em> : null}
                        {member.bring ? <em className="bring-mark">基本</em> : null}
                      </h3>
                      <span className="type-row">
                        {member.types.map((type) => (
                          <TypeIcon key={type} type={type} />
                        ))}
                      </span>
                      <ItemIcon name={member.item} />
                    </div>
                  </div>
                  <p className="role">{member.role}</p>
                  <p>{member.intent}</p>
                  <p className="reason">{member.reason}</p>
                  {mode === "1" && member.moves.length ? (
                    <>
                      <p>
                        {member.ability} / {member.nature}
                      </p>
                      <p className="moves">{member.moves.join(" / ")}</p>
                      <p className="points">
                        努力値 {member.points.map((value, stat) => `${STAT_LABEL[stat]}${value}`).join(" ")}
                      </p>
                      <p className="points">実数値 {member.stats.join(" / ")}（Lv50・個体値31）</p>
                      {member.estimated ? <p className="reason">覚える技から仮に置いた型です。</p> : null}
                    </>
                  ) : null}
                  {mode === "1" && !member.moves.length ? (
                    <p className="reason">確定の技と努力値がないので、数値は出していません。</p>
                  ) : null}
                </section>
              ))}
            </div>
          </article>
        ))}
        {building ? (
          <p className="pending">{teams.length === 0 ? "候補を広く比べています。" : "次の構築を出しています。"}</p>
        ) : null}
      </div>
    </div>
  )
}
