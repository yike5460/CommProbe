# Slack Insight App Prototype TODOs

Use these checkboxes to track MVP implementation progress. Update weekly during stand-up.

## 1. Access & Compliance
- [ ] Secure approval for required Slack scopes (`conversations:read`, `conversations.history`, `reactions:read`, `users:read`).
- [ ] Finalize opt-in list for private channels and publish opt-out process.
- [ ] Store Slack bot token in SSM Parameter Store (or encrypted `.env` for local dev).

## 2. Prototype Environment Setup
- [ ] Stand up Postgres instance (Docker/local or small RDS) and create initial database.
- [ ] Configure S3 bucket or encrypted local directory for raw JSON snapshots.
- [ ] Package services with Docker Compose for local development.
- [ ] Provision single EC2/ECS target host and deploy base containers.

## 3. Sync & Backfill Service
- [ ] Implement Python Slack fetcher with pagination and rate-limit handling.
- [ ] Persist channel lists, memberships, and interaction events to Postgres.
- [ ] Write raw payloads to snapshot storage for auditing.
- [ ] Add CLI flags for manual backfill (`--since`) and dry-run.
- [ ] Schedule sync (cron/ECS scheduled task) to run every 6 hours.

## 4. Metrics & Storage Layer
- [ ] Define Postgres schemas (`users`, `channels`, `interaction_event`, `daily_user_metrics`, `channel_metrics`).
- [ ] Implement aggregation routines refreshing metrics after each sync.
- [ ] Create data pruning task (30-day raw, 90-day aggregates).
- [ ] Add unit tests covering aggregation calculations.

## 5. API & Dashboard
- [ ] Build FastAPI endpoints for user/channel metrics and CSV export.
- [ ] Implement simple UI (FastAPI templates or lightweight React) with filters by channel, user, date.
- [ ] Add basic authentication (shared secret or corporate SSO proxy).
- [ ] Document usage instructions for pilot users.

## 6. Privacy & Security
- [ ] Enforce opt-out filters in fetcher and API layers.
- [ ] Implement delete command to purge a user’s data on request.
- [ ] Capture sync logs (success/failure, counts) and store with snapshots.
- [ ] Review token rotation and access controls with Security.

## 7. Validation & Pilot
- [ ] Verify sync correctness with staged workspace (spot-check metrics vs. Slack UI).
- [ ] Run load test on Postgres queries with sample dataset.
- [ ] Conduct pilot walkthrough with HR/Comms stakeholders and collect feedback.
- [ ] Capture follow-up tasks for post-pilot iteration.

