"use client";

import { Globe } from "@/components/globe/Globe";
import type { Friend, Post, Profile } from "@/lib/types";

// Painted stand-in covers: [top, bottom, sun, sunX, sunY, sunSize, hill1, hill2]
const PALETTES: [string, string, string, number, number, number, string, string][] = [
  ["#DDE3F5", "#7F8FC4", "#FFFFFF", 58, 22, 24, "#5D6CA3", "#3D4A7E"],
  ["#A9DCD6", "#2F6F7E", "#FFEBC2", 56, 18, 26, "#245866", "#173C47"],
  ["#D7EBC9", "#4E7A4A", "#F7FBEA", 18, 22, 30, "#355E34", "#1F3F23"],
  ["#F8DDE3", "#B57C9B", "#FFFFFF", 60, 14, 22, "#84506F", "#5E3753"],
  ["#FFC7A1", "#6B4C8C", "#FFEBC7", 38, 38, 34, "#4A3267", "#2C1E44"],
  ["#3C6F8A", "#0B1820", "#E2ECF2", 66, 16, 14, "#18343F", "#0E2129"],
  ["#FFE3C4", "#E08A6B", "#FFFFFF", 50, 30, 24, "#B8604B", "#7E3E33"],
  ["#C4D2D6", "#536A73", "#F2F6F7", 30, 20, 18, "#3D525A", "#28383E"],
  ["#FFE6A6", "#C9782E", "#FFF8E0", 62, 18, 26, "#9C5A22", "#6B3C16"],
  ["#CFE0DA", "#5E8A80", "#FFFFFF", 24, 26, 22, "#456B62", "#2E4C45"],
  ["#E4F5B8", "#5FA05A", "#FFFFFF", 66, 24, 22, "#3F7A3E", "#285428"],
  ["#4A4F7A", "#14162B", "#E9E4FF", 32, 22, 16, "#2A2D52", "#191B36"],
];

function cover(i: number) {
  const [a, b, sun, x, y, r, h1, h2] = PALETTES[i % PALETTES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="${x + r / 2}" cy="${y + r / 2}" r="${r / 2}" fill="${sun}"/><ellipse cx="25" cy="103" rx="55" ry="45" fill="${h1}"/><ellipse cx="85" cy="115" rx="55" ry="45" fill="${h2}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SONGS = [
  ["Low Tide Radio", "Sun Atlas", "windows down on the coast road, fog finally lifting off the water"],
  ["Fernlight", "Hollow Pines", "first coffee on the porch and this one stopped me mid-sip"],
  ["Glass Orchard", "Kaito & the Weather", "lunch walk, every cherry tree on the block going off at once"],
  ["Afterglow Circuit", "Marlow Static", "sunset from the top of the parking garage, nobody else up there"],
  ["Moss & Mercury", "Juniper Field", "empty highway home, every single light turned green for me"],
  ["Dew Line", "Harbor & Field", "sunrise run, legs gone, this song carried me the last mile"],
  ["Lowland Satellites", "Orbit Moss", "fog on the bridge, headphones in, the city still asleep"],
  ["Saffron Weather", "Delta Vines", "rooftop garden, tomatoes finally red, sun on my neck"],
  ["Static Bloom", "Paper Kites Club", "library window seat, rain on glass, could have stayed forever"],
  ["Neon Fern", "Velvet Canopy", "golden hour on the bike home, took the long way twice"],
  ["Quiet Engine", "North Arcade", "late shift done, parking lot stars, sat in the car to finish it"],
];
const NAMES = [
  "Maya R.", "Jonah K.", "Priya S.", "Luis M.", "Sam T.", "Ava L.", "Theo B.", "Noor H.", "Kenji W.", "Rosa D.",
  "Eli P.", "Ivy C.", "Marco F.", "June A.", "Felix O.", "Hana Y.", "Omar Z.", "Lena V.", "Ravi N.", "Tess G.",
  "Diego Q.", "Mila J.", "Arjun E.", "Zoe I.", "Kai U.", "Nina X.", "Ben W.", "Sora T.",
];

const now = new Date();
const at = (h: number, min: number) => {
  const d = new Date(now);
  d.setUTCHours(h, min, 0, 0);
  return d.toISOString();
};

function post(i: number, user: string, title: string, artist: string, caption: string, created: string): Post {
  return {
    id: `p${i}`,
    user_id: user,
    day: created.slice(0, 10),
    song_url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
    page_url: null,
    title,
    artist,
    artwork_url: cover(i),
    platform_links: {},
    caption,
    created_at: created,
  };
}

const profile = (i: number, name: string): Profile => ({
  id: `u${i}`,
  username: name.toLowerCase().replace(/[^a-z]/g, ""),
  display_name: name,
  timezone: "UTC",
  created_at: now.toISOString(),
});

const ME = profile(0, "You");
const MY_POST = post(0, "u0", "Paper Moons", "Lune Harbor", "walking to the train with the whole street still blue and quiet", at(8, 10));
const FRIENDS: Friend[] = NAMES.map((name, i) => {
  const waiting = (i * 7) % 10 < 3;
  const [title, artist, caption] = SONGS[i % SONGS.length];
  return {
    ...profile(i + 1, name),
    followed_at: now.toISOString(),
    post: waiting ? null : post(i + 1, `u${i + 1}`, title, artist, caption, at(6 + ((i * 5) % 14), (i * 17) % 60)),
  };
});

export function DemoGlobe() {
  return <Globe me={ME} myPost={MY_POST} friends={FRIENDS} coreHref={() => "/login"} />;
}
