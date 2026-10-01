# 🚀 Velocity Retail — Complete End-to-End AWS Production Deployment Guide
> **Architecture:** AWS CloudFront (CDN + SSL) ➔ AWS ALB (Application Load Balancer) ➔ AWS ECS (Fargate Docker Container) ➔ MongoDB Atlas + Cloudinary

This step-by-step guide covers the entire production deployment from scratch. If you were setting this up manually or explaining it to an interviewer/mentor, follow these exact phases and commands.

---

## 📌 Architecture Flowchart

```text
[ Browser / Vercel Frontend (HTTPS) ]
                  │
                  ▼ (Port 443 - SSL / HTTPS)
[ AWS CloudFront CDN Edge ]  ───► Global Edge Caching & Automated Amazon Wildcard SSL
                  │
                  ▼ (Port 80 - Origin Forwarding)
[ AWS Application Load Balancer (ALB) ]  ───► Multi-AZ Traffic Distribution & Health Checks (/health)
                  │
                  ▼ (VPC Private/Public Subnet)
[ AWS ECS Fargate Task ]  ───► Docker Container running Node.js Backend (Port 5000)
                  │
                  ├───► MongoDB Atlas (Cloud Database)
                  ├───► Cloudinary (Product Media CDN)
                  └───► Groq AI (Llama 3 Merchandising Engine)
```

---

## 🛠️ Phase 1: AWS CLI Installation & Configuration

### 1. Install AWS CLI
* **Windows (PowerShell as Admin):**
  ```powershell
  msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi /qn
  ```
* **Verify Installation:**
  ```powershell
  aws --version
  # Output: aws-cli/2.x.x Python/3.x.x Windows/11 ...
  ```

### 2. Configure AWS Credentials
1. Open **AWS Management Console** ➔ Search **IAM** ➔ Go to **Users** ➔ Select your User (or Root/Admin).
2. Go to **Security credentials** tab ➔ Click **Create access key** ➔ Choose **Command Line Interface (CLI)**.
3. Copy your `Access Key ID` and `Secret Access Key`.
4. Run in your terminal:
  ```bash
  aws configure
  ```
  Fill in:
  * `AWS Access Key ID`: `[YOUR_ACCESS_KEY]`
  * `AWS Secret Access Key`: `[YOUR_SECRET_KEY]`
  * `Default region name`: `ap-south-1` (Mumbai)
  * `Default output format`: `json`

5. **Verify Credentials:**
  ```bash
  aws sts get-caller-identity
  # Output:
  # {
  #     "UserId": "523772385491",
  #     "Account": "523772385491",
  #     "Arn": "arn:aws:iam::523772385491:root"
  # }
  ```

---

## 🐳 Phase 2: Dockerize & Push Backend to Registry

### 1. Build Production Docker Image
Inside your project directory:
```bash
docker build -t aaronalen/velocity-retail-backend:latest ./backend
```

### 2. Test Locally (Optional Verification)
```bash
docker run -p 5000:5000 --env-file ./backend/.env aaronalen/velocity-retail-backend:latest
```

### 3. Push Image to Docker Hub
```bash
docker login
docker push aaronalen/velocity-retail-backend:latest
```

---

## ☁️ Phase 3: Setup AWS ECS (Elastic Container Service) on Fargate

### 1. Create ECS Cluster
```bash
aws ecs create-cluster \
  --cluster-name velocity-retail-cluster \
  --region ap-south-1
```

### 2. Create IAM Execution Role for ECS (If not existing)
ECS tasks need permission to pull images and log to CloudWatch:
```bash
# Trust policy JSON
cat <<EOF > ecs-trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-trust-policy.json

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### 3. Create CloudWatch Log Group
```bash
aws logs create-log-group \
  --log-group-name "/ecs/velocity-retail-backend" \
  --region ap-south-1
```

### 4. Register ECS Task Definition
Create `task-def.json`:
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
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "5000" },
        { "name": "MONGO_URI", "value": "mongodb+srv://...your_mongo_uri..." },
        { "name": "JWT_ACCESS_SECRET", "value": "your_access_secret" },
        { "name": "JWT_REFRESH_SECRET", "value": "your_refresh_secret" },
        { "name": "GROQ_API_KEY", "value": "your_groq_key" },
        { "name": "CLOUDINARY_CLOUD_NAME", "value": "your_cloud_name" },
        { "name": "CLOUDINARY_API_KEY", "value": "your_api_key" },
        { "name": "CLOUDINARY_API_SECRET", "value": "your_api_secret" }
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
Register the task definition:
```bash
aws ecs register-task-definition \
  --cli-input-json file://task-def.json \
  --region ap-south-1
```

---

## ⚖️ Phase 4: Setup AWS Application Load Balancer (ALB)

### 1. Get VPC & Subnet IDs
```bash
# Get Default VPC
aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text --region ap-south-1

# Get 3 Public Subnets across AZs (ap-south-1a, 1b, 1c)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=vpc-039619cf26628c1dd" --query "Subnets[*].SubnetId" --output text --region ap-south-1
```

### 2. Create Security Group for ALB
```bash
# Create Security Group allowing HTTP Port 80
aws ec2 create-security-group \
  --group-name "velocity-retail-alb-sg" \
  --description "Allow HTTP traffic from CloudFront to ALB" \
  --vpc-id "vpc-039619cf26628c1dd" \
  --region ap-south-1

# Allow Port 80 from everywhere
aws ec2 authorize-security-group-ingress \
  --group-id "sg-0cb2b29a1dbfc6e87" \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region ap-south-1
```

### 3. Create Target Group (Points to Port 5000 with `/health` check)
```bash
aws elbv2 create-target-group \
  --name "velocity-retail-tg" \
  --protocol HTTP \
  --port 5000 \
  --vpc-id "vpc-039619cf26628c1dd" \
  --target-type ip \
  --health-check-protocol HTTP \
  --health-check-port 5000 \
  --health-check-path "/health" \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region ap-south-1
```

### 4. Create the Application Load Balancer
```bash
aws elbv2 create-load-balancer \
  --name "velocity-retail-alb" \
  --subnets subnet-011dd38b725d032a8 subnet-0f135b19916678ab9 subnet-0943f394c63efffa2 \
  --security-groups sg-0cb2b29a1dbfc6e87 \
  --scheme internet-facing \
  --type application \
  --region ap-south-1
```
*Note the returned DNS Name: `velocity-retail-alb-1749032441.ap-south-1.elb.amazonaws.com`*

### 5. Create ALB Listener on Port 80
Forward Port 80 traffic to the Target Group:
```bash
aws elbv2 create-listener \
  --load-balancer-arn "arn:aws:elasticloadbalancing:ap-south-1:523772385491:loadbalancer/app/velocity-retail-alb/bfdeb3f8fb25a106" \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn="arn:aws:elasticloadbalancing:ap-south-1:523772385491:targetgroup/velocity-retail-tg/6187464c293bb467" \
  --region ap-south-1
```

### 6. Create the ECS Fargate Service (Attached to ALB Target Group)
```bash
aws ecs create-service \
  --cluster velocity-retail-cluster \
  --service-name velocity-retail-backend \
  --task-definition velocity-retail-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-011dd38b725d032a8,subnet-0f135b19916678ab9,subnet-0943f394c63efffa2],securityGroups=[sg-0cb2b29a1dbfc6e87],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn="arn:aws:elasticloadbalancing:ap-south-1:523772385491:targetgroup/velocity-retail-tg/6187464c293bb467",containerName=backend,containerPort=5000 \
  --region ap-south-1
```

### 7. Test ALB Health Directly
```bash
curl http://velocity-retail-alb-1749032441.ap-south-1.elb.amazonaws.com/health
# Response: {"status":"ok","timestamp":"2026-10-01T..."}
```

---

## ⚡ Phase 5: Setup AWS CloudFront CDN with HTTPS / SSL

### 1. Why CloudFront is needed:
* **ALB by default operates on HTTP (Port 80)** unless you buy a custom domain and configure ACM certificates.
* **Modern browsers block HTTP requests** from HTTPS frontends (like Vercel) due to Mixed Content Security.
* **CloudFront solves this completely for FREE** by providing:
  1. Automated Amazon Wildcard SSL (`https://*.cloudfront.net`).
  2. Edge Caching & Anti-DDoS protection.
  3. Automatic HTTP ➔ HTTPS 301 redirection.

### 2. Create CloudFront Distribution Configuration
Create `cf-config.json`:
```json
{
  "CallerReference": "velocity-retail-production-2026",
  "Aliases": { "Quantity": 0 },
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "velocity-retail-alb",
        "DomainName": "velocity-retail-alb-1749032441.ap-south-1.elb.amazonaws.com",
        "OriginPath": "",
        "CustomHeaders": { "Quantity": 0 },
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginSslProtocols": { "Quantity": 1, "Items": ["TLSv1.2"] },
          "OriginReadTimeout": 60,
          "OriginKeepaliveTimeout": 5
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": { "Enabled": false }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "velocity-retail-alb",
    "TrustedSigners": { "Enabled": false, "Quantity": 0 },
    "TrustedKeyGroups": { "Enabled": false, "Quantity": 0 },
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    },
    "CachedMethods": {
      "Quantity": 2,
      "Items": ["HEAD", "GET"]
    },
    "SmoothStreaming": false,
    "Compress": true,
    "ForwardedValues": {
      "QueryString": true,
      "Cookies": { "Forward": "all" },
      "Headers": {
        "Quantity": 4,
        "Items": ["Authorization", "Origin", "Accept", "Content-Type"]
      },
      "QueryStringCacheKeys": { "Quantity": 0 }
    },
    "MinTTL": 0,
    "DefaultTTL": 0,
    "MaxTTL": 0
  },
  "Comment": "Velocity Retail - Secure CloudFront CDN with ALB + ECS Backend",
  "PriceClass": "PriceClass_All",
  "Enabled": true,
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "SSLSupportMethod": "vip",
    "MinimumProtocolVersion": "TLSv1",
    "CertificateSource": "cloudfront"
  }
}
```

### 3. Create or Update CloudFront Distribution
```bash
aws cloudfront create-distribution \
  --distribution-config file://cf-config.json
```
*Live Distribution ID:* `E29CQMHR5T2MWI`  
*Live CloudFront HTTPS Domain:* `https://d2r14mddgufil7.cloudfront.net`

### 4. Verify Live HTTPS & SSL
```bash
# 1. Health check over HTTPS with valid Amazon SSL
curl -i https://d2r14mddgufil7.cloudfront.net/health

# 2. HTTP to HTTPS 301 Redirect Check
curl -i http://d2r14mddgufil7.cloudfront.net/health

# 3. Authentication & JWT Cookie Forwarding Check
curl -i -X POST "https://d2r14mddgufil7.cloudfront.net/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@velocity.com","password":"admin123"}'
```

---

## 🌐 Phase 6: Connect Frontend (Vercel) to AWS CloudFront

In `frontend/vercel.json`, route `/api/*` and `/socket.io/*` directly to the CloudFront HTTPS domain:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
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

Push to GitHub:
```bash
git add frontend/vercel.json
git commit -m "feat(deploy): route frontend API and WebSockets to AWS CloudFront HTTPS distribution"
git push origin main
```

---

## 🔍 How to Prove AWS Origin in Chrome DevTools (Live Demo)

1. Open your live app in Chrome: `https://retail-clau-capstone...vercel.app`
2. Press **F12** ➔ Go to **Network** tab ➔ Click **Fetch/XHR**.
3. Click any API request (e.g., `floor-swaps` or `products`).
4. Look at the **Headers** panel:
   * **`:authority`**: `d2r14mddgufil7.cloudfront.net`
   * **`:scheme`**: `https`
   * **`Via`**: `1.1 xxxxx.cloudfront.net (CloudFront)`
   * **`X-Amz-Cf-Pop`**: `BLR50-P4` (Bangalore Edge Location) or `MAA51-P3` (Chennai Edge Location)
   * **`X-Amz-Cf-Id`**: Unique Amazon request tracking hash.
