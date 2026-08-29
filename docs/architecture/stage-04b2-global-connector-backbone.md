# Stage 04B-2 — Global Connector Backbone

Status: IMPLEMENTATION / QA PENDING.

## Goal

Turn the Source Intelligence plan into a real free-first multi-source collection backbone. This stage is about reliable evidence acquisition, not Trend Candidate clustering or marketing scoring.

Canonical flow remains:

`Workspace → Source Research → Source Evaluation → Source Plan → Connector Activation → Collection`

Stage 04B-2 adds operational collectors underneath Connector Activation.

## Global Refresh Policy V1

Every ACTIVE source is invoked twice daily at 07:17 UTC and 19:17 UTC. This collection cadence is intentionally uniform in V1. Native source freshness remains separate metadata; running a daily-upstream source twice does not imply two distinct upstream snapshots.

## Connector priority decision

The first backbone connectors were selected using repeated cross-workspace value × gap coverage × free-first feasibility × compliance/runtime feasibility.

### 1. Publisher RSS / Atom adapter

Why first:
- free/open distribution mechanism;
- reusable across industries by swapping concrete feeds after Source Research;
- strong narrative/competitor evidence;
- no platform API key required;
- publisher-specific terms can be reviewed independently.

Initial runtime feeds:
- TechCrunch RSS (`https://techcrunch.com/feed/`) — required baseline; TechCrunch RSS Terms permit feed use with attribution/link requirements.
- Road to VR RSS (`https://roadtovr.com/feed/`) — optional specialist XR feed; publisher documents full/section RSS feeds.
- PocketGamer.biz RSS (`https://www.pocketgamer.biz/rss/`) — optional runtime verification target; publisher historically advertises RSS but this endpoint is not allowed to fail the backbone build until re-verified.

The collector stores title, publication time, canonical link/identifier and source attribution. It does not fabricate engagement metrics and does not need to retain full article bodies.

### 2. Hacker News API

Official public Firebase API. The official API documentation states there is currently no rate limit and exposes top/new/best story IDs plus item records.

Collector path:
`topstories → item IDs → story records → Signal v1`

Preserved native metrics:
- HN points;
- comments;
- source rank.

HN points remain source-native and are not compared directly with views/stars/likes.

### 3. GitHub REST API

Official public developer-ecosystem API. GitHub documents 60 requests/hour for unauthenticated public requests and a larger repository-scoped limit for the built-in `GITHUB_TOKEN` in Actions. Search endpoints have their own limits.

Stage 04B-2 uses the workflow's built-in `GITHUB_TOKEN`; no user-supplied secret is exposed to the browser.

Current discovery query:
- newly created public repositories in a rolling 7-day window;
- minimum 5 stars;
- ordered by stars;
- maximum 30 records.

Preserved native metrics:
- stars;
- forks;
- open issues;
- source rank.

These are evidence signals for developer/product momentum, not a direct proxy for consumer virality.

## Output contract

The worker writes:

`apps/web/public/data/backbone-signals.json`

Envelope:
- `schemaVersion: source-backbone-snapshot.v1`
- collectedAt
- uniform twice-daily collection policy
- sourceCount
- observationCount
- independent SignalBatch records
- source failures/runtime notes

Each observation remains `signal.v1` and carries provenance/evidence links.

## Failure policy

No fake fallback data.

Required connectors:
- Hacker News API
- GitHub REST API
- TechCrunch RSS baseline

Optional initial specialist feeds may fail without failing the whole snapshot, but the failure is written into the snapshot and exposed in the UI. The snapshot must contain at least three successful source batches or the worker fails.

## Normalization boundary

Raw platform metrics are not normalized into one score in this stage.

Examples:
- HN points ≠ GitHub stars;
- GitHub stars ≠ Wikimedia pageviews;
- RSS feed order ≠ engagement.

Cross-source normalization, topic/entity clustering and corroborated Trend Candidate creation are downstream work.

## UI

`apps/web/app/backbone-signals.tsx` displays:
- live source batch count;
- real observation count;
- twice-daily policy;
- source-native freshness;
- source runtime failures;
- sample evidence links;
- explicit no-cross-platform-comparison boundary.

## Runtime boundary

GitHub Pages remains presentation only. GitHub Actions is still a bounded preview scheduler/worker for this stage. A persistent production runtime/database is still required before multi-workspace always-on monitoring and notifications can be called production-ready.

## Handoff

After runtime QA passes, the next stage should use these independent source families to build topic/entity resolution and cross-source corroboration before Trend Virality scoring.
