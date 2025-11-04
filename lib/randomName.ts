// lib/randomName.ts
import { getDeviceId } from "./device";

const ADJECTIVES = [
  "Brave","Calm","Clever","Curious","Daring","Gentle","Happy","Jolly","Kind","Lively",
  "Lucky","Mighty","Noble","Playful","Proud","Quick","Radiant","Silly","Smart","Swift",
  "Witty","Cheerful","Bold","Loyal","Fearless","Wise","Charming","Eager","Graceful",
  "Joyful","Polite","Zany","Caring","Dazzling","Honest","Patient","Strong","Brilliant",
  "Adventurous","Thoughtful","Vivid","Magical","Wild","Vibrant","Confident","Dutiful",
  "Hopeful","Bright","Energetic","Mellow"
];

const NOUNS = [
  "Lion","Tiger","Panda","Koala","Dolphin","Eagle","Falcon","Wolf","Otter","Penguin",
  "Fox","Bear","Leopard","Hawk","Horse","Giraffe","Elephant","Owl","Rabbit","Monkey",
  "Seal","Turtle","Parrot","Whale","Cheetah","Moose","Camel","Crab","Frog","Raven",
  "Lynx","Peacock","Puma","Deer","Badger","Kangaroo","Lemur","Bison","Puffin","Goose",
  "Flamingo","Beetle","Swan","Hedgehog","Raccoon","Toad","Butterfly","Dragonfly",
  "Cobra","Antelope","Meerkat"
];

// simple deterministic PRNG from a numeric seed
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i) | 0;
  return h | 0;
}

export async function generateDeterministicName() {
  const id = await getDeviceId();            // stable per device
  const rng = mulberry32(hashCode(id));
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)];
  return `${adj} ${noun}`;
}

// Optional: deterministic accent color for avatars/dots
export async function deterministicColor() {
  const id = await getDeviceId();
  const rng = mulberry32(hashCode(id));
  // nice hues with fixed s/l for readability
  const hue = Math.floor(rng() * 360);
  return `hsl(${hue} 70% 55%)`;
}