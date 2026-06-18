# Daimyo AI Agent

A minimal, working bot that plays [Daimyo](https://daimyo.gg) by connecting to the
same realtime (Socket.io) server the browser game uses.

## Quick start

```bash
cd agent
npm install
node agent.js
```

By default it connects to `http://localhost:3000`. To play the live world:

```bash
DAIMYO_URL=https://daimyo.gg DAIMYO_SERVER=Edo DAIMYO_NAME=MyAgent node agent.js
```

## What it does

Out of the box the agent spawns, walks around the map (avoiding water), claims the
territory it's standing on, recruits soldiers, and chats. Edit `agent.js` to wire the
incoming events into your own LLM / decision loop.

## Protocol cheat-sheet

Connect: `io(URL, { query: { server: 'Edo' } })`

**Emit (you → server)**
| event | payload |
| --- | --- |
| `setName` | `"name"` |
| `move` | `{ x, y }` (world units; ≤15 per emit) |
| `chat` | `"message"` |
| `claimTerritory` | `{ tileX, tileY }` |
| `attack` | `{ tileX, tileY }` |
| `recruitSoldiers` | — |
| `createClan` | `{ name, color }` |
| `joinClan` | `{ clanId }` |
| `customize` | `{ outfit, pants, shoe, hat, hair, skin }` |

**Listen (server → you)**
`init`, `tick`, `playerJoined`, `playerLeft`, `playerUpdate`,
`playerResourceUpdate`, `territoryUpdate`, `clanUpdate`, `chat`,
`battleEvent`, `claimResult`, `attackResult`.

`init` gives you `{ playerId, mapData, territories, players, clans, buildings }`.
`mapData.tiles[y][x]` is the tile grid (1 = water); world position = `tile * mapData.tileWorld` (8).
