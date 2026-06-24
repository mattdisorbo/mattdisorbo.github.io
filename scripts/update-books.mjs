import { readFile, writeFile } from "node:fs/promises";

const FEED = "https://www.goodreads.com/review/list_rss/117117622?shelf=read&sort=date_added&order=d";
const FILE = "interests.html";
const MAX = 5, CHARS = 360;
const START = "<!-- BOOKS:START -->", END = "<!-- BOOKS:END -->";

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim() : "";
};
const decode = (s) => s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
  .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/gi," ");
const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

const res = await fetch(FEED, { headers: { "User-Agent": "Mozilla/5.0 (book-updater)" } });
if (!res.ok) { console.error("Fetch failed:", res.status); process.exit(0); }
const xml = await res.text();

const items = (xml.match(/<item>[\s\S]*?<\/item>/g) || [])
  .map(b => ({
    title: tag(b, "title"),
    link: tag(b, "link"),
    author: tag(b, "author_name"),
    cover: tag(b, "book_large_image_url") || tag(b, "book_image_url"),
    rating: parseInt(tag(b, "user_rating"), 10) || 0,
    review: decode(tag(b, "user_review")).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  }))
  .filter(it => it.review)
  .slice(0, MAX);

if (!items.length) { console.error("No reviews found; leaving file unchanged."); process.exit(0); }

const cards = items.map(it => {
  const stars = "★".repeat(it.rating) + "☆".repeat(5 - it.rating);
  let review = it.review, more = "";
  if (review.length > CHARS) { review = review.slice(0, CHARS).trimEnd() + "… "; more = `<a href="${esc(it.link)}" target="_blank">(more)</a>`; }
  return `      <div class="book-card">
        <img src="${esc(it.cover)}" alt="${esc(it.title)}" />
        <div class="book-info">
          <div class="book-title"><a href="${esc(it.link)}" target="_blank">${esc(it.title)}</a></div>
          <div class="book-author">${esc(it.author)}</div>
          <div class="book-stars">${stars}</div>
          <div class="book-review">${esc(review)}${more}</div>
        </div>
      </div>`;
}).join("\n");

const html = await readFile(FILE, "utf8");
const updated = html.replace(new RegExp(`${START}[\\s\\S]*?${END}`), `${START}\n${cards}\n      ${END}`);
if (updated === html) { console.log("No change."); }
else { await writeFile(FILE, updated); console.log(`Updated ${items.length} reviews.`); }
