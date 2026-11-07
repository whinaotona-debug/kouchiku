import { useEffect, useState } from "react"

const TYPE_EN: Record<string, string> = {
  ノーマル: "normal",
  ほのお: "fire",
  みず: "water",
  でんき: "electric",
  くさ: "grass",
  こおり: "ice",
  かくとう: "fighting",
  どく: "poison",
  じめん: "ground",
  ひこう: "flying",
  エスパー: "psychic",
  むし: "bug",
  いわ: "rock",
  ゴースト: "ghost",
  ドラゴン: "dragon",
  あく: "dark",
  はがね: "steel",
  フェアリー: "fairy",
}

const ITEM_SLUG: Record<string, string> = {
  あついいわ: "heat-rock",
  いのちのたま: "life-orb",
  オボンのみ: "sitrus-berry",
  オッカのみ: "occa-berry",
  かいがらのすず: "shell-bell",
  きあいのタスキ: "focus-sash",
  くろいメガネ: "black-glasses",
  ゴツゴツメット: "rocky-helmet",
  こだわりスカーフ: "choice-scarf",
  さらさらいわ: "smooth-rock",
  しめったいわ: "damp-rock",
  しんぴのしずく: "mystic-water",
  たべのこし: "leftovers",
  つめたいいわ: "icy-rock",
  ノーマルジュエル: "normal-gem",
  ひかりのねんど: "light-clay",
  ラムのみ: "lum-berry",
  リザードナイトX: "charizardite-x",
  リザードナイトY: "charizardite-y",
  カメックスナイト: "blastoisinite",
  フシギバナイト: "venusaurite",
  ゲンガナイト: "gengarite",
  ガブリアスナイト: "garchompite",
  ルカリオナイト: "lucarionite",
  メタグロスナイト: "metagrossite",
  ハッサムナイト: "scizorite",
  バンギラスナイト: "tyranitarite",
  ヘルガナイト: "houndoominite",
  デンリュウナイト: "ampharosite",
  ヤドランナイト: "slowbronite",
  サーナイトナイト: "gardevoirite",
  フーディナイト: "alakazite",
  ラグラージナイト: "swampertite",
  バシャーモナイト: "blazikenite",
  ジュカインナイト: "sceptilite",
  ボスゴドラナイト: "aggronite",
  ハガネールナイト: "steelixite",
  ピジョットナイト: "pidgeotite",
  ユキノオナイト: "abomasite",
  エルレイドナイト: "galladite",
  ミミロップナイト: "lopunnite",
  ガルーラナイト: "kangaskhanite",
  アブソルナイト: "absolite",
  オニゴーリナイト: "glalitite",
  サメハダナイト: "sharpedonite",
  ヘラクロスナイト: "heracronite",
  カイロスナイト: "pinsirite",
  プテラナイト: "aerodactylite",
  ライボルトナイト: "manectite",
  ドラミドナイト: "dragalgite",
  ゲッコウガナイト: "greninjite",
  マフォクシナイト: "delphoxite",
  シャンデラナイト: "chandelurite",
  ムクホークナイト: "staraptorite",
  ブリガロナイト: "chesnaughtite",
  ドリュウズナイト: "excadrite",
  ギャラドスナイト: "gyaradosite",
  スピアナイト: "beedrillite",
  ルチャブルナイト: "hawluchanite",
  タイレーツナイト: "falinksite",
  ケケンカニナイト: "crabominite",
  グソクムシャナイト: "golisopite",
  スコヴィラナイト: "scovillainite",
  フラエッテナイト: "floettite",
  ジジーロナイト: "drampanite",
  スターミナイト: "starmite",
  タブンネナイト: "audinite",
  エアームドナイト: "skarmorite",
  カイリュナイト: "dragoninite",
  ガブリアスナイトZ: "garchompite-z",
  ルカリオナイトZ: "lucarionite-z",
  アブソルナイトZ: "absolite-z",
  セグレイブナイト: "baxcalibrite",
  ライチュウナイトX: "raichunite-x",
  ライチュウナイトY: "raichunite-y",
}

const FORM_SLUG: Record<string, string> = {
  メガカイリュー: "dragonite-mega",
  メガリザードンX: "charizard-mega-x",
  メガリザードンY: "charizard-mega-y",
  メガフシギバナ: "venusaur-mega",
  メガカメックス: "blastoise-mega",
  メガゲンガー: "gengar-mega",
  メガガブリアス: "garchomp-mega",
  メガルカリオ: "lucario-mega",
  メガメタグロス: "metagross-mega",
  メガハッサム: "scizor-mega",
  メガバンギラス: "tyranitar-mega",
  メガヘルガー: "houndoom-mega",
  メガデンリュウ: "ampharos-mega",
  メガヤドラン: "slowbro-mega",
  メガサーナイト: "gardevoir-mega",
  メガフーディン: "alakazam-mega",
  メガラグラージ: "swampert-mega",
  メガバシャーモ: "blaziken-mega",
  メガジュカイン: "sceptile-mega",
  メガボスゴドラ: "aggron-mega",
  メガハガネール: "steelix-mega",
  メガピジョット: "pidgeot-mega",
  メガユキノオー: "abomasnow-mega",
  メガエルレイド: "gallade-mega",
  メガミミロップ: "lopunny-mega",
  メガガルーラ: "kangaskhan-mega",
  メガアブソル: "absol-mega",
  メガオニゴーリ: "glalie-mega",
  メガサメハダー: "sharpedo-mega",
  メガヘラクロス: "heracross-mega",
  メガカイロス: "pinsir-mega",
  メガプテラ: "aerodactyl-mega",
  メガライボルト: "manectric-mega",
  メガギャラドス: "gyarados-mega",
  メガスピアー: "beedrill-mega",
  メガゲッコウガ: "greninja-mega",
  メガタブンネ: "audino-mega",
  "ライチュウ(アローラ)": "raichu-alola",
  "キュウコン(アローラ)": "ninetales-alola",
  "ペルシアン(アローラ)": "persian-alola",
  "ヤドラン(ガラル)": "slowbro-galar",
  "ヤドキング(ガラル)": "slowking-galar",
  "ウインディ(ヒスイ)": "arcanine-hisui",
  "バクフーン(ヒスイ)": "typhlosion-hisui",
  "ダイケンキ(ヒスイ)": "samurott-hisui",
  "ゾロアーク(ヒスイ)": "zoroark-hisui",
  "ジュナイパー(ヒスイ)": "decidueye-hisui",
  "ヌメルゴン(ヒスイ)": "goodra-hisui",
  "イダイトウ♂": "basculegion-male",
  "イダイトウ♀": "basculegion-female",
  "イエッサン♂": "indeedee-male",
  "イエッサン♀": "indeedee-female",
  ヒートロトム: "rotom-heat",
  ウォッシュロトム: "rotom-wash",
  フロストロトム: "rotom-frost",
  スピンロトム: "rotom-fan",
  カットロトム: "rotom-mow",
}

const artCache = new Map<string, string>()
const typeCache = new Map<string, string>()
const itemCache = new Map<string, string>()

function artwork(dex: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dex}.png`
}

export function MonSprite({ name, dex }: { name: string; dex: number }) {
  const cached = artCache.get(name)
  const [src, setSrc] = useState(cached ?? artwork(dex))
  useEffect(() => {
    const slug = FORM_SLUG[name]
    if (!slug || artCache.has(name)) return
    let cancel = false
    fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("missing"))))
      .then((data: { sprites?: { other?: { "official-artwork"?: { front_default?: string } }; front_default?: string } }) => {
        const next = data.sprites?.other?.["official-artwork"]?.front_default || data.sprites?.front_default
        if (!next || cancel) return
        artCache.set(name, next)
        setSrc(next)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [name])
  return <img className="sprite" src={src} alt="" onError={() => setSrc(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`)} />
}

export function TypeIcon({ type }: { type: string }) {
  const english = TYPE_EN[type]
  const [src, setSrc] = useState(english ? typeCache.get(english) ?? "" : "")
  useEffect(() => {
    if (!english || typeCache.has(english)) return
    let cancel = false
    fetch(`https://pokeapi.co/api/v2/type/${english}`)
      .then((response) => response.json())
      .then((data) => {
        const icon = findNameIcon(data.sprites)
        if (!icon || cancel) return
        typeCache.set(english, icon)
        setSrc(icon)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [english])
  return (
    <span className="type">
      {src ? <img src={src} alt="" /> : null}
      {type}
    </span>
  )
}

export function ItemIcon({ name }: { name: string }) {
  const slug = ITEM_SLUG[name]
  const [src, setSrc] = useState(slug ? itemCache.get(slug) ?? "" : "")
  useEffect(() => {
    if (!slug || itemCache.has(slug)) return
    let cancel = false
    fetch(`https://pokeapi.co/api/v2/item/${slug}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("missing"))))
      .then((data: { sprites?: { default?: string } }) => {
        const next = data.sprites?.default
        if (!next || cancel) return
        itemCache.set(slug, next)
        setSrc(next)
      })
      .catch(() => undefined)
    return () => {
      cancel = true
    }
  }, [slug])
  return (
    <span className="item">
      {src ? <img src={src} alt="" /> : null}
      {name}
    </span>
  )
}

function findNameIcon(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  if ("name_icon" in value && typeof value.name_icon === "string") return value.name_icon
  for (const child of Object.values(value)) {
    const found = findNameIcon(child)
    if (found) return found
  }
  return null
}
