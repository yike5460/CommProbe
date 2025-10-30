# Slack Insight App MVP Design (Prototype Scope)

- **Author:** Codex (GPT-5)
- **Date:** 2025-09-21
- **Status:** Draft
- **Audience:** Product, Prototype Engineering, Security/Legal reviewers

## 1. Overview

Deliver a lightweight Slack analytics prototype that aggregates high-value engagement signals without enterprise-scale infrastructure. The MVP collects channel participation, basic activity cadence, and interaction mix for public channels and approved private channels using scheduled data pulls. The prototype runs as a small set of containerized services (fetcher, metrics API/UI) backed by a single relational database and object storage for raw snapshots.

## 2. Objectives

### 2.1 Goals
- Capture daily snapshots of channel membership and recent interactions (messages, thread replies, reactions) for opted-in channels.
- Derive simple engagement metrics per user and channel: participation score, interaction mix, active time window inferred from message timestamps.
- Surface aggregated metrics via a basic dashboard and CSV export to support HR/Comms analysis.
- Respect opt-out and privacy controls while keeping operational footprint minimal.

### 2.2 Non-Goals (Prototype)
- No streaming ingestion or queueing infrastructure.
- No automated alerting, anomaly detection, or ML-based topic modeling.
- No advanced RBAC beyond admin vs. viewer roles.
- No cross-workspace federation; single Slack workspace only.

## 3. User Personas & Use Cases

- **HR Partner:** Monitor onboarding cohorts’ participation in mandatory channels.
- **Comms Lead:** Gauge campaign engagement across a shortlist of channels.
- **People Analytics Analyst:** Export weekly CSV of interaction counts for manual analysis.
- **Security Reviewer:** Confirm prototype respects opt-in lists and data minimization.

Representative use cases:
- Compare participation scores for a team’s core channels week over week.
- Identify time-of-day windows when specific teams are most active.
- Validate that private channel metrics are hidden when opt-in is revoked.

## 4. Requirements

### 4.1 Functional
- Scheduled job pulls conversation history, reactions, and channel membership using Slack Web API (rolling 7-day window; extended backfill optional).
- Store normalized events (message, reply, reaction) and channel roster snapshots in a single Postgres database.
- Compute metrics:
  - `channel_participation_score`: weighted sum of membership and activity count over last 7 days.
  - `interaction_mix`: ratio of posts, replies, reactions per user/channel.
  - `active_window`: earliest and latest interaction timestamp per user per day (used as proxy for online time).
- Provide simple REST endpoints and a minimal dashboard (e.g., FastAPI + templated UI or lightweight React) for viewing aggregates by channel, user, and team.
- Support CSV export for selected cohorts/date ranges.
- Enforce opt-out flag per user and per channel (skip during collection and presentation).

### 4.2 Non-Functional
- Data refresh cadence: scheduled sync every 6 hours (configurable).
- Target scale: up to 5k users, 1k channels.
- Data retention: 30 days of raw events, 90 days of aggregates.
- Prototype hosted in single VPC/network segment; minimal IAM roles.
- Time to deploy: < 2 days for initial environment.

## 5. Architecture Overview

### 5.1 Components
1. **Slack App**
   - Scopes: `conversations:read`, `conversations.history`, `users:read`, `users.profile:read`, `reactions:read`.
   - Optional: `groups:read` if private channels opt in.
   - Bot token stored in local secrets file or parameter store.
2. **Ingestion & Sync Service**
   - Python script/container scheduled via cron (ECS scheduled task or EC2 systemd timer).
   - Pulls paginated channel lists, memberships, and recent messages since last sync.
   - Persists raw JSON snapshots to S3 (or local disk) for auditing.
3. **Metrics Processor**
   - Same service (post-fetch) computes aggregates and upserts into Postgres materialized tables.
   - Backfill job triggered manually to import historical data.
4. **Data Store**
   - Single Postgres instance (RDS t-class or Docker Postgres) hosting raw events, user/channel tables, and aggregate views.
5. **API & UI**
   - FastAPI backend serving metrics endpoints and CSV exports.
   - Minimal web UI (FastAPI Jinja templates or React SPA served statically) for browsing metrics.

### 5.2 Data Flow
1. Scheduler triggers sync container with environment variables (Slack token, last cursor).
2. Fetcher requests channel list, membership, and recent history; stores raw payloads and writes normalized rows to Postgres.
3. Aggregation routines calculate metrics and refresh materialized views.
4. API/UI queries Postgres for dashboards and exports.

### 5.3 Deployment Footprint
- Docker Compose for local dev (FastAPI + Postgres).
- Single EC2 instance or ECS service running two containers (sync + API/UI) sharing the database.
- Secrets managed via AWS SSM Parameter Store or `.env` file secured on host.

## 6. Data Model & Metrics

### 6.1 Tables
- `users`: Slack user metadata (id, name, email, department, opt_out flag).
- `channels`: Channel metadata (id, name, type, opt_in flag).
- `channel_membership_snapshot`: user/channel membership with `captured_at`.
- `interaction_event`: normalized messages/replies/reactions with timestamps.
- `daily_user_metrics`: aggregated metrics per user/day/channel.
- `channel_metrics`: aggregated metrics per channel/day.

### 6.2 Metric Definitions
- `channel_participation_score = 0.4 * membership_weight + 0.6 * interaction_count_normalized`.
- `interaction_mix`: counts by type divided by total interactions.
- `active_window_start`, `active_window_end`: min/max interaction timestamp per user per day.
- Optionally compute `reply_latency` only if needed (median difference between parent and reply) using stored events.

### 6.3 Example Schema (interaction_event)
```sql
CREATE TABLE interaction_event (
  id UUID PRIMARY KEY,
  ts TIMESTAMP NOT NULL,
  event_type VARCHAR(16) NOT NULL, -- message, reply, reaction
  user_id VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NOT NULL,
  thread_ts VARCHAR(32),
  reaction VARCHAR(64),
  raw JSONB,
  inserted_at TIMESTAMP DEFAULT NOW()
);
```

## 7. Pipeline & Scheduling
- **Sync cadence:** cron expression `0 */6 * * *` to run fetcher.
- **Backfill:** manual command `python sync.py --since 2024-06-01` with rate-limit aware throttling.
- **Aggregation:** executed inline after each sync; refresh materialized views.
- **Data pruning:** nightly job deletes raw events older than 30 days and aggregates older than 90 days unless flagged.

## 8. Privacy & Governance
- Opt-in private channels only; maintain allowlist in configuration table.
- Obfuscate message text in stored events if not needed (keep timestamps and metadata only).
- Provide deletion command to purge all data for a user upon request.
- Audit sync activities via simple log file stored with raw snapshots.
- Limit dashboard access via basic auth or SSO gateway if available.

## 9. Security Considerations
- Store Slack tokens encrypted at rest (SSM parameter with KMS or encrypted `.env`).
- Rotate tokens quarterly; script supports reloading without redeploy.
- Restrict outbound network to Slack API endpoints.
- Apply least privilege IAM: read/write for S3 bucket (raw snapshots) and Postgres connection.
- Enable HTTPS for API/UI (ACM cert via ALB or reverse proxy like Nginx).

## 10. Deployment & Operations
- Local development: Docker Compose with seeded data.
- Staging/prod: Terraform optional; for prototype, parameterized Ansible or manual CloudFormation acceptable.
- Monitoring: basic CloudWatch alarms on task exit codes and sync duration; Postgres health check.
- Incident response: manual runbook for token revocation, rerun sync, restore from nightly backup.

## 11. Success Criteria
- Sync completes within 5 minutes for target workspace.
- Dashboard displays updated metrics within 30 minutes of sync.
- ≤5% API error rate during sync (handles rate limits gracefully).
- Positive feedback from pilot stakeholders (HR/Comms) on data usefulness.

## 12. Timeline & Milestones

| Milestone | Scope | Owner | Target |
|-----------|-------|-------|--------|
| M1: Access & App Setup | Slack app creation, scopes approved, opt-in list gathered | Product + Security | Week 1 |
| M2: Data Sync Prototype | Fetcher script, Postgres schema, initial metrics | Backend | Week 3 |
| M3: Dashboard Beta | API endpoints, basic UI, CSV export | Full stack | Week 4 |
| M4: Privacy Review | Opt-out handling, deletion flow, logging | Security | Week 5 |
| M5: Pilot Launch | Seed data, stakeholder walkthrough, feedback loop | Product | Week 6 |

## 13. Risks & Mitigations
- **Rate limits or missing data:** throttle requests, cache cursors, provide manual retry command.
- **Privacy concerns:** default to metadata-only storage, document opt-in, allow immediate opt-out toggles.
- **Limited accuracy of active window metric:** communicate as approximation; consider presence API if needed later.
- **Single instance failure:** schedule nightly database backups; documented restore process.

## 14. Open Questions
- Do we require automated deployment tooling for the prototype or is manual acceptable?
- Which storage option is preferred for raw payloads (S3 vs. encrypted local disk)?
- Do stakeholders need per-department filtering at launch or can it wait for post-pilot iteration?
- How will we authenticate pilot users to the dashboard (corporate SSO vs. basic auth)?

## 15. Post-MVP Considerations
- Introduce message-level topic tagging if privacy approvals allow.
- Evaluate scaling needs (queues, stream processing) once prototype adoption proven.
- Explore integration with corporate BI tools (Snowflake/Tableau).
- Add alerting and notifications for engagement drops or spikes.

