// Art brief for all 30 jobs: drives the prompt file (art:prompts) and folder-name matching (art).
// Colours for the 6 built jobs match src/data/roster.ts.

export interface JobBrief {
  id: string;
  name: string;
  /** extra words a folder might be called (merged jobs, plurals…) */
  aliases: string[];
  costume: string;
  tool: string;
  quote: string;
  /** the remaining (not yet built) jobs are generated after the pilots */
  batch: number;
}

export const JOBS: JobBrief[] = [
  // ---- pilots (done) ----
  { id: 'chef', name: 'Chef', aliases: ['cook', 'baker'], batch: 0, quote: 'Order up!',
    costume: 'tall puffy white chef’s toque, white double-breasted chef coat (#f4f1ea) with a red neckerchief (#d9452b), dark brown trousers, black shoes; short dark-brown hair, light skin (#f3c9a0), confident grin',
    tool: 'a huge steel meat cleaver' },
  { id: 'firefighter', name: 'Firefighter', aliases: ['fireman', 'rescue'], batch: 0, quote: 'Stand back!',
    costume: 'red fire helmet (#c9302a) with a wide back brim and a yellow shield badge, red-and-tan turnout coat with bright yellow reflective stripes (#f2c230), heavy gloves, boots; short dark hair, tan skin (#e8b48a), determined smile',
    tool: 'a big fire axe with a red head' },
  { id: 'fisher', name: 'Fisher', aliases: ['fisherman', 'fisherwoman', 'sailor', 'angler'], batch: 0, quote: 'It’s a monster!',
    costume: 'yellow bucket hat (#e9c46a) with a small green fishing lure pinned to it, green fishing vest with many pockets (#3f7d5a) over a cream shirt, rolled-up trousers, rubber boots; light-brown hair, sun-tanned skin (#e2b48c), calm half-smile',
    tool: 'a VERY long fishing rod (longer than the character is tall) with a reel near the grip and a line and hook dangling from the tip' },

  // ---- batch 1: already playable, still on placeholders ----
  { id: 'electrician', name: 'Electrician', aliases: ['lineman', 'electric'], batch: 1, quote: 'Lights out.',
    costume: 'yellow hard hat (#f5c518) with a black lightning-bolt decal, navy work shirt and trousers (#2a4a86), tool belt with wire coils and pliers, rubber gloves; short black hair, warm tan skin (#d9a377), focused smirk',
    tool: 'a long insulated voltage rod with a yellow rubber grip and a crackling spark at the tip' },
  { id: 'nurse', name: 'Nurse', aliases: ['paramedic', 'caregiver'], batch: 1, quote: 'Not on my watch.',
    costume: 'white nurse cap with a pink cross (#ec6f95), teal scrubs (#7fcfc4), white sneakers, a small pink heart-shaped badge; auburn hair in a ponytail, light skin (#f6d3b3), kind but determined smile',
    tool: 'a defibrillator paddle (white, with a pink stripe) on a coiled cable' },
  { id: 'courier', name: 'Courier', aliases: ['driver', 'delivery', 'trucker', 'postal', 'postman', 'mailman'], batch: 1, quote: 'Sign here!',
    costume: 'orange cap worn slightly sideways (#f08a24) with a white logo patch, orange delivery polo with a brown satchel strap (#4a3426), cargo shorts, sneakers; black hair, brown skin (#c98f62), cheeky grin',
    tool: 'a big cardboard parcel swung on a sturdy strap like a flail' },

  // ---- batch 2+: not built yet (skills come in M4) ----
  { id: 'farmer', name: 'Farmer', aliases: ['gardener', 'rancher'], batch: 2, quote: 'Harvest time!',
    costume: 'wide straw hat (#e3c16f), blue denim overalls (#3d6fa5) over a red plaid shirt (#c8453a), muddy boots; sandy hair, freckles, sun-kissed skin, cheerful grin',
    tool: 'a long curved scythe with a wooden handle' },
  { id: 'builder', name: 'Builder', aliases: ['construction', 'mason', 'carpenter'], batch: 2, quote: 'Demolition day!',
    costume: 'white hard hat (#f5f5f0), hi-vis orange safety vest (#ff7a1a) with reflective stripes over a grey t-shirt, tool belt, work boots; buzz-cut hair, broad shoulders, confident grin',
    tool: 'a huge sledgehammer' },
  { id: 'miner', name: 'Miner', aliases: ['quarry'], batch: 2, quote: 'Cave-in!',
    costume: 'dark grey helmet (#4a4f57) with a glowing yellow headlamp (#ffd23f), dusty brown overalls (#7a5a3a), soot smudges on the cheeks, sturdy boots; dark hair, determined grin',
    tool: 'a heavy pickaxe' },
  { id: 'welder', name: 'Welder', aliases: ['factory', 'blacksmith', 'metalworker'], batch: 2, quote: 'Hot work!',
    costume: 'welding mask flipped up on the head (#3c4650), leather apron (#8a5a33) over navy coveralls (#2c3e5a), thick leather gloves; short red hair, sweat drop, fierce grin',
    tool: 'a welding torch spitting a bright orange-and-blue flame (#ff9a3c)' },
  { id: 'plumber', name: 'Plumber', aliases: ['pipefitter'], batch: 2, quote: 'Pipes burst!',
    costume: 'navy beanie (#264653), teal work shirt (#2a9d8f) with a pipe-shaped name patch, grey cargo trousers, tool belt with pipe fittings; clean-shaven, short curly hair, easygoing smile (do NOT give a moustache or red cap)',
    tool: 'a giant red-handled pipe wrench' },
  { id: 'mechanic', name: 'Mechanic', aliases: ['technician'], batch: 2, quote: 'Fixed it!',
    costume: 'grease-stained grey-blue jumpsuit (#5b7083) with a name patch, red bandana (#d62828) around the neck, goggles pushed up on the forehead; messy hair, oil smudge on the nose, cocky grin',
    tool: 'an oversized ratchet socket wrench' },
  { id: 'engineer', name: 'Engineer', aliases: ['architect', 'civil'], batch: 2, quote: 'By the numbers.',
    costume: 'blue hard hat (#3a86ff), safety glasses, light shirt with a khaki utility vest (#c9a66b), rolled blueprints in a back pocket; neat hair, thoughtful smile',
    tool: 'a long surveyor’s measuring staff with red-and-white ruler markings' },
  { id: 'pilot', name: 'Pilot', aliases: ['aviator', 'flight'], batch: 2, quote: 'Bombs away!',
    costume: 'leather aviator cap with goggles, brown bomber jacket (#7b4a2a) with a fur collar, long white scarf (#f2f2f2) blowing behind; tousled hair, bold grin',
    tool: 'a big orange flare pistol' },
  { id: 'merchant', name: 'Merchant', aliases: ['shopkeeper', 'cashier', 'sales', 'salesperson', 'vendor'], batch: 2, quote: 'Everything must go!',
    costume: 'green shop apron (#2d6a4f) over a yellow shirt (#f4d35e), visor cap, coin purse on the belt; slicked hair, salesy wink',
    tool: 'a giant wooden abacus' },
  { id: 'waiter', name: 'Waiter', aliases: ['waitress', 'barista', 'bartender', 'server'], batch: 2, quote: 'Order up, table two!',
    costume: 'black vest (#222831) over a crisp white shirt, red bow tie (#c1121f), white towel over the back arm; slick side-parted hair, polite smile',
    tool: 'a shiny silver serving tray' },
  { id: 'cleaner', name: 'Cleaner', aliases: ['janitor', 'housekeeper', 'custodian'], batch: 2, quote: 'Spotless!',
    costume: 'blue janitor uniform (#4361ee), yellow rubber gloves (#ffd60a), bandana on the head, ring of keys on the belt; tidy bun, no-nonsense smile',
    tool: 'a big wet mop' },
  { id: 'tailor', name: 'Tailor', aliases: ['seamstress', 'garment', 'sewing'], batch: 2, quote: 'Sewn shut!',
    costume: 'purple waistcoat (#6a4c93), yellow measuring tape draped around the neck (#ffca3a), pincushion on the wrist, round glasses; neat hair, sly smile',
    tool: 'a pair of giant tailor’s shears' },
  { id: 'barber', name: 'Barber', aliases: ['hairdresser', 'stylist'], batch: 2, quote: 'Fresh cut!',
    costume: 'red-and-white striped barber smock (#e63946 / #f1faee), slick pompadour hairstyle, comb in the breast pocket; stylish smirk',
    tool: 'an oversized pair of electric hair clippers' },
  { id: 'doctor', name: 'Doctor', aliases: ['physician', 'surgeon', 'dentist'], batch: 2, quote: 'Emergency surgery!',
    costume: 'white doctor’s coat (#f8f9fa) over blue scrubs (#4ea8de), stethoscope around the neck, head mirror on a band; neat hair, calm confident look',
    tool: 'a giant syringe' },
  { id: 'scientist', name: 'Scientist', aliases: ['researcher', 'chemist', 'pharmacist'], batch: 2, quote: 'Eureka!',
    costume: 'lab coat with rolled sleeves over a purple shirt (#7209b7), big round mint-green goggles (#80ffdb) on the forehead; wild spiky hair, manic grin',
    tool: 'a large glass flask on a handle, bubbling with glowing green liquid' },
  { id: 'teacher', name: 'Teacher', aliases: ['professor', 'tutor', 'lecturer'], batch: 2, quote: 'Detention!',
    costume: 'tweed jacket (#8d6e63) with elbow patches, chalkboard-green tie (#2a9d8f), glasses, chalk dust on the sleeves; tidy hair, stern but kind look',
    tool: 'a long wooden pointer stick with a chalk tip' },
  { id: 'programmer', name: 'Programmer', aliases: ['developer', 'coder', 'it', 'software'], batch: 2, quote: 'Blue screen!',
    costume: 'dark indigo hoodie (#3a0ca3), cyan headphones around the neck (#4cc9f0), lanyard badge, sneakers; messy hair, tired-but-smug look',
    tool: 'an open laptop wielded like a club, its screen glowing' },
  { id: 'accountant', name: 'Accountant', aliases: ['banker', 'clerk', 'bookkeeper'], batch: 2, quote: 'Pay up!',
    costume: 'grey suit (#6c757d) with sleeve garters, green visor (#43aa8b), glasses, pencil behind the ear; neat parted hair, smug smile',
    tool: 'a giant desk calculator' },
  { id: 'lawyer', name: 'Lawyer', aliases: ['judge', 'attorney'], batch: 2, quote: 'Guilty!',
    costume: 'sharp navy suit (#1d3557) with a gold tie (#e9c46a), briefcase on the back, lapel pin; slicked hair, confident pointing pose of the back arm',
    tool: 'a big wooden judge’s gavel' },
  { id: 'police', name: 'Police', aliases: ['policeman', 'policewoman', 'officer', 'cop', 'security', 'guard'], batch: 2, quote: 'Backup’s here!',
    costume: 'navy police uniform (#14213d) with a gold badge (#fca311), peaked cap, a riot shield strapped to the back arm, radio on the shoulder; serious look',
    tool: 'a black police baton' },
  { id: 'soldier', name: 'Soldier', aliases: ['marine', 'army'], batch: 2, quote: 'Hold the line!',
    costume: 'green camo fatigues (#606c38), dark green helmet (#283618), dog tags, combat boots; determined look',
    tool: 'a chunky cartoon rifle held like a club' },
  { id: 'artist', name: 'Artist', aliases: ['painter', 'illustrator', 'designer'], batch: 2, quote: 'Masterpiece!',
    costume: 'red beret (#e63946), pale-yellow paint-splattered smock (#ffe8a3), paint palette held in the back arm; colourful paint smudges on the cheeks, dreamy smile',
    tool: 'a giant paintbrush dripping bright paint' },
  { id: 'musician', name: 'Musician', aliases: ['singer', 'performer', 'rocker', 'guitarist'], batch: 2, quote: 'Encore!',
    costume: 'black leather jacket (#2b2d42) with star pins, red scarf (#ef233c), ripped jeans; spiky hair, rock-star grin',
    tool: 'an electric guitar held by the neck' },
  { id: 'athlete', name: 'Athlete', aliases: ['coach', 'sportsman', 'sportswoman', 'player'], batch: 2, quote: 'Hat trick!',
    costume: 'yellow jersey with a big number 7 (#ffb703), blue sweatband headband (#219ebc), shorts, sneakers; athletic build, competitive grin',
    tool: 'a wooden baseball bat' },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Folder name → job id ("Fisherman", "fire fighter", "Cook" → fisher, firefighter, chef). */
export function jobIdFor(folder: string): string | null {
  const n = norm(folder);
  if (!n) return null;
  for (const j of JOBS) if (norm(j.id) === n || norm(j.name) === n || j.aliases.some((a) => norm(a) === n)) return j.id;
  for (const j of JOBS) if (n.includes(norm(j.id)) || j.aliases.some((a) => a.length > 3 && n.includes(norm(a)))) return j.id;
  return null;
}
