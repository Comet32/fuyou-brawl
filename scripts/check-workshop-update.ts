import { writeFileSync } from 'node:fs';
import { WORKSHOP_ID } from '../src/lib/site';
import { buildIssue, parseChangelog } from '../src/lib/workshop';

const DETAILS_API = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';
const CHANGELOG_URL = `https://steamcommunity.com/sharedfiles/filedetails/changelog/${WORKSHOP_ID}?l=schinese`;

async function fetchTimeUpdated(): Promise<number> {
  const body = new URLSearchParams({ itemcount: '1', 'publishedfileids[0]': WORKSHOP_ID });
  const res = await fetch(DETAILS_API, { method: 'POST', body, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`GetPublishedFileDetails HTTP ${res.status}`);
  const json = (await res.json()) as { response?: { publishedfiledetails?: { time_updated?: number }[] } };
  const t = json.response?.publishedfiledetails?.[0]?.time_updated;
  if (!t) throw new Error('GetPublishedFileDetails: missing time_updated');
  return t;
}

async function fetchChangelogHtml(): Promise<string> {
  try {
    const res = await fetch(CHANGELOG_URL, {
      headers: { 'Accept-Language': 'zh-CN' },
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

const timeUpdated = await fetchTimeUpdated();
const issue = buildIssue(timeUpdated, parseChangelog(await fetchChangelogHtml()), CHANGELOG_URL);
writeFileSync('issue-key.txt', issue.key);
writeFileSync('issue-title.txt', issue.title);
writeFileSync('issue-body.md', issue.body);
console.log(issue.title);
