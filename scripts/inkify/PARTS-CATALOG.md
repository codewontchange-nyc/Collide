# Inkify parts catalog — hand-audited notionists tags

Every label the vision model can pick, and the exact DiceBear notionists
variant it renders. Audited visually from contact sheets (2026-08-20).
To extend: render `https://api.dicebear.com/9.x/notionists/svg?<part>=variantNN`,
label what you see, add a row + enum entry in index.ts.

## hair (29 of 64 variants mapped)
| label | variant | notes |
|---|---|---|
| bald-or-shaved | 60 | mostly-bald wisp |
| buzz-very-short | 15 | |
| short-neat-side-part | 05 | |
| short-textured-crop | 31 | |
| short-curly | 01 | |
| big-curly-mop | 20 | |
| afro-round | 43 | |
| quiff-pompadour | 13 | |
| slicked-back | 29 | |
| flat-top | 44 | |
| spiky | 42 | bleach-tipped |
| mohawk | 51 | liberty spikes |
| side-shave-swept-over | 54 | |
| pixie-with-bangs | 47 | |
| chin-bob-straight | 10 | with bangs |
| chin-bob-wavy | 11 | side part |
| bob-with-headband | 08 | |
| shoulder-length-straight | 23 | side part |
| shoulder-length-waves | 28 | side-swept (Kathleen) |
| shoulder-shag-layered | 37 | |
| long-straight-center-part | 41 | |
| long-voluminous-curls | 58 | |
| high-ponytail | 45 | retro w/ bangs |
| top-bun | 48 | messy bun |
| double-buns | 59 | |
| braids-or-pigtails | 39 | curly pigtails |
| curly-top-knot | 40 | |
| silver-updo | 61 | white grandma bun |
| headscarf | 63 | hijab-style |

Unmapped-but-notable: 02/04/16 (more short/bob shapes), 22 (messy mop),
33 (tall wavy quiff), 36 (chin curly bob), 46 (long + bow), 49 (caesar),
52-57 (crops/quiffs), 62 (hooded shawl). Add labels as real users need them.

## beard (8 of 12)
full-beard=02 · medium-beard=01 · stubble=06 · goatee=08 ·
goatee-with-mustache=11 · mustache=10 · thin-mustache=04 · soul-patch=12

## glasses (3 of 11)
clear-rectangular=03 · clear-round=11 · sunglasses=09 (01/02/04-07/10 = other shades)

## lips / expression (3 of 30)
big-open-smile=16 · soft-closed-smile=05 · neutral=02

## nose (4 of 20)
small-button=09 · straight-average=03 · long-pointed=06 · broad-rounded=19

## brows (3 of 13)
thick-bold=03 · thin-arched=06 · thin-straight=02

## body / clothing (5 of 25, all-dark brand family)
tank-or-sleeveless=10 · tshirt-or-crew=02 · open-jacket-or-hoodie=09 ·
collared-shirt-or-blazer=06 · other=08 (camera strap)
Light/patterned bodies (01/03/05/07/11-25) intentionally unused — the town wears ink.

## custom hand-drawn parts (ours, not DiceBear)
- BEANIE_GROUP — cuffed beanie swapped over the `hat` asset (see index.ts)
- Pattern for more: render with a placeholder part, regex-swap its `<g>` for
  a hand-drawn group in the same ink language (flat black, #f6f1ea seams).

## fixed render params
size=512 · backgroundColor=f6f1ea · gestureProbability=0 · seed=user.id (eyes only)
