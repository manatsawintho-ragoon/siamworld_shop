/**
 * English programmatic SEO dataset (white-hat).
 *
 * Scope note: the product is Thailand-first (PromptPay, TrueMoney, EasySlip,
 * THB-only wallets). These pages exist because Thai and SEA server owners
 * search the English terms - "minecraft webshop", "tebex alternative",
 * "minecraft rcon" - far more than the Thai equivalents, not because we are
 * chasing US/EU traffic that cannot pay us. Copy therefore states the Thai
 * payment scope plainly rather than implying global availability; an operator
 * who needs card payments should bounce here instead of converting and
 * refunding.
 *
 * Every entry must be a genuinely useful, distinct page. Do not add near-
 * duplicates to farm a keyword variant - fold the variant into an existing
 * page's `keywords` instead.
 *
 * House style: no em dashes in user-facing copy (use "-", ":" or parentheses).
 */

import type { LandingPage } from './keywords';

export const EN_CLUSTERS: Record<string, { label: string; icon: string }> = {
  core: { label: 'Hosted webshop', icon: 'store' },
  payment: { label: 'Payments and top-ups', icon: 'wallet' },
  delivery: { label: 'Automatic delivery', icon: 'bolt' },
  features: { label: 'Store features', icon: 'cubes' },
  servers: { label: 'By server type', icon: 'server' },
  alternative: { label: 'Comparisons', icon: 'right-left' },
  guide: { label: 'Guides', icon: 'graduation-cap' },
};

export const EN_LANDING_PAGES: LandingPage[] = [
  {
    slug: 'minecraft-webshop',
    cluster: 'core',
    h1: 'Minecraft Webshop: A Hosted Store For Your Server',
    title: 'Minecraft Webshop - Hosted Store With Automatic Delivery',
    description:
      'A hosted Minecraft webshop for Thai and SEA servers. Players log in with their existing AuthMe account, top up with PromptPay or TrueMoney, and items are delivered over RCON within seconds. Free 7-day trial.',
    keywords: [
      'minecraft webshop',
      'minecraft webstore',
      'minecraft server webshop',
      'hosted minecraft webshop',
      'minecraft webshop hosting',
      'minecraft webshop saas',
      'minecraft server store',
      'best minecraft webshop',
      'minecraft webshop without coding',
    ],
    intro: [
      'A Minecraft webshop is the storefront that turns your server into a business: players buy ranks, kits, currency or cosmetics on a website, and the server hands the goods over automatically. Running one yourself means hosting, a payment integration, an RCON bridge and a refund path when delivery fails. This is that whole stack, hosted and maintained for you.',
      'SIAMSITE is built for Thai and Southeast Asian servers specifically. Top-ups run on PromptPay with automatic slip verification and TrueMoney Angpao, wallets are denominated in Thai Baht, and delivery reaches your server through an outbound bridge plugin so you never open an RCON port to the internet.',
      'Setup is a domain, a plugin and your product list. There is nothing to compile and no server-side code to write, which is why most operators are selling within an afternoon.',
    ],
    bullets: [
      'Players sign in with the AuthMe account they already use in-game, so there is no second password to remember and no account-linking step to lose people at.',
      'PromptPay top-ups are verified automatically against the payment slip, so a player who pays at 3am is credited at 3am without you being awake.',
      'Purchases are delivered by RCON command the moment payment clears, and a failed delivery refunds the wallet automatically instead of leaving the player short.',
      'The store never charges a player who is offline, because delivery would silently fail: the purchase flow checks live player presence first.',
      'Your own domain is supported through a single CNAME record, with the HTTPS certificate issued and renewed for you.',
      'Loot boxes, rank tiers, redeem codes, discount codes, stock limits and per-item sale caps are built in rather than sold as add-ons.',
    ],
    faqs: [
      {
        q: 'Do I need to install a plugin on my Minecraft server?',
        a: 'Yes, one lightweight bridge plugin. It opens an outbound WebSocket connection to the platform, which means you do not need to expose your RCON port, set up a VPN, or give out your server IP. It runs on Paper, Purpur, Spigot and Folia.',
      },
      {
        q: 'Does this work with my existing player accounts?',
        a: 'It reads directly from your AuthMe database, so every registered player already has a working webshop login on day one. Passwords are never copied or duplicated: the platform verifies against the AuthMe bcrypt hash you already have.',
      },
      {
        q: 'What happens if the item never reaches the player?',
        a: 'The purchase is wrapped in a wallet transaction. If the RCON command fails or the server is unreachable, the charge is rolled back and the wallet is credited again automatically. Failed deliveries are logged so you can see exactly what happened.',
      },
      {
        q: 'Can players outside Thailand pay?',
        a: 'Not currently. Top-ups run on PromptPay and TrueMoney and all wallets are in Thai Baht, so this suits servers whose player base pays with Thai methods. There is no card or PayPal option today.',
      },
      {
        q: 'How much does a Minecraft webshop cost?',
        a: 'There is a free 7-day trial with no card required, then a discounted first month at 99 THB. After that, plans run from 249 THB per month, with cheaper 3-month and 6-month terms. Platform commission is not taken on your sales.',
      },
    ],
    related: ['tebex-alternative', 'minecraft-rcon-item-delivery', 'minecraft-webshop-pricing', 'minecraft-payment-gateway-thailand'],
  },

  {
    slug: 'minecraft-donation-store',
    cluster: 'core',
    h1: 'Minecraft Donation Store With Instant Rewards',
    title: 'Minecraft Donation Store - Instant, Automatic Rewards',
    description:
      'Run a Minecraft donation store where ranks and perks are granted instantly. Automatic PromptPay and TrueMoney top-ups, RCON delivery, and a full audit trail of every donation.',
    keywords: [
      'minecraft donation store',
      'minecraft server store',
      'minecraft donation website',
      'minecraft server monetization',
      'minecraft ecommerce',
      'minecraft item shop',
    ],
    intro: [
      'Donation stores fail for a boring reason: the reward arrives late. A player pays, waits for an admin to notice, and asks about it in Discord. The second time they think twice about paying at all. Automating the delivery is the single biggest thing you can do for donation revenue.',
      'This platform closes that gap. Payment verification, wallet credit and in-game delivery are one unbroken chain, so the perk lands while the player is still online and still excited about it.',
      'Every donation is recorded as a ledger entry separate from any bonus credit you hand out, which keeps your real revenue figures clean when you reconcile the month.',
    ],
    bullets: [
      'Donations convert to in-game rewards without an admin in the loop, day or night.',
      'Rank purchases run any RCON command you choose, so LuckPerms, EssentialsX or a custom plugin all work without an integration.',
      'A transaction ledger separates real money paid from promotional bonus credit, so accounting and leaderboards stay accurate.',
      'Top donor rankings can be surfaced on the site to encourage repeat support.',
      'Redeem codes and discount codes let you run events and giveaways without manual payouts.',
      'Every admin action is written to an audit log, which matters once you have more than one staff member touching the store.',
    ],
    faqs: [
      {
        q: 'Can I give a rank and run extra commands in the same purchase?',
        a: 'Yes. A product can carry multiple RCON commands, so a single purchase can grant a permission group, hand over a kit and broadcast an announcement together.',
      },
      {
        q: 'Do you take a cut of donations?',
        a: 'No platform commission is taken on your sales. You pay a flat subscription. Note that EasySlip, the slip verification provider, charges a small per-verification fee that is disclosed in the pricing page.',
      },
      {
        q: 'What stops someone from claiming a donation twice?',
        a: 'Each purchase carries an idempotency key, so a double-clicked button or a retried request resolves to one order rather than two charges. Slip verification also rejects a payment slip that has already been used.',
      },
      {
        q: 'Can I offer donation tiers with limited stock?',
        a: 'Yes. Products support stock counts, per-player purchase limits and a sale pause switch, which is how most operators run limited founder ranks or seasonal bundles.',
      },
    ],
    related: ['minecraft-webshop', 'minecraft-rank-shop', 'how-to-monetize-minecraft-server', 'minecraft-redeem-codes'],
  },

  {
    slug: 'tebex-alternative',
    cluster: 'alternative',
    h1: 'Tebex Alternative For Thai Minecraft Servers',
    title: 'Tebex Alternative With PromptPay And TrueMoney Support',
    description:
      'Looking for a Tebex alternative that accepts PromptPay and TrueMoney? Compare payment methods, payout speed, fees and delivery, and see when switching actually makes sense.',
    keywords: [
      'tebex alternative',
      'minecraft webshop alternative',
      'tebex vs',
      'alternative to tebex',
      'minecraft store alternative',
      'tebex thailand',
    ],
    intro: [
      'Tebex is a capable platform and the honest answer is that plenty of servers should stay on it. It has global card coverage, a long track record and a large plugin ecosystem. If your players pay with cards and you are happy with payouts, switching gains you little.',
      'The case for moving is narrower and specific: your players pay with Thai methods. PromptPay and TrueMoney Angpao are how most Thai players actually hold and spend money, and a store that only takes cards quietly loses the ones without one, which in a Minecraft audience skews young and is a large share.',
      'The other common trigger is payout timing. Money from your store lands in your account on your schedule rather than a platform payout cycle, because top-ups settle directly to your own PromptPay account.',
    ],
    bullets: [
      'PromptPay QR with automatic slip verification, plus TrueMoney Angpao, as first-class payment methods rather than workarounds.',
      'Funds settle to your own account, so you are not waiting on a platform payout schedule.',
      'No commission on sales. You pay a flat monthly subscription instead of a percentage of revenue.',
      'AuthMe login means players use their in-game account, with no separate store registration to abandon.',
      'Delivery runs over an outbound bridge connection, so no RCON port or server IP is exposed.',
      'Thai-language interface and Thai-language support, which matters when a player raises a payment problem.',
    ],
    faqs: [
      {
        q: 'Should I switch from Tebex?',
        a: 'Only if your players pay with Thai methods. If your revenue is mostly international card payments, Tebex covers that far better than this platform does, and you should stay. The trial exists so you can test with real players before deciding.',
      },
      {
        q: 'Can I run both at the same time?',
        a: 'Yes, and it is a sensible way to migrate. Point Thai players at the PromptPay store and leave card payers on your existing one, then compare conversion over a month before committing.',
      },
      {
        q: 'Does it accept credit cards or PayPal?',
        a: 'No. Payment methods are PromptPay and TrueMoney Angpao, and all wallets are in Thai Baht. If you need card processing, this is not the right platform for you.',
      },
      {
        q: 'How hard is migrating my product catalogue?',
        a: 'Products are recreated in the admin dashboard with their RCON commands. There is no automated importer, so budget an hour or two for a typical catalogue. Player accounts need no migration at all because logins read from AuthMe.',
      },
    ],
    related: ['minecraft-webshop', 'best-minecraft-webshop', 'minecraft-payment-gateway-thailand', 'minecraft-webshop-pricing'],
  },

  {
    slug: 'best-minecraft-webshop',
    cluster: 'alternative',
    h1: 'How To Choose The Best Minecraft Webshop',
    title: 'Best Minecraft Webshop: What To Compare Before You Commit',
    description:
      'A practical checklist for comparing Minecraft webshop platforms: payment coverage, delivery reliability, refund handling, fees, security and lock-in. Written for server owners, not marketers.',
    keywords: [
      'best minecraft webshop',
      'best minecraft webstore',
      'minecraft webshop comparison',
      'compare minecraft webshop',
      'minecraft webshop review',
    ],
    intro: [
      'Most webshop comparisons are written by the platforms themselves, which is why they all conclude the same way. This one is a checklist you can apply to any provider, including this one, and a few of the criteria are places where we lose.',
      'The order matters. Payment coverage and delivery reliability decide whether you make money at all. Features and theming decide how the store feels. Operators routinely pick on the second list and then discover the first one was the constraint.',
    ],
    bullets: [
      'Payment coverage: can the players you actually have pay you? A platform with fifty methods your audience does not use is worse than one with the two they do.',
      'Delivery reliability: what happens when the server is offline or restarting mid-purchase? Ask specifically whether the charge is refunded automatically or held in limbo.',
      'Payout timing: does money reach you directly, or sit in a platform balance until a payout cycle clears?',
      'Total cost: compare a flat subscription against a percentage commission at your actual monthly revenue. Commission models get expensive precisely when you succeed.',
      'Security posture: does delivery require exposing an RCON port to the internet? An outbound connection is meaningfully safer than an inbound one.',
      'Lock-in: can you leave with your player data and your domain? A store on your own domain is portable in a way a platform subdomain is not.',
      'Support language and hours: a payment dispute is stressful, and a support queue in a language your players do not speak turns a small problem into a public one.',
    ],
    faqs: [
      {
        q: 'What is the single most common mistake when choosing?',
        a: 'Picking on features and theming before confirming payment coverage. A store your players cannot pay into has no features worth discussing. Confirm the payment path with a real player before anything else.',
      },
      {
        q: 'Is a self-hosted webshop cheaper?',
        a: 'On paper, yes. In practice you are taking on hosting, TLS certificates, payment verification, RCON reliability, refund logic and security patching. That is real ongoing work, and the failure modes cost you player trust rather than just time.',
      },
      {
        q: 'How do I test a platform properly?',
        a: 'Run one real product at a low price and have three or four regular players buy it on their own phones. Real players find the friction that a staff walkthrough never does.',
      },
    ],
    related: ['tebex-alternative', 'minecraft-webshop', 'minecraft-webshop-pricing', 'how-to-monetize-minecraft-server'],
  },

  {
    slug: 'minecraft-payment-gateway-thailand',
    cluster: 'payment',
    h1: 'Minecraft Payment Gateway: PromptPay And TrueMoney',
    title: 'Minecraft Payment Gateway With PromptPay And TrueMoney',
    description:
      'Accept PromptPay QR and TrueMoney Angpao in your Minecraft store, with automatic slip verification so top-ups are credited in seconds without an admin checking screenshots.',
    keywords: [
      'minecraft payment gateway',
      'minecraft promptpay',
      'minecraft truemoney',
      'promptpay minecraft server',
      'truemoney angpao minecraft',
      'minecraft automatic topup',
    ],
    intro: [
      'The manual version of this is familiar to every Thai server owner: a player pays, screenshots the slip, posts it in Discord, and waits for staff to eyeball it and credit the account by hand. It works until you have volume, and it never works at night.',
      'Automatic verification replaces the eyeballing. A generated PromptPay QR carries the exact amount, the uploaded slip is verified against the real transaction through EasySlip, and the wallet is credited only when the receiving account and amount both match.',
      'TrueMoney Angpao works alongside it, which covers the players who hold money in a wallet app rather than a bank account.',
    ],
    bullets: [
      'PromptPay QR codes are generated per top-up with the amount embedded, so there is nothing for the player to type wrong.',
      'Slip verification checks the receiving account and the amount, and rejects a slip that has already been redeemed once.',
      'TrueMoney Angpao links are accepted and credited automatically.',
      'Per-method top-up bonuses let you nudge players toward whichever method costs you less to process.',
      'The transaction ledger records real money received separately from bonus credit, so your revenue reporting stays honest.',
      'Failed and suspicious top-ups are logged with a reason, so you can answer a player question with facts rather than a guess.',
    ],
    faqs: [
      {
        q: 'How fast is a top-up credited?',
        a: 'Seconds. The player uploads the slip, verification runs against the payment provider, and the wallet balance updates without staff involvement.',
      },
      {
        q: 'Can someone reuse an old slip to get free credit?',
        a: 'No. Each slip is checked against previously redeemed slips and rejected if it has already been used, and the receiving account and amount must both match the expected top-up.',
      },
      {
        q: 'Is there a fee for slip verification?',
        a: 'EasySlip charges a small per-verification fee, currently around 0.4 THB per slip, which is disclosed on the pricing page. The platform itself does not add a commission on top.',
      },
      {
        q: 'Does money go to my account or yours?',
        a: 'Directly to your own PromptPay account. The platform verifies that the payment arrived; it does not hold your funds or run a payout cycle.',
      },
      {
        q: 'What if a player enters their PromptPay ID as a national ID number?',
        a: 'Both national ID and bank account number formats are supported for the receiving account, and the verification matches on account identity and name together rather than assuming one format.',
      },
    ],
    related: ['minecraft-webshop', 'minecraft-donation-store', 'tebex-alternative', 'minecraft-rcon-item-delivery'],
  },

  {
    slug: 'minecraft-rcon-item-delivery',
    cluster: 'delivery',
    h1: 'Automatic Item Delivery Over Minecraft RCON',
    title: 'Minecraft RCON Automatic Item Delivery, Without Open Ports',
    description:
      'Deliver purchases automatically with RCON commands, using an outbound bridge plugin so no RCON port is exposed. Includes queueing, retries and automatic refunds on failure.',
    keywords: [
      'minecraft rcon',
      'automatic item delivery',
      'minecraft rcon webshop',
      'minecraft webshop with rcon',
      'rcon item delivery',
      'minecraft rcon plugin',
    ],
    intro: [
      'RCON is the remote console protocol built into Minecraft servers, and it is how a webshop actually hands over goods: the store runs a console command such as a permission grant or an item give, exactly as an operator would type it.',
      'The traditional setup exposes your RCON port to the internet so the store can connect inbound. That is a genuine security problem, and behind an anti-DDoS provider it often does not even work, because the provider drops the protocol data mid-handshake.',
      'The bridge plugin inverts the direction. Your server opens an outbound WebSocket connection to the platform and commands travel down it, so there is no open port, no VPN and no server IP to leak.',
    ],
    bullets: [
      'No inbound RCON port, no VPN, and no need to publish your server IP anywhere.',
      'Works behind anti-DDoS providers that break conventional inbound RCON connections.',
      'Commands are queued and retried, so a brief restart does not turn into a lost delivery.',
      'A delivery that ultimately fails refunds the player wallet automatically rather than leaving them out of pocket.',
      'Purchases are blocked for offline players, because a command aimed at an offline player would silently do nothing.',
      'Runs on Paper, Purpur, Spigot and Folia, with every executed command written to a log you can inspect.',
    ],
    faqs: [
      {
        q: 'Do I have to open my RCON port?',
        a: 'No, and you should not. The bridge plugin makes an outbound connection, which is why it works behind anti-DDoS and NAT setups where inbound RCON does not.',
      },
      {
        q: 'Why does my inbound RCON connect but then time out on auth?',
        a: 'That pattern almost always means an anti-DDoS provider is dropping the packet payload after the handshake. Testing RCON from localhost on the machine itself confirms it. The bridge plugin sidesteps the problem entirely.',
      },
      {
        q: 'What happens if the server is down when someone buys?',
        a: 'The purchase checks live player presence first, so a player who is not online cannot buy. If delivery fails after the charge, the wallet transaction rolls back and the money is returned.',
      },
      {
        q: 'Does it support Folia?',
        a: 'Yes. The bridge runs off the main thread already, so Folia is supported.',
      },
      {
        q: 'Can I use it with a Velocity or BungeeCord network?',
        a: 'Yes. Connect the bridge to the backend servers that hold the player data. Note that proxies do not forward RCON themselves, which is a common source of confusion when setting this up.',
      },
    ],
    related: ['minecraft-webshop', 'minecraft-webshop-authme', 'minecraft-webshop-paper-purpur-velocity', 'minecraft-payment-gateway-thailand'],
  },

  {
    slug: 'minecraft-webshop-authme',
    cluster: 'delivery',
    h1: 'Minecraft Webshop With AuthMe Login',
    title: 'Minecraft Webshop With AuthMe: One Account, No Second Signup',
    description:
      'Let players sign in to your webshop with the AuthMe account they already use in-game. No duplicate passwords, no account linking, and no registration step to lose people at.',
    keywords: [
      'minecraft webshop with authme',
      'minecraft authme',
      'authme web login',
      'authme webshop',
      'minecraft website login authme',
    ],
    intro: [
      'Every extra signup step costs you buyers. If a player has to create a second account on your store, remember a second password and link it back to their username, a meaningful share of them simply do not finish.',
      'AuthMe login removes the step. The store authenticates against the same AuthMe table your server already uses, so a player who can log into your server can log into your store with the identical credentials.',
      'Passwords are never copied into a second system. Verification runs against the existing AuthMe bcrypt hash, so there is no new place for a password database to leak from.',
    ],
    bullets: [
      'Players use their in-game username and password with nothing new to remember.',
      'No account-linking flow, and therefore no support tickets from players who linked the wrong username.',
      'Passwords stay in AuthMe. The platform verifies the existing hash rather than storing its own copy.',
      'The username on the account is the username commands are delivered to, which removes an entire class of mis-delivery.',
      'Web bans and suspensions are separate from in-game bans, so you can block a store abuser without kicking them off the server.',
      'Admin access uses its own rotating credential rather than a player password, so store administration is not tied to a game account.',
    ],
    faqs: [
      {
        q: 'Does this change my AuthMe setup?',
        a: 'No schema changes are made to the AuthMe table. It is read for verification. Your plugin configuration stays as it is.',
      },
      {
        q: 'What if a player changes their in-game password?',
        a: 'The store picks it up immediately, because it verifies against AuthMe at login rather than caching a copy.',
      },
      {
        q: 'Are usernames case sensitive?',
        a: 'Matching is done against the stored account rather than the exact casing typed at login, so a player who capitalises differently still resolves to the right account for delivery.',
      },
      {
        q: 'Can I ban someone from the store only?',
        a: 'Yes. Web ban and suspend are tracked separately from account deletion and from in-game punishment, with a reason recorded for each.',
      },
    ],
    related: ['minecraft-rcon-item-delivery', 'minecraft-webshop', 'minecraft-webshop-paper-purpur-velocity', 'minecraft-rank-shop'],
  },

  {
    slug: 'minecraft-lootbox',
    cluster: 'features',
    h1: 'Minecraft Loot Box And Crate System For Your Store',
    title: 'Minecraft Loot Box System With Weighted Odds And Rarity Tiers',
    description:
      'Add loot boxes to your Minecraft store with weighted drop rates, rarity tiers from Common to Mythic, an animated opening, and a web inventory players claim from.',
    keywords: [
      'minecraft lootbox',
      'minecraft crate system',
      'minecraft gacha',
      'minecraft loot box website',
      'minecraft crate keys',
    ],
    intro: [
      'Loot boxes are the highest-margin thing most Minecraft stores sell, because the same item pool serves every price point and the opening itself is the entertainment. They are also the easiest thing to implement badly, in ways players notice and resent.',
      'The system here uses explicit weighted odds per item and rarity tiers running from Common to Mythic, with an animated reel and sound on opening. Rewards land in a web inventory the player claims when they are online, so nothing is lost to a full inventory or a disconnect at the wrong moment.',
      'Odds are configured per item rather than inferred, which means you can state your drop rates publicly. Being upfront about rates is both good practice and increasingly expected by players.',
    ],
    bullets: [
      'Per-item weights give you exact control over drop rates rather than approximate tiers.',
      'Rarity tiers from Common through Mythic, with consistent colours and labels across every page of the store.',
      'An animated opening sequence with sound, rather than a results table appearing instantly.',
      'Rewards go to a web inventory in a pending state and are delivered by RCON when the player claims them online.',
      'Item stock and per-player limits work on box contents, so a genuinely rare reward can be genuinely finite.',
      'Opening history is recorded, which lets you answer "I did not get my item" with the actual record.',
    ],
    faqs: [
      {
        q: 'How are drop rates decided?',
        a: 'You set a weight per item, and the chance of any item is its weight over the total. There is no hidden pity timer or adjustment, so the number you publish is the number players get.',
      },
      {
        q: 'What if the player is offline or their inventory is full?',
        a: 'The reward sits in the web inventory as pending. It is delivered when the player claims it while online, so nothing is destroyed by a full inventory.',
      },
      {
        q: 'Can I limit how many of a rare item ever drop?',
        a: 'Yes, through stock counts on the item. Once it is exhausted it stops appearing, which is how limited seasonal rewards are usually run.',
      },
      {
        q: 'Is there a cooldown on opening?',
        a: 'Yes, a short per-player cooldown is enforced server-side to stop scripted mass opening.',
      },
    ],
    related: ['minecraft-rank-shop', 'minecraft-webshop', 'minecraft-redeem-codes', 'how-to-monetize-minecraft-server'],
  },

  {
    slug: 'minecraft-rank-shop',
    cluster: 'features',
    h1: 'Minecraft Rank Shop: Sell VIP Ranks Automatically',
    title: 'Minecraft Rank Shop - Sell VIP Ranks And Kits Automatically',
    description:
      'Sell VIP ranks, kits and permissions from your Minecraft store. Any RCON command works, so LuckPerms and EssentialsX need no special integration.',
    keywords: [
      'minecraft rank shop',
      'minecraft item shop',
      'sell minecraft ranks',
      'minecraft vip rank store',
      'luckperms webshop',
    ],
    intro: [
      'Ranks are the backbone of most Minecraft store revenue: they are recurring, they are visible to other players, and they cost nothing to produce. The work is in delivering them reliably and handling the edge cases around upgrades and expiry.',
      'Because products run arbitrary RCON commands, whatever permission plugin you already use is already supported. A rank purchase is just the command you would type in console, executed automatically after payment clears.',
      'Multiple commands per product means a rank can grant a permission group, hand out a starter kit and broadcast the purchase to the server in one transaction.',
    ],
    bullets: [
      'Works with LuckPerms, EssentialsX, GroupManager or anything else that takes a console command.',
      'Multiple commands per product, so one purchase can grant permissions, items and an announcement together.',
      'Timed ranks are handled by your permission plugin as usual, since the command is passed through unchanged.',
      'Product images, extra gallery images and descriptions let a rank page actually sell the rank.',
      'Discount codes and per-product sale limits support launch promotions without manual work.',
      'Stock limits and a sale pause switch let you close a tier without deleting it.',
    ],
    faqs: [
      {
        q: 'Do timed or expiring ranks work?',
        a: 'Yes, if your permission plugin supports them. The store passes your command through as written, so a LuckPerms command with a duration behaves exactly as it would in console.',
      },
      {
        q: 'How do I handle rank upgrades?',
        a: 'Most operators create an upgrade product priced at the difference, whose command removes the old group and adds the new one. Because a product can run several commands, this needs no special support.',
      },
      {
        q: 'Can I hide a rank without deleting it?',
        a: 'Yes. Pausing sale keeps the product and its history intact while removing it from the storefront.',
      },
      {
        q: 'What if the command is wrong?',
        a: 'The command log records what was executed and what the server returned, so a mistyped command is visible rather than mysterious. Test with a low-priced product before launching a tier.',
      },
    ],
    related: ['minecraft-donation-store', 'minecraft-lootbox', 'minecraft-rcon-item-delivery', 'minecraft-webshop'],
  },

  {
    slug: 'minecraft-redeem-codes',
    cluster: 'features',
    h1: 'Minecraft Redeem Codes And Gift Cards',
    title: 'Minecraft Redeem Codes For Events, Giveaways And Refunds',
    description:
      'Generate redeem codes that grant wallet credit or run RCON rewards. One use per player, with full redemption logs, for giveaways, events and compensation.',
    keywords: [
      'minecraft redeem code',
      'minecraft gift card',
      'minecraft voucher system',
      'minecraft promo code',
      'minecraft giveaway system',
    ],
    intro: [
      'Redeem codes solve three recurring problems at once: running a giveaway without manually paying out, compensating players after downtime, and letting someone gift store credit to a friend.',
      'A code can either credit the wallet with Baht or fire an RCON reward directly. Codes are enforced one use per player, and every redemption is logged, which is what you need when a giveaway result is disputed.',
      'Discount codes are a separate mechanism for percentage or fixed reductions at checkout, so promotions and giveaways do not have to share one system.',
    ],
    bullets: [
      'Codes grant either wallet credit in Baht or a direct RCON reward.',
      'One use per player is enforced at redemption, so a shared code cannot be farmed by one person.',
      'Redemption logs record who redeemed what and when.',
      'Bulk generation for event giveaways and streamer campaigns.',
      'Separate discount codes handle percentage and fixed-amount reductions at checkout.',
      'Useful for compensation after downtime, without adjusting balances by hand.',
    ],
    faqs: [
      {
        q: 'Can one code be used by many players?',
        a: 'Yes. A code can be redeemed by many different players, but only once each, which is the usual shape for a public giveaway code.',
      },
      {
        q: 'Do codes expire?',
        a: 'Codes can be limited by use count and disabled when a campaign ends, so an old stream code does not stay live indefinitely.',
      },
      {
        q: 'What is the difference between a redeem code and a discount code?',
        a: 'A redeem code grants something outright, either wallet credit or an in-game reward. A discount code reduces the price of a purchase at checkout. They are configured separately.',
      },
    ],
    related: ['minecraft-lootbox', 'minecraft-donation-store', 'minecraft-webshop', 'how-to-monetize-minecraft-server'],
  },

  {
    slug: 'minecraft-webshop-paper-purpur-velocity',
    cluster: 'servers',
    h1: 'Minecraft Webshop For Paper, Purpur, Spigot And Velocity',
    title: 'Minecraft Webshop For Paper, Purpur, Folia And Velocity Networks',
    description:
      'Server compatibility for the hosted webshop: Paper, Purpur, Spigot and Folia are supported, and Velocity or BungeeCord networks connect through the backend servers.',
    keywords: [
      'minecraft webshop for paper server',
      'minecraft webshop for purpur',
      'minecraft webshop for velocity',
      'minecraft webshop bungeecord',
      'paper webshop plugin',
      'folia webshop',
    ],
    intro: [
      'Compatibility questions come up before anything else, so here is the direct answer. The bridge plugin targets the Bukkit API, which means Paper, Purpur and Spigot all work, and Folia is supported because the bridge already runs off the main thread.',
      'Proxy networks need one clarification that trips people up: Velocity and BungeeCord do not forward RCON. The bridge belongs on the backend servers that actually hold player data and execute commands, not on the proxy itself.',
      'For a network, the usual arrangement is a bridge on each backend server, with products pointed at whichever server should execute the command.',
    ],
    bullets: [
      'Paper, Purpur and Spigot are supported through the standard Bukkit API.',
      'Folia is supported: the bridge does not run on the main thread.',
      'Velocity and BungeeCord networks work by connecting backend servers rather than the proxy.',
      'Multiple servers can be registered, with each product delivering to the correct one.',
      'Player presence is polled across connected servers, so the online check works on a network.',
      'No port forwarding on any server in the network, because every connection is outbound.',
    ],
    faqs: [
      {
        q: 'Can I install the bridge on my Velocity proxy?',
        a: 'No, and it will not work if you try. Proxies do not handle RCON or execute game commands. Install it on the backend Paper or Purpur servers instead.',
      },
      {
        q: 'Does it work on a network with several servers?',
        a: 'Yes. Register each server and assign products to whichever server should run the command, which is how survival and skyblock stores are usually kept separate on one network.',
      },
      {
        q: 'Which Minecraft versions are supported?',
        a: 'The bridge uses standard Bukkit APIs and console command execution, so it is not tied to a specific game version. Modern Paper and Purpur builds are what it is tested against.',
      },
      {
        q: 'Will it affect server performance?',
        a: 'It holds one outbound WebSocket connection and executes commands as they arrive, off the main thread. The overhead is negligible on any server large enough to need a store.',
      },
    ],
    related: ['minecraft-rcon-item-delivery', 'minecraft-webshop-authme', 'minecraft-webshop', 'minecraft-rank-shop'],
  },

  {
    slug: 'minecraft-webshop-pricing',
    cluster: 'core',
    h1: 'Minecraft Webshop Pricing And Free Trial',
    title: 'Minecraft Webshop Pricing: Free 7-Day Trial, First Month 99 THB',
    description:
      'Transparent Minecraft webshop pricing. Free 7-day trial with no card required, discounted first month, flat monthly plans, and no commission taken on your sales.',
    keywords: [
      'minecraft webshop pricing',
      'minecraft webshop free trial',
      'minecraft webshop cost',
      'cheap minecraft webshop',
      'minecraft webshop hosting price',
    ],
    intro: [
      'Pricing is a flat subscription, not a share of your revenue. That distinction matters more as you grow: a commission model takes a larger absolute amount from you every month you succeed, while a subscription stays flat.',
      'The trial runs 7 days with no card required, because the only useful test of a store is real players buying real products. After the trial, the first month is discounted to 99 THB so you can run a full sales cycle before committing to a normal term.',
      'One cost is not ours and we would rather state it plainly: EasySlip charges a small per-verification fee on each payment slip checked, currently around 0.4 THB. That is passed through, not marked up.',
    ],
    bullets: [
      'Free 7-day trial, no card required to start.',
      'First month discounted to 99 THB after the trial.',
      'Monthly plans from 249 THB, with cheaper 3-month and 6-month terms.',
      'No commission on your sales. Store revenue settles to your own account.',
      'Your own domain included, with the HTTPS certificate issued and renewed for you.',
      'EasySlip slip verification costs roughly 0.4 THB per slip, disclosed rather than buried.',
    ],
    faqs: [
      {
        q: 'Do I need a card to start the trial?',
        a: 'No. The 7-day trial starts without payment details.',
      },
      {
        q: 'Do you take a percentage of sales?',
        a: 'No. You pay the subscription and keep your sales revenue, which settles directly to your own PromptPay account rather than a platform balance.',
      },
      {
        q: 'What happens when my subscription expires?',
        a: 'The store enters a grace period with a countdown rather than shutting off abruptly, so a late renewal does not take your storefront down without warning. Renewing restores it automatically.',
      },
      {
        q: 'Is my data kept if I stop paying?',
        a: 'Data is retained through the grace period so a renewal picks up where you left off. If you are planning a long pause, ask support before the period ends.',
      },
    ],
    related: ['minecraft-webshop', 'tebex-alternative', 'best-minecraft-webshop', 'minecraft-payment-gateway-thailand'],
  },

  {
    slug: 'how-to-monetize-minecraft-server',
    cluster: 'guide',
    h1: 'How To Monetize A Minecraft Server',
    title: 'How To Monetize A Minecraft Server Without Killing It',
    description:
      'A practical guide to Minecraft server monetization: what sells, what pay-to-win does to retention, pricing, EULA constraints, and the operational setup behind it.',
    keywords: [
      'minecraft server monetization',
      'how to monetize minecraft server',
      'minecraft ecommerce',
      'make money minecraft server',
      'minecraft server revenue',
    ],
    intro: [
      'Server monetization has one hard constraint that most guides skip: the things that earn most per player in month one are frequently the things that empty your server by month three. Balancing revenue against retention is the entire problem, and it is a design question before it is a technical one.',
      'The reliable pattern is selling status, convenience and cosmetics rather than raw power. Ranks, cosmetic effects, extra homes and loot boxes generate income without letting a paying player dominate a free one, which is what drives the free players away.',
      'The Minecraft EULA also limits what you may sell. Broadly, you may not sell gameplay advantage in a way that makes the game pay-to-win, and enforcement is real. Read the current commercial guidelines before designing your catalogue.',
    ],
    bullets: [
      'Sell status and convenience: ranks, prefixes, cosmetics, extra homes and warps.',
      'Loot boxes monetise well because one item pool serves every price point, but publish your drop rates.',
      'Avoid selling direct combat or economy advantage. It converts well and then hollows out the player base that made the server worth paying for.',
      'Price for your actual audience. A Thai player base has different price sensitivity than a US one, and copying a US server\'s price list is a common mistake.',
      'Make paying frictionless. Automatic delivery and instant top-ups measurably outperform manual handling.',
      'Run limited-time and seasonal items to create a reason to buy now rather than eventually.',
      'Track revenue per player rather than total revenue, so you notice a retention problem before it becomes a revenue problem.',
    ],
    faqs: [
      {
        q: 'What sells best on a Minecraft server?',
        a: 'Ranks first, then loot boxes and cosmetics. Ranks work because they are visible to other players, which makes them status goods rather than merely useful ones.',
      },
      {
        q: 'Is pay-to-win against the Minecraft EULA?',
        a: 'Mojang\'s commercial guidelines restrict selling gameplay advantage, and the rules have tightened over time. Check the current guidelines directly, because this genuinely changes and getting it wrong risks your server.',
      },
      {
        q: 'How much can a server realistically earn?',
        a: 'It varies enormously with size and audience, and anyone quoting a firm number is guessing. The dependable lever is conversion friction: automating top-ups and delivery reliably raises revenue on an existing player base without adding a single player.',
      },
      {
        q: 'Should I start with a store or grow the player base first?',
        a: 'Grow first. A store on a server with thirty regular players earns very little, and the effort is better spent on the reasons people stay.',
      },
    ],
    related: ['minecraft-donation-store', 'minecraft-lootbox', 'minecraft-webshop', 'best-minecraft-webshop'],
  },
];

export function getEnLandingBySlug(slug: string): LandingPage | undefined {
  return EN_LANDING_PAGES.find((p) => p.slug === slug);
}

export function getEnRelated(page: LandingPage): LandingPage[] {
  if (!page.related?.length) return [];
  return page.related
    .map((slug) => getEnLandingBySlug(slug))
    .filter((p): p is LandingPage => Boolean(p));
}
