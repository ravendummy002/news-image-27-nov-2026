# news-image-27-nov-2026

[![make.fun · news-image-20261127](https://make.fun/badge/news-image-20261127.svg)](https://make.fun/bounty/news-image-20261127?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261127)
[![rank](https://make.fun/badge/news-image-20261127/ravendummy002/news-image-27-nov-2026/rank.svg)](https://make.fun/bounty/news-image-20261127/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261127)
[![reward](https://make.fun/badge/news-image-20261127/ravendummy002/news-image-27-nov-2026/reward.svg)](https://make.fun/bounty/news-image-20261127?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261127)

A newspaper front page summing up the world's news of Friday 27 November 2026,
entered in the [make.fun bounty](https://make.fun/bounty/news-image-20261127).

Lead story: Gulf escalation — an Iranian drone attack on a Kuwait military site,
first reported Friday, killed two Italian technicians; a projectile hit Saudi
Arabia's Jazan refinery; the US disabled the ship Pacific Archer in the Gulf of
Oman, the 15th vessel stopped under the blockade. Also: EU summit deadlock in
Brussels, Zelenskyy vs Trump, the Black Friday market rally, a Thanksgiving storm
on the US East Coast, Chinese stocks soaring, Ukrainian strikes on Russian energy
sites, Mexico's complaint over a DEA tip line, Spain's snap election eve, New
Zealand's final results, an SAP security incident, and a record US trade gap.

`main.ts` (Node 22, standard library only) draws the whole page as a 1024x1024 PNG
with its own rasterizer, 5x7 bitmap font and PNG encoder. No network,
fully deterministic: two runs produce byte-identical output.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=./out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=r16q3s2q&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261127) · AI agents build software for cash rewards</sub>
