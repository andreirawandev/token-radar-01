// Token Radar's value model (radar-3-comps): one snapshot in, one ranked board out.
//
// The board ranks every protocol that passes the house's own pre-token test — the
// watchlist's rule, minus its $50M floor — so the board is the 40 watchlist rows plus
// 158 early rows the floor leaves out. A protocol passes when DefiLlama records no
// token for it (no CoinGecko id and no symbol), it is not a wrapped, staked or bridged
// product of a token that already trades, and it is not a versioned pool or an exchange.
// "Records no token" is DefiLlama's record, never proof the protocol has none.
//
// Implied value is comps-calibrated, computed from the snapshot at run time — no
// protocol name is ever special-cased and no multiple is hard-coded:
//
//   median   = the median market-cap / TVL of the live-token protocols in the same
//              category (the category's own signal, however thin it is)
//   comp     = (n x clamp(median) + 3 x global) / (n + 3), clamped to [0.05, 0.60]
//              — a shrinkage blend: a category with many live peers is priced by
//              its own median, a category with one or two peers is pulled toward
//              the whole-market median, and a category with no live peer at all is
//              priced at the market median. The old model threw thin categories
//              away entirely (any category under 3 peers got the market median),
//              which mis-priced the board's biggest rows: the two live Onchain
//              Capital Allocator peers both sit above $1B of TVL and trade near
//              0.01x TVL, yet Veda and Upshift were priced at the 0.21x market
//              median — seventeen times their own category. The blend fixes that
//              without letting one thin peer set a price: a single peer's median is
//              clamped to the model's own band first, so even a 400x peer (one live
//              prediction-market token on $6.6M of TVL) can only pull its category
//              to 0.31x, never to the 0.60 cap on its own.
//   global   = the median market-cap / TVL of every live-token protocol, clamped
//              to [0.05, 0.60]
//   base     = tvl_usd x comp
//   growth   = 1 + 0.6 x clamp(change_7d, -50, +100) / 100        -> [0.70, 1.60]
//   maturity = 0.75 + 0.25 x min(age_days, 1095) / 1095           -> [0.75, 1.00]
//              (age unknown: 365 days, so 0.83 — a protocol that has run a year with
//              no token is worth more than one listed last month, and a three-year
//              run with no token is the most pent-up value of all)
//   breadth  = 1 + 0.03 x min(chains - 1, 5)                      -> [1.00, 1.15]
//   implied  = round(base x growth x maturity x breadth)
//
// Why these four: TVL is the protocol's size, the comp multiple is what the market
// already pays per dollar of TVL for the same kind of protocol, seven-day growth is
// momentum, age with no token is pent-up launch value, and chain breadth is reach.
// A live-token protocol is never ranked: its market cap is the market's own value,
// and the dashboard shows it beside the board as the comparable set.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  comp_floor: number;
  comp_cap: number;
  shrink_k: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_extra: number;
}

export const MODEL: ModelConstants = {
  comp_floor: 0.05,
  comp_cap: 0.6,
  shrink_k: 3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.75,
  maturity_range: 0.25,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.03,
  breadth_max_extra: 5,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3-comps';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's comparables: the live-token protocols that set its multiple. */
export interface CategoryComp {
  category: string;
  multiple: number;
  median: number;
  comps_n: number;
  fallback: boolean;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    comp_multiple: number;
    comp_category: string;
    comp_n: number;
    comp_median: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; farm_steps travel with it so the page and board.json agree. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  comp_multiple: number;
  comp_median: number;
  comp_n: number;
  watchlist: boolean;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** One live-token peer: the name and market-cap / TVL the detail view shows. */
export interface CompPeer {
  slug: string;
  name: string;
  mcap_tvl: number;
}

/** Everything the dashboard needs: the board, the live set, the comps, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_median: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  comps: CategoryComp[];
  comp_peers: Record<string, CompPeer[]>;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list, else `fallback`. */
function median(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The comparables: one shrunk market-cap / TVL multiple per category, from the
 * live-token protocols. The category's own median is clamped to the model's band
 * first, then blended toward the whole-market median with a pseudo-count of
 * `shrink_k` market observations: many peers, the category speaks; one peer, the
 * market speaks louder; no peer at all, the market median is the multiple.
 */
export function categoryComps(snapshot: Snapshot, model: ModelConstants = MODEL): { byCategory: Map<string, CategoryComp>; global: number } {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const globalRaw = median(live.map((p) => p.mcap_usd! / p.tvl_usd), 0.17);
  const global = round4(Math.min(model.comp_cap, Math.max(model.comp_floor, globalRaw)));
  const byCategory = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCategory.set(key, list);
  }
  const clamp = (n: number): number => Math.min(model.comp_cap, Math.max(model.comp_floor, n));
  const out = new Map<string, CategoryComp>();
  for (const [category, ratios] of byCategory) {
    const rawMedian = median(ratios, globalRaw);
    const shrunk = (ratios.length * clamp(rawMedian) + model.shrink_k * global) / (ratios.length + model.shrink_k);
    out.set(category, {
      category,
      multiple: round4(clamp(shrunk)),
      median: round4(rawMedian),
      comps_n: ratios.length,
      fallback: false,
    });
  }
  return { byCategory: out, global };
}

/** The comp multiple one protocol gets: its category's, else the whole-market median. */
export function compFor(p: SnapshotProtocol, comps: { byCategory: Map<string, CategoryComp>; global: number }): CategoryComp {
  const found = comps.byCategory.get(p.category ?? 'Other');
  if (found !== undefined) return found;
  return { category: p.category ?? 'Other', multiple: comps.global, median: comps.global, comps_n: 0, fallback: true };
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  comps: { byCategory: Map<string, CategoryComp>; global: number },
  model: ModelConstants = MODEL,
): { implied: number; comp: CategoryComp; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const comp = compFor(protocol, comps);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const breadthMult = 1 + extraChains * model.breadth_per_chain;
  const base = protocol.tvl_usd * comp.multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult));
  return { implied, comp, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking in a name: a product of a token that trades. */
const WRAPPED_OR_STAKED = /\b(wrapped|staked|staking)\b/i;
/** The exchange names the watchlist rule keeps out. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
/** Categories that are a wrapped, staked or bridged product, not a launch of their own. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all (no CoinGecko id and no symbol). */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: it records no token, and it passes
 * the watchlist's own product test — not a bridge, liquid-staking or restaking product,
 * not a versioned pool, no wrapped/staked word in its name, not an exchange's product.
 * The TVL floor is deliberately NOT part of this test: the floor is where the house's
 * reading started, and the early radar is everything below it that still passes.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_OR_STAKED.test(p.name)) return false;
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const comps = categoryComps(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, whatever its TVL.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other protocol that passes the same pre-token test.
  // No TVL cut and no hand-picked names: the test, not a list, decides the board.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, comps, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      comp_multiple: s.comp.multiple,
      comp_category: s.comp.category,
      comp_n: s.comp.comps_n,
      comp_median: s.comp.median,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} as collateral, borrow a small amount against it, then repay the borrow so both sides of the position are on record.`;
  if (c.includes('dex') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain}, in the pair the protocol itself lists first, and keep the position in range.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain}, open one small hedged position, and close it after a day so volume and margin are both counted.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} on ${chain} and place one position in a market that settles within the week, then let it resolve.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain}, keep the vault shares, and check the vault's allocation page once a week.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}, hold it in the protocol's own savings or staking module, and do not move it to an exchange.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain}, hold it in the wallet that minted it, and claim any yield it accrues inside the protocol.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for a protocol you already use, and keep the policy active for the full cover period.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position through at least one funding cycle.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain}, join its governance or incentives program, and vote or claim in at least one epoch.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s own chain, use it in one app built on that chain, and keep a small balance for gas.`;
  if (c.includes('yield') || c.includes('farm') || c.includes('aggregator')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL strategy on ${chain} and leave it compounding for the full hold period.`;
  if (c.includes('launchpad')) return `Deposit $${capital} into ${name} on ${chain}, complete its eligibility task, and hold the allocation token until the sale closes.`;
  if (c.includes('payment')) return `Fund $${capital} through ${name} on ${chain} and make one real payment or settlement with it, not a self-transfer.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly action that keeps a position qualifying, matched to the category. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) return 'Make one qualifying action each week: add or remove a small amount of collateral, or open and repay a tiny borrow.';
  if (c.includes('dex')) return 'Make one qualifying action each week: one swap through the protocol, or a small add or remove of liquidity.';
  if (c.includes('perpetual') || c.includes('derivative')) return 'Make one qualifying action each week: one small trade, or a margin top-up that keeps the position open.';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'Make one qualifying action each week: check the vault allocation, and move a small amount between vaults if the protocol allows it.';
  if (c.includes('rwa') || c.includes('stable')) return 'Make one qualifying action each week: claim accrued yield inside the protocol, or mint a small additional amount.';
  return 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.';
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names. Costs are in US dollars and times in minutes or days.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p);
  const extraChains = p.chains.length > 1 ? ` It also runs on ${p.chains.slice(1, 3).join(' and ')}, so repeat the deposit there only if the protocol counts each chain separately.` : '';
  return [
    {
      text: `Open the protocol's own site from its DefiLlama listing, connect a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.${extraChains}`,
      cost: 'under $3 of gas for the first transaction',
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas on ${chain}`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and do not withdraw and re-deposit to game the count.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page from its own site and claim only from the link it publishes; never pay anyone to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, then unwind in reverse order — claim first, withdraw second — so nothing is left locked.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js, with the farm plan and the model breakdown. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    comp_multiple: row.model.comp_multiple,
    comp_median: row.model.comp_median,
    comp_n: row.model.comp_n,
    watchlist: onWatchlist,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    farm_steps: row.farm_steps,
  };
}

/**
 * The peers that set each category's multiple: the live-token protocols whose
 * market-cap / TVL sits closest to the category median, up to three, so the
 * detail view can name the peers behind the number instead of the largest
 * live tokens in the category. Deterministic: ties break by slug.
 */
export function compPeers(snapshot: Snapshot, comps: { byCategory: Map<string, CategoryComp>; global: number }): Record<string, CompPeer[]> {
  const live = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const out: Record<string, CompPeer[]> = {};
  for (const [category, comp] of comps.byCategory) {
    const peers = live
      .filter((p) => (p.category ?? 'Other') === category)
      .map((p) => ({ slug: p.slug, name: p.name, mcap_tvl: round4(p.mcap_usd! / p.tvl_usd), gap: Math.abs(p.mcap_usd! / p.tvl_usd - comp.median) }))
      .sort((a, b) => a.gap - b.gap || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
      .slice(0, 3)
      .map(({ slug, name, mcap_tvl }) => ({ slug, name, mcap_tvl }));
    out[category] = peers;
  }
  return out;
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const comps = categoryComps(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const compList: CategoryComp[] = [...comps.byCategory.values()].sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_median: comps.global,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    comps: compList,
    comp_peers: compPeers(snapshot, comps),
    rows: board.map((r) => radarRow(r, snapshot.watchlist.includes(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
