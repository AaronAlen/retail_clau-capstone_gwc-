# Velocity Retail — Fast-Mover Detection & Nearby Recommendation Engine

A full-stack retail analytics app: it detects which products are selling
**faster than their category average** ("fast movers") and recommends
**similar in-stock products** to merchandise next to them — the exact
"black shirt sells fast → suggest similar black shirts nearby" workflow.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express, TypeScript, MVC structure |
| Database | MongoDB + Mongoose |
| Auth | JWT (access + refresh tokens), bcrypt password hashing |
| Authorization | Role-Based Access Control (admin / manager / staff) |
| Realtime | Socket.IO (live stock + sale updates pushed to all dashboards) |
| Frontend | React 18, TypeScript, Redux Toolkit, React Router, Tailwind CSS |
| Charts | Recharts |
| AI | Groq API (optional) — generates a plain-language merchandising explanation on top of the deterministic recommendation engine |
| Containers | Docker + docker-compose |
| CI/CD | GitHub Actions (type-check, build, Docker image build) |
| Infra as Code | Terraform (AWS: VPC, ECS Fargate, IAM, CloudWatch) |

## How the core feature actually works

1. `backend/src/services/velocity.service.ts` computes units-sold-per-day for
   every product over a rolling window, then flags a product as a **fast
   mover** if its velocity is a category-relative outlier (mean + 0.75×stddev
   within its own category) — not a hardcoded number, so it adapts to your
   catalog.
2. `backend/src/services/recommendation.service.ts` scores every other
   in-stock product by category + color + shared tags, and returns the
   top matches for each fast mover.
3. If `GROQ_API_KEY` is set, `groq.service.ts` turns that into a natural
   -language merchandising insight; if it's not set (or the call fails),
   the app **silently falls back** to a rule-based sentence — the feature
   never breaks because of a missing key.

## Running locally (fastest path)

```bash
docker compose up --build
```
Then seed demo data (products + sales, with black items pre-weighted as
fast movers for a live demo):
```bash
docker compose exec backend npm run seed
```
Frontend: http://localhost:5173 — Backend: http://localhost:5000
Demo logins: `admin@velocity.com` / `admin123` (also `manager@` / `staff@` with matching passwords)

## Running Locally (Single Command)

From the project root:
```bash
npm run dev
```
> Runs both Backend (`http://localhost:5000`) and Frontend (`http://localhost:5173`) concurrently with unified colored logs (`[BACKEND]` in cyan, `[FRONTEND]` in magenta) and automatic port conflict resolution.

You can also run individual services if needed:
```bash
npm run dev:backend   # Backend only
npm run dev:frontend  # Frontend only
```

## What I verified before handing this to you

- Backend: `npx tsc --noEmit` — **0 errors**
- Frontend: `npx tsc -b --noEmit` and a full `vite build` — **0 errors, builds clean**
- Every API route is wired to a controller, protected by `protect` +
  `authorize()` role middleware where it should be, and the frontend calls
  match those routes exactly.

## What is honestly NOT verified/deployed (read before your interview)

- **AWS/Terraform**: the Terraform files in `infra/terraform/` are valid,
  complete HCL for a VPC + ECS Fargate + IAM + CloudWatch setup, but I have
  no AWS credentials and did **not** run `terraform apply` against a real
  account. You'll need to push images to ECR, fill in `terraform.tfvars`
  (copy from `terraform.tfvars.example`), and run `terraform init && terraform plan`
  yourself before `apply`.
- **CI/CD**: the GitHub Actions workflow runs type-checks + builds on every
  push; the Docker-push-to-registry step is commented out since it needs
  your own ECR/DockerHub secrets.
- **Groq/AI**: works only if you supply a real `GROQ_API_KEY`; otherwise the
  app uses the rule-based explanation automatically (this is intentional,
  not a bug).
- **RAG / LangGraph**: not used — for this problem (attribute similarity +
  time-series velocity), a small LLM call for explanation is more reliable
  and interview-defensible than bolting on a retrieval pipeline with nothing
  to retrieve from. Happy to add it if you can name a concrete need for it.
- I have not load-tested this or run it against a live MongoDB Atlas cluster.

## Folder structure
```
backend/    Express + TS API (MVC: models/controllers/routes/services)
frontend/   React + TS + Redux Toolkit SPA
infra/terraform/   AWS infrastructure as code
.github/workflows/ CI/CD pipeline
docker-compose.yml  One-command local stack
```
