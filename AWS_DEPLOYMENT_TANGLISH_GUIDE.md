# 🚀 Velocity Retail — AWS Production Deployment Complete Guide (Tanglish)

> **Architecture Summary:**  
> **Frontend (Vercel)** ➔ **AWS CloudFront (CDN + SSL)** ➔ **AWS ALB (Load Balancer)** ➔ **AWS ECS Fargate (Docker Backend)** ➔ **MongoDB Atlas & Cloudinary**

Intha guide-la namma project-ah AWS-la epdi zero-la irunthu live production varaikkum deploy pannom nu **romba theliva, step-by-step Tanglish-la** explain pannirukom. Viva / Mentor review-ku ithu ungalukku romba helpful-ah irukkum!

---

## 🗺️ Architecture Overview (Enna Nadakkuthu?)

```text
       ┌────────────────────────────────────────────────────────┐
       │             User Browser / Vercel Frontend             │
       └──────────────────────────┬─────────────────────────────┘
                                  │ (HTTPS - Port 443)
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │                  AWS CloudFront CDN                    │
       │           d2r14mddgufil7.cloudfront.net                │
       │    • Free Amazon Wildcard SSL Certificate (HTTPS)      │
       │    • Global Edge Caching & Anti-DDoS                   │
       │    • Automatic HTTP ➔ HTTPS Redirect (301)             │
       └──────────────────────────┬─────────────────────────────┘
                                  │ (Secure Origin Forwarding)
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │             AWS Application Load Balancer (ALB)        │
       │        velocity-retail-alb.ap-south-1.elb.amazonaws    │
       │    • Multi-AZ Traffic Distribution                     │
       │    • Health Checking on /health                        │
       └──────────────────────────┬─────────────────────────────┘
                                  │ (Internal VPC Forwarding)
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │                AWS ECS Fargate Cluster                 │
       │             velocity-retail-backend Service            │
       │    • Dockerized Node.js Microservice                   │
       │    • MongoDB Atlas Database Connected                  │
       │    • Cloudinary CDN Asset Integration                  │
       └────────────────────────────────────────────────────────┘
```

---

## ❓ Enakkaga CloudFront Venum? (Mentor Interview Question)
* **Question:** ALB irukke, direct-ah ALB-kku connect pannalaame, yen CloudFront pottenga?
* **Answer:**
  1. **Mixed Content Error Block:** Namma frontend Vercel-la **HTTPS (Port 443)**-la run aaguthu. Aana ALB default-ah **HTTP (Port 80)**-la thaan irukku. Browser-la HTTPS site HTTP API-ah call panna modern browser security block pannidum.
  2. **Free SSL Certificate:** ALB-kku HTTPS poda custom domain & ACM certificate venum. Aana CloudFront-la **Free Amazon Wildcard SSL (`https://*.cloudfront.net`)** default-ah kedaikkum!
  3. **Global Edge Speed:** CloudFront-oda Chennai (MAA) and Bangalore (BLR) edge servers namma API & assets-ah fast-ah deliver pannum.

---

## 🛠️ Step 1: AWS CLI Setup & Credentials Configure Panrathu

### 1. AWS CLI Install Pannanum (Windows):
PowerShell-ah Administrator-ah open panni intha command run pannunga:
```powershell
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi /qn
```
Check panna:
```bash
aws --version
```

### 2. AWS Console-la Access Key edukrathu:
1. AWS Console website login pannunga (`https://aws.amazon.com/console/`).
2. Mela search bar-la **IAM** nu search panni ponga.
3. Left side-la **Users** click panni, unga user name select pannunga.
4. **Security credentials** tab-ku poyi, keela scroll panni **Create access key** click pannunga.
5. **Command Line Interface (CLI)** choose pannitu, **Create** click pannunga.
6. `Access Key ID` and `Secret Access Key`-ah copy pannikoonga.

### 3. Terminal-la Login (Configure) Pannanum:
```bash
aws configure
```
Input details:
* **AWS Access Key ID:** `[Unga Key]`
* **AWS Secret Access Key:** `[Unga Secret]`
* **Default region name:** `ap-south-1` (Mumbai)
* **Default output format:** `json`

Check panna:
```bash
aws sts get-caller-identity
```

---

## 🐳 Step 2: Backend-ah Docker Build & Push Panrathu

Namma backend code-ah container image-ah maathi Docker Hub-ku anupanum:

```bash
# 1. Image Build (Project root-la irunthu)
docker build -t aaronalen/velocity-retail-backend:latest ./backend

# 2. Docker Login
docker login

# 3. Docker Hub-ku Push
docker push aaronalen/velocity-retail-backend:latest
```

---

## ☁️ Step 3: AWS ECS Fargate Cluster & `.env` Setup

### 1. ECS Cluster Create Pannanum:
```bash
aws ecs create-cluster --cluster-name velocity-retail-cluster --region ap-south-1
```

### 2. CloudWatch Log Group (Logs Paarka):
```bash
aws logs create-log-group --log-group-name "/ecs/velocity-retail-backend" --region ap-south-1
```

### 3. `.env` Details-ah Task Definition-la Add Panrathu:
`.env` details-ah add panna **2 Vazhi** irukku:

#### 👉 Option A: AWS Console Moolama (Browser GUI)
1. AWS Console ➔ Search **ECS** ➔ Left side **Task definitions** click pannunga.
2. `velocity-retail-backend` click panni, mela **Create new revision** click pannunga.
3. Keela scroll panna **Container - 1 (backend)** irukkum.
4. Athula **Environment variables** section-la **Add environment variable** click panni unga `.env` keys & values kudunga:
   * `PORT`: `5000`
   * `NODE_ENV`: `production`
   * `MONGO_URI`: `mongodb+srv://...`
   * `JWT_ACCESS_SECRET`: `...`
   * `JWT_REFRESH_SECRET`: `...`
   * `GROQ_API_KEY`: `...`
   * `CLOUDINARY_CLOUD_NAME`: `...`
   * `CLOUDINARY_API_KEY`: `...`
   * `CLOUDINARY_API_SECRET`: `...`
5. Keela **Create** click pannunga.

#### 👉 Option B: AWS CLI Moolama (`task-def.json`)
Oru `task-def.json` file create panni:
```json
{
  "family": "velocity-retail-backend",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::523772385491:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "aaronalen/velocity-retail-backend:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 5000, "protocol": "tcp" }],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "5000" },
        { "name": "MONGO_URI", "value": "mongodb+srv://..." },
        { "name": "JWT_ACCESS_SECRET", "value": "..." },
        { "name": "JWT_REFRESH_SECRET", "value": "..." },
        { "name": "GROQ_API_KEY", "value": "..." },
        { "name": "CLOUDINARY_CLOUD_NAME", "value": "..." },
        { "name": "CLOUDINARY_API_KEY", "value": "..." },
        { "name": "CLOUDINARY_API_SECRET", "value": "..." }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/velocity-retail-backend",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "backend"
        }
      }
    }
  ]
}
```
Run command:
```bash
aws ecs register-task-definition --cli-input-json file://task-def.json --region ap-south-1
```

---

## ⚖️ Step 4: AWS Application Load Balancer (ALB) Setup

ECS container direct public exposure illama, munnadi load balancer pottu protect pannom:

### 1. ALB Security Group (Allow Port 80 HTTP):
```bash
aws ec2 create-security-group \
  --group-name "velocity-retail-alb-sg" \
  --description "Allow HTTP traffic" \
  --vpc-id "vpc-039619cf26628c1dd" \
  --region ap-south-1

aws ec2 authorize-security-group-ingress \
  --group-id "sg-0cb2b29a1dbfc6e87" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0 --region ap-south-1
```

### 2. Target Group (Port 5000 + `/health` Check):
```bash
aws elbv2 create-target-group \
  --name "velocity-retail-tg" \
  --protocol HTTP --port 5000 \
  --vpc-id "vpc-039619cf26628c1dd" \
  --target-type ip \
  --health-check-path "/health" \
  --health-check-interval-seconds 30 \
  --region ap-south-1
```

### 3. Load Balancer Create Panrathu:
```bash
aws elbv2 create-load-balancer \
  --name "velocity-retail-alb" \
  --subnets subnet-011dd38b725d032a8 subnet-0f135b19916678ab9 subnet-0943f394c63efffa2 \
  --security-groups sg-0cb2b29a1dbfc6e87 \
  --scheme internet-facing --type application \
  --region ap-south-1
```
👉 *DNS Name:* `velocity-retail-alb-1749032441.ap-south-1.elb.amazonaws.com`

### 4. Listener Create Panni Forward Panrathu:
```bash
aws elbv2 create-listener \
  --load-balancer-arn "arn:aws:elasticloadbalancing:ap-south-1:523772385491:loadbalancer/app/velocity-retail-alb/bfdeb3f8fb25a106" \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="arn:aws:elasticloadbalancing:ap-south-1:523772385491:targetgroup/velocity-retail-tg/6187464c293bb467" \
  --region ap-south-1
```

### 5. ECS Service Start Panni ALB Target Group-kku connect panrathu:
```bash
aws ecs create-service \
  --cluster velocity-retail-cluster \
  --service-name velocity-retail-backend \
  --task-definition velocity-retail-backend \
  --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-011dd38b725d032a8,subnet-0f135b19916678ab9,subnet-0943f394c63efffa2],securityGroups=[sg-0cb2b29a1dbfc6e87],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn="arn:aws:elasticloadbalancing:ap-south-1:523772385491:targetgroup/velocity-retail-tg/6187464c293bb467",containerName=backend,containerPort=5000 \
  --region ap-south-1
```

---

## ⚡ Step 5: AWS CloudFront CDN + Free HTTPS / SSL Setup

Ithu thaan most critical step:

### 1. CloudFront Settings JSON (`cf-config.json`):
* **Origin:** `velocity-retail-alb-1749032441.ap-south-1.elb.amazonaws.com` (Port 80)
* **Viewer Protocol Policy:** `redirect-to-https` (All visitors forced to SSL HTTPS)
* **Allowed HTTP Methods:** `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`
* **Forward Cookies:** `all` (JWT HttpOnly cookies bypass aaganum)
* **Forward Headers:** `Authorization, Origin, Accept, Content-Type`
* **Cache Policy:** Caching Disabled (Real-time dynamic API sync kaga)

### 2. Create / Update Command:
```bash
aws cloudfront update-distribution \
  --id E29CQMHR5T2MWI \
  --if-match [ETAG] \
  --distribution-config file://cf-config.json
```
👉 *Live CloudFront HTTPS Domain:* **`https://d2r14mddgufil7.cloudfront.net`**

### 3. Terminal-la Verify Panrathu:
```bash
# 1. Live HTTPS Health Check
curl -i https://d2r14mddgufil7.cloudfront.net/health

# 2. HTTP to HTTPS Redirection Check
curl -i http://d2r14mddgufil7.cloudfront.net/health

# 3. Authentication & JWT Cookie Check
curl -i -X POST "https://d2r14mddgufil7.cloudfront.net/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velocity.com","password":"admin123"}'
```

---

## 🌐 Step 6: Frontend (Vercel)-ah CloudFront-kku Connect Panrathu

[`frontend/vercel.json`](file:///c:/Users/aaron/Desktop/gwc/week12/retail_clau/frontend/vercel.json) file-la rewrites destination-ah update pannom:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://d2r14mddgufil7.cloudfront.net/api/:path*"
    },
    {
      "source": "/socket.io/:path*",
      "destination": "https://d2r14mddgufil7.cloudfront.net/socket.io/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Git commit & push:
```bash
git add frontend/vercel.json
git commit -m "feat(deploy): route frontend API to AWS CloudFront HTTPS"
git push origin main
```

---

## 🔍 Chrome DevTools-la Proof Kaaturathu Epdi? (Viva Demo)

1. Live website-kku ponga: `https://retail-clau-capstone...vercel.app`
2. Keyboard-la **F12** press panni Developer Tools open pannunga.
3. **Network** tab click pannitu ➔ **Fetch/XHR** filter choose pannunga.
4. Page-ah hard refresh pannunga (`Ctrl + Shift + R`).
5. Anga varra API call (e.g. `floor-swaps` or `products`) mela click pannunga.
6. Valathu pakkam **Headers** tab-la paarunga:
   * **`:authority`**: `d2r14mddgufil7.cloudfront.net`
   * **`:scheme`**: `https`
   * **`Via`**: `1.1 xxxxx.cloudfront.net (CloudFront)`
   * **`X-Amz-Cf-Pop`**: `BLR50-P4` (Bangalore Edge Location) / `MAA51-P3` (Chennai Edge Location)
   * **`X-Amz-Cf-Id`**: Amazon unique tracking ID!

---

## 🗣️ Interview / Mentor Viva Q&A (Tanglish)

### Q1: Unga architecture-oda scale & high availability epdi irukku?
> *"Sir, namma Application Load Balancer multiple Availability Zones-la (ap-south-1a, 1b, 1c) subnets-la distribute aagi irukku. Background-la ECS Fargate tasks auto-scale panna mudiyum. Edge layer-la CloudFront DDoS attacks-ah block panni caching provide pannuthu!"*

### Q2: Mixed content issue-na enna, athai epdi fix panneenga?
> *"Sir, Vercel frontend HTTPS-la load aagum. Namma ALB Port 80 HTTP-la irunthuchu. Browser security HTTPS site-la irunthu HTTP API-ah call panna block pannidum. Athuku namma CloudFront Edge create panni, athula Amazon Wildcard SSL terminate panni, HTTP-to-HTTPS redirect enforce pannitom sir!"*

### Q3: JWT Authentication and HttpOnly cookies CloudFront moolama velai seyyutha?
> *"Kandippa sir. CloudFront cache behavior-la `Cookies: forward: all` and `Headers: Authorization, Origin, Content-Type` whitelist pannirukom. Athanaala browser send panra JWT HttpOnly cookies direct-ah backend container-kku pass aagum sir!"*
