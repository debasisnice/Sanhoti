# AWS Account Migration Plan

**Status:** Blocked — waiting on organization credit card details before starting.

## Goal

Move Sanhoti's hosting from Debasis's personal AWS account to a new AWS account
registered under **sanhoti.info@gmail.com**, with zero impact to end users and
no change to the current server specs.

## Hard constraints

- **No downtime / no user impact.** The current EC2 instance keeps serving
  `sanhoti.org` for the entire migration. Nothing changes for site visitors
  until the new instance is fully deployed, migrated, and verified directly
  via its own IP address. Only then do we cut over DNS.
- **Like-for-like move, not an upgrade.** New instance must match the current
  one exactly:
  - Instance type: t3.micro (or t2.micro)
  - AMI: Ubuntu Server 22.04 LTS
  - Region: us-east-1 (N. Virginia)
  - Storage: 30GB EBS (current free-tier config)
- **Cloudflare stays put.** Cloudflare is a separate account from AWS and
  already handles DNS/proxy/SSL for `sanhoti.org` — it does not need to move.
  Only the DNS **A record** gets repointed to the new instance's IP at
  cutover time.

## Current setup (for reference)

- Single EC2 instance, Ubuntu 22.04, us-east-1, public IP `44.220.179.207`
  (see `docs/YOUR_INSTANCE_DETAILS.md`)
- Nginx + PM2 running the Node backend; frontend built and served as static
  files
- No real database — all data lives as JSON files under `backend/data/` plus
  uploaded media folders (`Events_Flyers`, `HomePage_Images`, `Galleries`,
  `Magazines`, `Documents`, etc.) directly on the instance's disk
- Deploys happen via GitHub Actions (`.github/workflows/deploy.yml`) over SSH,
  using repo secrets `EC2_HOST`, `EC2_USER`, `EC2_SSH_PRIVATE_KEY`
- Domain `sanhoti.org` DNS/proxy/SSL is managed in Cloudflare, pointing at the
  EC2 instance's public IP

## Steps

1. **Create the new AWS account** at signin.aws.amazon.com/signup using
   sanhoti.info@gmail.com. Requires the org's credit card and possibly phone
   verification — user does this part directly (Claude can't enter payment
   info or verification codes).
2. **Secure the new account**: enable MFA on root, set billing alerts
   ($5/$10/$15), create an IAM admin user for day-to-day use instead of root.
3. **Launch the new EC2 instance**: same specs as above (t3.micro, Ubuntu
   22.04 LTS, us-east-1, 30GB EBS). Configure the security group per
   `docs/SECURITY_GROUP_SETUP.md` (SSH, HTTP, HTTPS). Create and download a
   new key pair.
4. **Install stack and deploy the app**: Node, Nginx, PM2, git; clone the
   repo; configure `backend/.env`; build backend + frontend; start under
   PM2; configure Nginx — following `docs/AWS_DEPLOYMENT_GUIDE.md` /
   `docs/SETUP.md`.
5. **Migrate data**: copy `backend/data/*.json` and all uploaded media
   folders from the old instance to the new one, preserving content exactly.
6. **SSL on the new origin** (if Cloudflare is set to Full/Full-strict):
   issue a Let's Encrypt cert on the new instance per `docs/HTTPS_SETUP.md`
   before cutover.
7. **Update GitHub Actions secrets** (`EC2_HOST`, `EC2_USER`,
   `EC2_SSH_PRIVATE_KEY`) to point future deploys at the new instance —
   but only after cutover is confirmed, so the old instance keeps
   auto-deploying/working as the live site until then.
8. **Test the new instance directly via its IP** — site loads, API works,
   images/uploads serve correctly, admin login works — before touching DNS.
9. **Cut over Cloudflare DNS**: update the A record(s) for `sanhoti.org` /
   `www` to the new instance's IP.
10. **Verify the live site post-cutover.**
11. **Decommission the old instance** in the personal AWS account only after
    the new one has been confirmed stable for a safe observation period.

## Next action when unblocked

Resume at step 1 — go to signin.aws.amazon.com/signup and create the account.
