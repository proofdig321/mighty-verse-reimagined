import {
  cookieHeaderFromInput,
  cookieHeaderFromNetscape,
  isNetscapeCookieFile,
} from "../youtube-cookies";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const netscape = `# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1999999999	SID	abc123
.youtube.com	TRUE	/	TRUE	1999999999	HSID	def456
`;

assert(isNetscapeCookieFile(netscape), "Netscape cookies.txt is detected");
assert(
  cookieHeaderFromNetscape(netscape) === "SID=abc123; HSID=def456",
  "Netscape rows become a Cookie header",
);
assert(
  cookieHeaderFromInput("SID=abc123; HSID=def456") === "SID=abc123; HSID=def456",
  "Cookie header strings pass through",
);
assert(cookieHeaderFromInput("   ") === null, "blank cookies are ignored");

console.log("youtube-cookies.test.mjs: ok");
