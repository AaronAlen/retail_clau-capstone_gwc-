const puppeteer = require('puppeteer-core');
const path = require('path');
const { getBaseCSS, CHROME_PATH } = require('./pdf_styles');

const getTanglishHTML = () => `
<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="UTF-8">
  <title>Velocity Retail — Tanglish Technical Documentation & Viva Script</title>
  <style>
    ${getBaseCSS()}
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover-page">
    <div>
      <div class="cover-badge">Capstone Engineering Guide (Tanglish Edition)</div>
      <div class="cover-title">VELOCITY RETAIL</div>
      <div class="cover-subtitle">Autonomous AI-Driven Merchandising Engine & 3D Interactive Digital Twin Showroom</div>
      
      <div class="cover-tags">
        <span class="cover-tag">Three.js 3D WebGL</span>
        <span class="cover-tag">AWS ECS Fargate</span>
        <span class="cover-tag">AWS CloudFront (SSL)</span>
        <span class="cover-tag">AWS Load Balancer (ALB)</span>
        <span class="cover-tag">React 18 + Vite</span>
        <span class="cover-tag">Node.js + TypeScript</span>
        <span class="cover-tag">MongoDB Atlas</span>
        <span class="cover-tag">Groq Llama 3 (70B)</span>
        <span class="cover-tag">Socket.IO Live Sync</span>
      </div>
    </div>

    <div class="cover-meta">
      <div class="cover-meta-item">
        <strong>Developer & Author</strong>
        <span>Aaron Alen</span>
      </div>
      <div class="cover-meta-item">
        <strong>Project Type</strong>
        <span>Full-Stack Cloud & 3D WebGL Capstone Project</span>
      </div>
      <div class="cover-meta-item">
        <strong>Live Production Status</strong>
        <span>AWS CloudFront CDN + ECS Fargate + Vercel</span>
      </div>
      <div class="cover-meta-item">
        <strong>Document Version & Date</strong>
        <span>Tanglish Edition v2.4 | October 2026</span>
      </div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="page-break"></div>
  <h1>Table of Contents (Tanglish)</h1>
  <ol style="line-height: 2; font-size: 10.5pt; margin-top: 20px;">
    <li><strong>Project Overview & Problem Statement (Enna Problem Solve Panrom?)</strong> .................. 3</li>
    <li><strong>Production Cloud Architecture (AWS-la Epdi Run Aaguthu?)</strong> ..................................... 4</li>
    <li><strong>3D Digital Twin Showroom (Three.js WebGL & Bilateral Flight)</strong> ...................................... 6</li>
    <li><strong>AI Recommendation Engine (Apriori Market Basket & Groq LLM)</strong> ................................. 8</li>
    <li><strong>Station Reset & Incremental Stacking Bug Fix (Wildcard Fly Fix)</strong> ................................... 10</li>
    <li><strong>Mobile Login Issue & Dual-Layer Authentication Fix</strong> ..................................................... 12</li>
    <li><strong>Database Design & MongoDB Atlas Schema Models</strong> .................................................... 14</li>
    <li><strong>Role-Based Access Control (Admin, Manager, Staff Permissions)</strong> ................................. 16</li>
    <li><strong>Complete AWS Production Deployment Commands Runbook</strong> ...................................... 17</li>
    <li><strong>Top 15 Mentor Viva Q&A (Exam & Interview Presentation Script)</strong> .................................. 19</li>
  </ol>

  <!-- CHAPTER 1 -->
  <div class="page-break"></div>
  <h1>1. Project Overview & Problem Statement</h1>
  
  <h2>1.1 Physical Retail-la Enna Prachina? (The Real-World Problem)</h2>
  <p>
    Normal-ah physical retail fashion stores-la (like Zara, H&M, Lifestyle) visual merchandising decisions ellam <strong>manual intuition</strong> and static PDF planogram moolama thaan nadakkuthu. Store associates avangalukku thonura maari dress-ah eduthu mannequins-la maatuvaanga. Athoda sales impact epdi irukku nu avangalukku theriyathu.
  </p>
  <ul>
    <li><strong>Sales Velocity Theriyathu:</strong> Nalla vikkura fast-moving product moolai cupboard-la thungi kittu irukkum, aana slow-moving dead stock center mannequin-la space waste pannitu irukkum.</li>
    <li><strong>Cross-Selling Miss Aaguthu:</strong> Customer oru Shirt vaangina athuku suit aagura Pants or Shoes-ah bundle panni display panna real-time transaction synergy data irukkaathu.</li>
    <li><strong>Heavy Manual Work:</strong> Oru display look nalla irukkuma nu paaka staff physical-ah mannequins-ah thookitu showroom full-ah alayanum.</li>
  </ul>

  <h2>1.2 Namma Velocity Retail Kudukkura Solution</h2>
  <div class="callout success">
    <div class="callout-title">Core Value Proposition</div>
    Namma project customer-oda live billing data-va analyze panni, <strong>Apriori Algorithm (Market Basket Analysis)</strong> and <strong>Groq Llama 3 AI</strong> moolama best matching outfit bundles-ah generate pannuthu. Athai oru <strong>3D Interactive Digital Twin Showroom (Three.js WebGL)</strong>-la store manager-kku live-ah kaati, single-click-la bilateral flight animation-la mannequins-kku deploy pannuthu!
  </div>

  <!-- CHAPTER 2 -->
  <div class="page-break"></div>
  <h1>2. Production Cloud Architecture (AWS-la Epdi Run Aaguthu?)</h1>

  <h2>2.1 Complete Flow Diagram</h2>
  <div class="diagram-box">
[ User Browser / Mobile Device ]
              │
              ▼ (HTTPS / Port 443)
[ AWS CloudFront CDN Edge ] ────────► Global Edge Caching & Automated Amazon Wildcard SSL
              │
              ▼ (HTTP / Port 80)
[ AWS Application Load Balancer ] ──► Multi-AZ Traffic Distribution & Health Check (/health)
              │
              ▼ (VPC awsvpc Network)
[ AWS ECS Fargate Container ] ──────► Dockerized Node.js Microservice (Port 5000)
              │
              ├──────► MongoDB Atlas (Encrypted Cloud Cluster)
              ├──────► Cloudinary CDN (High-Res 2K Texture Assets)
              └──────► Groq Cloud API (Llama 3 70B Merchandiser)
  </div>

  <h2>2.2 Yen CloudFront Mandatory-ah Pottom? (Mentor Interview Favorite!)</h2>
  <p>
    ALB munnadi CloudFront podurathukku 3 mukkiyamaana technical reasons:
  </p>
  <ol>
    <li><strong>Mixed Content Error Block Fix:</strong> Namma frontend Vercel-la strict <strong>HTTPS (Port 443)</strong>-la run aaguthu. Aana ALB default-ah <strong>HTTP (Port 80)</strong>-la thaan irukku. Browser-la HTTPS site HTTP API-ah call panna Chrome security block pannidum. CloudFront Amazon-oda free wildcard SSL (<code>https://*.cloudfront.net</code>) terminate panni HTTPS enforce pannuthu.</li>
    <li><strong>Super Fast Edge Speed:</strong> CloudFront Chennai (<code>MAA51-P3</code>) and Bangalore (<code>BLR50-P4</code>) Edge POPs moolama requests-ah cache panni instant response kudukkum.</li>
    <li><strong>Cookie & Header Pass-Through:</strong> CloudFront cache behavior-la <code>Cookies: all</code> and <code>Authorization</code>, <code>Origin</code> headers whitelist pannirukom. Athanaala JWT session drop aagave aagathu!</li>
  </ol>

  <!-- CHAPTER 3 -->
  <div class="page-break"></div>
  <h1>3. 3D Digital Twin Showroom (Three.js WebGL & Bilateral Flight)</h1>

  <h2>3.1 Showroom 3D Spatial Layout</h2>
  <p>
    Showroom full-ah Three.js WebGL coordinate space-la math model panni build pannirukom:
  </p>
  <ul>
    <li><strong>8 Display Cupboards:</strong> Wall-ah suthi geometrically place aagirukku (Shirts, T-Shirts, Jeans, Jackets, Shoes).</li>
    <li><strong>2 Hero Mannequins:</strong> Center stage-la elevated stone pedestals mela <code>[X: -4.5, Z: 0]</code> and <code>[X: +4.5, Z: 0]</code> coordinates-la spot lighting-oda fix pannirukom.</li>
  </ul>

  <h2>3.2 Bilateral 2-Way Flight Animation (Physics Math)</h2>
  <p>
    Normal-ah web app-la images switch aagum. Aana namma showroom-la **2-Way Simultaneous Flight** nadakkum:
  </p>
  <div class="diagram-box">
  Shelf Product (Cupboard) ──────── Parabolic Bezier Arc ────────► Mannequin Station
  Old Mannequin Product ◄────────── Return Bezier Arc ──────────── Shelf Cupboard
  </div>
  <p>
    Intha trajectory <strong>Quadratic Bezier Curve</strong> equation use panni calculate aaguthu:
  </p>
  <pre><code>P(t) = (1 - t)² · P_start + 2(1 - t)t · P_control + t² · P_end</code></pre>
  <p>
    Ithula <code>P_control.y = max(P_start.y, P_end.y) + 3.5</code> nu vachu parachuted parabolic arch create panrom. Athanaala cupboards mela garments idikkaama sky-la smooth-ah fly aagi swap aagum.
  </p>

  <h2>3.3 Floating Footwear Fix (Pedestal Clearance)</h2>
  <div class="callout info">
    <div class="callout-title">Footwear Clipping Problem & Solution</div>
    Mannequins 0.5-unit stone pedestal mela irukurathaala, shoes ground level-la render aagi pedestal kulla embedded aagi maranjuruchu. Namma vertical offset math add panni <code>targetSlot.y + pedestalElevation + 0.12</code> nu raise pannom. Ippo shoes pedestal mela Drop-Shadows-oda gilli-ya theriuthu!
  </div>

  <!-- CHAPTER 4 -->
  <div class="page-break"></div>
  <h1>4. AI Recommendation Engine (Apriori & Groq LLM)</h1>

  <h2>4.1 Market Basket Analysis (MBA) Formulas</h2>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Math Formula</th>
        <th>Business Meaning</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Support</strong></td>
        <td><code>freq(A ∪ B) / Total Bills</code></td>
        <td>Rendu products sernthu ethana customer vangaangalo antha percentage.</td>
      </tr>
      <tr>
        <td><strong>Confidence</strong></td>
        <td><code>freq(A ∪ B) / freq(A)</code></td>
        <td>Item A vaangura customer Item B-ayum kandippa vaangura probability.</td>
      </tr>
      <tr>
        <td><strong>Lift</strong></td>
        <td><code>Confidence / Support(B)</code></td>
        <td>Lift &gt; 1.0 iruntha thaan athu genuine complementary synergy (e.g. Suit + Tie).</td>
      </tr>
    </tbody>
  </table>

  <h2>4.2 Groq Llama 3 (70B) AI Copilot</h2>
  <p>
    Apriori mathematical scores generate pannum. Aana <strong>Groq Llama 3 AI</strong> athai human retail strategy-ah mathi manager-kku recommend pannum:
  </p>
  <ul>
    <li>Slow moving dead-stock-ah best seller kooda bundle panni fast-ah liquidate panna strategy solra prompt engineering.</li>
    <li>Real-time AI Copilot Drawer-la staff ethu pathi kettaalum inventory velocity insights instant-ah explain pannum.</li>
  </ul>

  <!-- CHAPTER 5 -->
  <div class="page-break"></div>
  <h1>5. Station Reset & Incremental Stacking Bug Fix</h1>

  <h2>5.1 User Kanda 2 Critical Bugs</h2>
  <ol>
    <li><strong>1-by-1 Overwrite Bug:</strong> Oru station-la 4 items-ah onnu onna swap pannitu, apram Reset Station click panna 1 item mattum shelf-ku poguthu, matha 3 mannequin-laye ninnuduthu.</li>
    <li><strong>20-30 Products Sky-la Fly Aana Wildcard Bug:</strong> Meethi 3 items-ah thirumba reset panna try panna, store full-ah ulla 20-30 cupboards boxes sky-la fly aagi floating aayiduthu.</li>
  </ol>

  <h2>5.2 Root Cause & Namma Panna Permanent Fix</h2>
  <div class="callout success">
    <div class="callout-title">How We Solved It Completely</div>
    <strong>1. Backend Stacking (<code>executeFloorSwap</code>):</strong> Pazhaiya code puthu item varum bothu mathatha delete pannichu. Ippo atomic merging panni station-la ulla ella roles-um (Jacket, Shirt, Pants, Shoes) preserve aagura maari stack pannitom.<br>
    <strong>2. Wildcard Flight Guard:</strong> Empty array (<code>revertedProductIds: []</code>) vantha flight animation-ah trigger panna koodathu nu <code>if (!specificProductIds || specificProductIds.length === 0) return;</code> guard potom.<br>
    <strong>3. Scoped Flight:</strong> Flight animation loop-la antha specific station mathi cupboards fly aagatha maari boundary restrict pannitom.
  </div>

  <!-- CHAPTER 6 -->
  <div class="page-break"></div>
  <h1>6. Mobile Login Issue & Dual-Layer Authentication Fix</h1>

  <h2>6.1 Mobile-la Yen Login Aagala?</h2>
  <p>
    Rendu mukkiyamaana karanam:
  </p>
  <ul>
    <li><strong>Google Breach Alert Popup:</strong> Pazhaiya password <code>admin123</code> weak-ah irundhathaala, Android Chrome OS-level-la popup pottu screen-ah block panniruchu.</li>
    <li><strong>Cross-Site Cookie Block on Mobile:</strong> Mobile Chrome / Safari tracking protection HttpOnly session cookies-ah block panniduchu, athanaala dashboard load aana maru-nodiyame logout aagi login-kku bounce aachu.</li>
  </ul>

  <h2>6.2 Namma Panna Permanent Fix (Dual-Layer Auth)</h2>
  <table>
    <thead>
      <tr>
        <th>Auth Method</th>
        <th>Epdi Work Aaguthu?</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>HttpOnly Cookies</strong></td>
        <td>Desktop browsers-la automatic-ah cookie transmit aagum</td>
        <td>XSS Attack Protection</td>
      </tr>
      <tr>
        <td><strong>Bearer Token Fallback</strong></td>
        <td><code>localStorage</code> token-ah Axios Request Interceptor-la <code>Authorization: Bearer &lt;token&gt;</code>-ah attach panrom</td>
        <td>Mobile-la cookies block aanaalum 100% smooth login!</td>
      </tr>
      <tr>
        <td><strong>Strong Credentials</strong></td>
        <td><code>Velocity@Admin2026!</code> password set pannitom</td>
        <td>Google Password Manager breach popup zero!</td>
      </tr>
    </tbody>
  </table>

  <!-- CHAPTER 7 -->
  <div class="page-break"></div>
  <h1>7. Database Design & MongoDB Atlas Schema Models</h1>

  <p>Project-la 6 core Mongoose Schemas irukku:</p>
  <ul>
    <li><strong>User:</strong> Staff credentials and RBAC roles (Admin, Manager, Staff) with bcrypt 10 rounds hash.</li>
    <li><strong>Product:</strong> 3D showroom coordinates <code>{ x, y, z }</code>, Category, SKU, Price, Stock, Cloudinary image URL.</li>
    <li><strong>Sale:</strong> POS billing transactions, purchased items array, total amount, cashier ID.</li>
    <li><strong>Planogram:</strong> Active visual merchandising layouts and shelf zone mappings.</li>
    <li><strong>FloorSwap:</strong> Station swaps, executedItems and displacedItems tracking for 2-way bilateral flight and resets.</li>
    <li><strong>CategoryVelocity:</strong> 7-day velocity aggregation, units sold daily, turnover score.</li>
  </ul>

  <!-- CHAPTER 8 -->
  <div class="page-break"></div>
  <h1>8. Role-Based Access Control (RBAC) & Security</h1>

  <table>
    <thead>
      <tr>
        <th>Role</th>
        <th>3D Showroom</th>
        <th>AI Recommendations</th>
        <th>Product Catalog</th>
        <th>User Management</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>👑 Admin</strong></td>
        <td>Full Access</td>
        <td>Deploy & Reset</td>
        <td>Add, Edit, Delete</td>
        <td>Add, Role Change, Delete</td>
      </tr>
      <tr>
        <td><strong>👔 Manager</strong></td>
        <td>Full Access</td>
        <td>Deploy & Reset</td>
        <td>View Catalog & Stock</td>
        <td>Blocked (403 Forbidden)</td>
      </tr>
      <tr>
        <td><strong>🛒 Cashier / Staff</strong></td>
        <td>View Only</td>
        <td>Read Only (No Deploy)</td>
        <td>View Products Only</td>
        <td>Blocked (403 Forbidden)</td>
      </tr>
    </tbody>
  </table>

  <!-- CHAPTER 9 -->
  <div class="page-break"></div>
  <h1>9. Complete AWS Production Deployment Commands Runbook</h1>

  <pre><code># 1. Docker Image Build & Push
docker build -t aaronalen/velocity-retail-backend:latest ./backend
docker push aaronalen/velocity-retail-backend:latest

# 2. Register ECS Fargate Task Definition with .env variables
aws ecs register-task-definition --cli-input-json file://task-def.json --region ap-south-1

# 3. Create Target Group with /health check
aws elbv2 create-target-group --name "velocity-retail-tg" --protocol HTTP --port 5000 \
  --vpc-id "vpc-039619cf26628c1dd" --target-type ip --health-check-path "/health" --region ap-south-1

# 4. Create Internet-Facing ALB
aws elbv2 create-load-balancer --name "velocity-retail-alb" \
  --subnets subnet-011dd38b725d032a8 subnet-0f135b19916678ab9 subnet-0943f394c63efffa2 \
  --security-groups sg-0cb2b29a1dbfc6e87 --scheme internet-facing --region ap-south-1

# 5. Create CloudFront Distribution with HTTPS Redirect & Cookies Forwarding
aws cloudfront create-distribution --distribution-config file://cf-config.json

# 6. Vercel Frontend Rewrites Route to CloudFront:
# /api/* -> https://d2r14mddgufil7.cloudfront.net/api/*</code></pre>

  <!-- CHAPTER 10 -->
  <div class="page-break"></div>
  <h1>10. Top 15 Mentor Viva Q&A (Tanglish Presentation Script)</h1>

  <h3>Q1: Retail management-kku yen 3D visualizer choose panneenga?</h3>
  <p>
    <strong>Answer:</strong> Normal 2D tables-la store associates-kku visual layout feel kedaikaathu sir. Fashion retail eppovume spatial and visual experience. Three.js 3D twin use panrathala, real physical store-ah maathurathukku munnadiye floor aesthetics and customer eye-level impact-ah digital-ah simulation panni paathukalaam.
  </p>

  <h3>Q2: Neenga AWS use pannirukeenga nu epdi prove pannuveenga?</h3>
  <p>
    <strong>Answer:</strong> Chrome DevTools Network Tab open panni paatha, namma API calls direct-ah <code>:authority: d2r14mddgufil7.cloudfront.net</code>-kku pogum sir. Response headers-la <code>Via: 1.1 ... cloudfront.net</code> and <code>X-Amz-Cf-Pop: BLR50-P4</code> theriyum. Athu namma AWS ALB moolama AWS ECS Fargate container-kku route aagi data fetch pannuthu.
  </p>

  <h3>Q3: WebSocket / Socket.IO yen theva pattuthu?</h3>
  <p>
    <strong>Answer:</strong> Oru store-la multiple staff tablets vachirupaanga. Manager mannequin-kku oru bundle swap panna pothu, matha ella floor terminals-layum real-time-ah bilateral flight animation fly aagi sync aaganum. Manual page refresh theva illama instant sync aaga Socket.IO gateway use pannirukom sir.
  </p>

  <div class="doc-footer">
    <span>Velocity Retail — Tanglish Engineering Reference & Viva Script</span>
    <span>Author: Aaron Alen | October 2026</span>
  </div>

</body>
</html>
`;

async function generatePDF() {
  console.log('Launching headless Chrome for Tanglish PDF...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(getTanglishHTML(), { waitUntil: 'networkidle0' });
  
  const outputPath = path.join(__dirname, '../VELOCITY_RETAIL_DOCUMENTATION_TANGLISH.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 8pt; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm; color: #a8a29e;">
        <span>Velocity Retail — Tanglish Technical Reference & Viva Guide</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '16mm',
      bottom: '18mm',
      left: '16mm',
      right: '16mm'
    }
  });

  await browser.close();
  console.log('✅ Tanglish PDF Generated Successfully:', outputPath);
}

generatePDF().catch(console.error);
