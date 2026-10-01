const puppeteer = require('puppeteer-core');
const path = require('path');
const { getBaseCSS, CHROME_PATH } = require('./pdf_styles');

const getEnglishHTML = () => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Velocity Retail — Technical Architecture Documentation</title>
  <style>
    ${getBaseCSS()}
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover-page">
    <div>
      <div class="cover-badge">Capstone Engineering Project</div>
      <div class="cover-title">VELOCITY RETAIL</div>
      <div class="cover-subtitle">Autonomous AI-Driven Merchandising Engine & 3D Interactive Digital Twin Showroom</div>
      
      <div class="cover-tags">
        <span class="cover-tag">AWS ECS Fargate</span>
        <span class="cover-tag">AWS ALB</span>
        <span class="cover-tag">AWS CloudFront (SSL)</span>
        <span class="cover-tag">Three.js WebGL</span>
        <span class="cover-tag">React 18 + TypeScript</span>
        <span class="cover-tag">Node.js + Express</span>
        <span class="cover-tag">MongoDB Atlas</span>
        <span class="cover-tag">Groq Llama 3 (70B)</span>
        <span class="cover-tag">Socket.IO</span>
      </div>
    </div>

    <div class="cover-meta">
      <div class="cover-meta-item">
        <strong>Author & Developer</strong>
        <span>Aaron Alen</span>
      </div>
      <div class="cover-meta-item">
        <strong>Project Type</strong>
        <span>Full-Stack Cloud & 3D WebGL Capstone</span>
      </div>
      <div class="cover-meta-item">
        <strong>Production Status</strong>
        <span>Live on AWS ECS + CloudFront CDN + Vercel</span>
      </div>
      <div class="cover-meta-item">
        <strong>Date & Version</strong>
        <span>October 2026 | Version 2.4.0</span>
      </div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="page-break"></div>
  <h1>Table of Contents</h1>
  <ol style="line-height: 2; font-size: 10.5pt; margin-top: 20px;">
    <li><strong>Executive Summary & Problem Statement</strong> ..................................................................... 3</li>
    <li><strong>High-Level System Architecture & Cloud Infrastructure</strong> ................................................ 4</li>
    <li><strong>3D Digital Twin Showroom (Three.js WebGL Engine)</strong> .................................................... 6</li>
    <li><strong>AI Recommendation Engine & Market Basket Analysis</strong> ............................................. 8</li>
    <li><strong>Incremental Multi-Item Stacking & Station Reset Engine</strong> ............................................. 10</li>
    <li><strong>Enterprise Dual-Layer Authentication & Mobile Resilience</strong> ......................................... 12</li>
    <li><strong>Database Design & MongoDB Atlas Schema Models</strong> ................................................. 14</li>
    <li><strong>Role-Based Access Control (RBAC) & Security Policies</strong> ................................................. 16</li>
    <li><strong>End-to-End AWS Production Deployment Runbook</strong> .................................................... 17</li>
    <li><strong>Technical Viva Defense & Architectural Q&A</strong> ............................................................ 19</li>
  </ol>

  <!-- CHAPTER 1 -->
  <div class="page-break"></div>
  <h1>1. Executive Summary & Problem Statement</h1>
  
  <h2>1.1 The Retail Dilemma: The Static Showroom Blindspot</h2>
  <p>
    In modern brick-and-mortar fashion retail (e.g., flagship boutiques such as Zara, H&M, or Ralph Lauren), visual merchandising decisions are predominantly manual, subjective, and reactive. Store associates change mannequin displays based on personal intuition or static corporate planogram PDFs that are updated only once every few weeks. 
  </p>
  <p>
    This traditional workflow introduces three major business vulnerabilities:
  </p>
  <ul>
    <li><strong>Delayed Sales Velocity Feedback:</strong> Fast-moving items sit tucked away inside low-visibility corner cupboards, while underperforming garments occupy premier focal podiums.</li>
    <li><strong>Lost Cross-Selling Opportunities:</strong> Complementary apparel (e.g., an Oxford shirt paired with tailored chinos and loafers) is rarely optimized based on real-time historical transaction synergy.</li>
    <li><strong>Zero Spatial Simulation:</strong> Store managers have no digital method to preview physical layout adjustments or test aesthetic coordination before manually hauling heavy mannequins and garments across the showroom floor.</li>
  </ul>

  <h2>1.2 The Velocity Retail Solution</h2>
  <p>
    <strong>Velocity Retail</strong> bridges physical retail operations and computational intelligence by deploying an <strong>Autonomous 3D Digital Twin Showroom</strong>.
  </p>
  <div class="callout success">
    <div class="callout-title">Core Innovation Highlights</div>
    Velocity Retail combines <strong>Three.js WebGL 3D spatial simulation</strong>, <strong>Market Basket Analysis (Apriori & FP-Growth algorithms)</strong>, and <strong>Groq Llama 3 LLM prompt engineering</strong>. When an AI bundle is approved, products seamlessly fly between cupboards and mannequins in real-time bilateral 3D physics animations, synchronously updating MongoDB Atlas and broadcasting live state across all store terminals via WebSockets.
  </div>

  <!-- CHAPTER 2 -->
  <div class="page-break"></div>
  <h1>2. High-Level System Architecture & AWS Infrastructure</h1>

  <h2>2.1 Production Topology Flowchart</h2>
  <div class="diagram-box">
[ User Browser / Mobile Device ]
              │
              ▼ (HTTPS / Port 443)
[ AWS CloudFront CDN Edge ] ────────► Global Edge Caching & Automated Amazon Wildcard SSL
              │
              ▼ (HTTP / Port 80)
[ AWS Application Load Balancer ] ──► Multi-AZ Traffic Distribution & Continuous Health Checks (/health)
              │
              ▼ (VPC awsvpc Network)
[ AWS ECS Fargate Container ] ──────► Dockerized Node.js Microservice (Port 5000)
              │
              ├──────► MongoDB Atlas (Encrypted Cloud Cluster)
              ├──────► Cloudinary CDN (High-Res 2K Texture Assets)
              └──────► Groq Cloud API (Llama 3 70B Merchandiser)
  </div>

  <h2>2.2 Why AWS CloudFront was Mandatory</h2>
  <p>
    A critical architectural decision was inserting <strong>AWS CloudFront</strong> in front of the Application Load Balancer:
  </p>
  <ol>
    <li><strong>Eliminating Mixed Content Security Blocks:</strong> The React frontend is deployed on Vercel under strict HTTPS (Port 443). By default, an ALB without an expensive custom domain certificate operates on HTTP (Port 80). Modern browsers automatically block HTTP API calls initiated from HTTPS pages. CloudFront terminates SSL at the edge using Amazon's free wildcard certificate (<code>https://*.cloudfront.net</code>).</li>
    <li><strong>Global Edge Performance:</strong> CloudFront routes requests to the nearest Point of Presence (e.g., Chennai <code>MAA51-P3</code> or Bangalore <code>BLR50-P4</code>), accelerating static delivery and minimizing round-trip latency.</li>
    <li><strong>Enterprise Cookie & Header Forwarding:</strong> The CloudFront cache behavior is configured to forward all cookies (<code>Cookies: all</code>) and whitelist <code>Authorization</code>, <code>Origin</code>, and <code>Content-Type</code> headers, ensuring zero dropped JWT sessions.</li>
  </ol>

  <!-- CHAPTER 3 -->
  <div class="page-break"></div>
  <h1>3. 3D Digital Twin Showroom (Three.js WebGL Engine)</h1>

  <h2>3.1 Spatial Coordinate Mapping</h2>
  <p>
    The virtual showroom is mapped in a 3D coordinate system where <code>[X: Lateral, Y: Vertical, Z: Depth]</code>:
  </p>
  <ul>
    <li><strong>8 Display Cupboards:</strong> Arranged geometrically along the perimeter walls, categorized into Shirts, T-Shirts, Jeans, Jackets, and Shoes.</li>
    <li><strong>2 Hero Mannequin Stations:</strong> Positioned in high-visibility focal zones at <code>[X: -4.5, Z: 0]</code> (Station 1) and <code>[X: +4.5, Z: 0]</code> (Station 2) on illuminated stone pedestals.</li>
  </ul>

  <h2>3.2 Bilateral 2-Way Flight Animations (Physics Mathematics)</h2>
  <p>
    Unlike conventional UI transitions that abruptly switch product textures, Velocity Retail calculates simultaneous <strong>2-way bilateral flight trajectories</strong>:
  </p>
  <div class="diagram-box">
  Item A (Shelf Cupboard) ──────── Quadratic Bezier Arc ────────► Mannequin Hero Station
  Item B (Displaced Item) ◄─────── Return Bezier Arc ─────────── Mannequin Hero Station
  </div>
  <p>
    Each flight trajectory follows a Quadratic Bezier equation parameterized over normalized time <code>t ∈ [0, 1]</code>:
  </p>
  <pre><code>P(t) = (1 - t)² · P_start + 2(1 - t)t · P_control + t² · P_end</code></pre>
  <p>
    Where <code>P_control.y = max(P_start.y, P_end.y) + 3.5</code>. This creates a realistic gravity-defying parabolic arc, ensuring clothing and shoe boxes soar gracefully over store fixtures without clipping through cupboards.
  </p>

  <h2>3.3 Elevated 3D Footwear Clearance Algorithm</h2>
  <div class="callout info">
    <div class="callout-title">The Pedestal Clipping Challenge</div>
    Standard mannequin slots align footwear at ground level (<code>y = 0</code>). However, because hero mannequins are positioned atop 0.5-unit stone pedestals, shoes initially rendered embedded inside the stone plinth.
  </div>
  <p>
    To resolve this, custom bounding-box vertical offsets were engineered in <code>Store3DVisualizer.tsx</code>:
  </p>
  <pre><code>const verticalOffset = isFootwear ? pedestalElevation + 0.12 : 0;
footwearMesh.position.set(targetSlot.x, targetSlot.y + verticalOffset, targetSlot.z);</code></pre>
  <p>
    This guarantees that sneakers and loafers rest crisply on top of the pedestal surface with ambient drop-shadows.
  </p>

  <!-- CHAPTER 4 -->
  <div class="page-break"></div>
  <h1>4. AI Recommendation Engine & Market Basket Analysis</h1>

  <h2>4.1 Mathematical Formulation of Association Rules</h2>
  <p>
    Velocity Retail mines thousands of POS sales transactions using Association Rule Mining to uncover product synergy:
  </p>
  <table>
    <thead>
      <tr>
        <th>Metric</th>
        <th>Mathematical Formula</th>
        <th>Business Significance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Support</strong></td>
        <td><code>freq(A ∪ B) / N</code></td>
        <td>Probability that both items appear together in a customer basket.</td>
      </tr>
      <tr>
        <td><strong>Confidence</strong></td>
        <td><code>freq(A ∪ B) / freq(A)</code></td>
        <td>Likelihood that a customer buying Item A will also purchase Item B.</td>
      </tr>
      <tr>
        <td><strong>Lift</strong></td>
        <td><code>Confidence(A → B) / Support(B)</code></td>
        <td>A Lift &gt; 1.0 indicates a true complementary synergy rather than random coincidence.</td>
      </tr>
    </tbody>
  </table>

  <h2>4.2 Groq Llama 3 (70B) AI Copilot</h2>
  <p>
    While association rules output statistical scores, the <strong>Groq Llama 3 Merchandiser</strong> translates numerical synergies into actionable commercial strategies:
  </p>
  <ul>
    <li>Evaluates category sales velocity (Units Sold / Day).</li>
    <li>Suggests cross-category outfit pairings (e.g., pairing slow-moving premium silk blazers with best-selling jeans).</li>
    <li>Provides natural-language merchandising rationale accessible via the real-time AI Copilot Drawer.</li>
  </ul>

  <!-- CHAPTER 5 -->
  <div class="page-break"></div>
  <h1>5. Incremental Multi-Item Stacking & Station Reset Engine</h1>

  <h2>5.1 The 1-by-1 Swap & Wildcard Flight Bug</h2>
  <p>
    During production testing, when a store manager swapped items 1-by-1 until 4 items were deployed on a mannequin, two critical issues surfaced:
  </p>
  <ol>
    <li><strong>Item Overwrite Bug:</strong> Adding Item 2 caused the backend to mark Item 1 as reverted, leaving only the 4th item in an active MongoDB record. Clicking "Reset Station" reverted only 1 product.</li>
    <li><strong>Wildcard Sky Flight:</strong> Clicking Reset again returned an empty array (<code>revertedProductIds: []</code>). The visualizer fell back to all store pairs, causing 20–30 product boxes across all cupboards to launch into the air.</li>
  </ol>

  <h2>5.2 The Architectural Fix</h2>
  <div class="callout success">
    <div class="callout-title">Atomic Multi-Item Stacking & Scoped Resets</div>
    <strong>1. Backend Stacking (<code>executeFloorSwap</code>):</strong> Instead of overwriting active records, the backend now merges incoming items with existing station items, preserving concurrent outfits across all roles (Jacket, Shirt, Pants, Shoes).<br>
    <strong>2. Empty Array Guard:</strong> The visualizer explicitly halts animation if <code>revertedProductIds.length === 0</code>.<br>
    <strong>3. Station Scoping:</strong> Fallbacks are strictly locked to the target station; under no circumstances can off-station cupboards be animated.
  </div>

  <!-- CHAPTER 6 -->
  <div class="page-break"></div>
  <h1>6. Enterprise Dual-Layer Authentication & Mobile Resilience</h1>

  <h2>6.1 The Mobile Browser Cookie Hurdle</h2>
  <p>
    In high-security enterprise environments, storing JWTs in <code>localStorage</code> risks XSS exploitation, while relying exclusively on <code>HttpOnly</code> cookies risks session drops in mobile browsers (e.g., Mobile Chrome Tracking Protection or Safari ITP). Furthermore, weak demo passwords (e.g., <code>admin123</code>) trigger Google Password Manager breach modals that freeze mobile viewports.
  </p>

  <h2>6.2 Dual-Layer Architecture</h2>
  <table>
    <thead>
      <tr>
        <th>Layer</th>
        <th>Mechanism</th>
        <th>Security / Resilience Benefit</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Primary Layer</strong></td>
        <td><code>HttpOnly, Secure, SameSite=None</code> Cookies</td>
        <td>OWASP compliance; impervious to JavaScript XSS scraping.</td>
      </tr>
      <tr>
        <td><strong>Fallback Layer</strong></td>
        <td><code>Authorization: Bearer &lt;token&gt;</code> in Axios Interceptor</td>
        <td>Guarantees 100% uninterrupted mobile app sessions even when cross-site cookies are blocked.</td>
      </tr>
      <tr>
        <td><strong>Credential Hardening</strong></td>
        <td>Enterprise Passwords (e.g., <code>Velocity@Admin2026!</code>)</td>
        <td>Completely eliminates Google Password Manager breach warnings.</td>
      </tr>
    </tbody>
  </table>

  <!-- CHAPTER 7 -->
  <div class="page-break"></div>
  <h1>7. Database Design & MongoDB Atlas Schema Models</h1>

  <p>The system is backed by six normalized, indexed Mongoose schemas:</p>
  <ul>
    <li><strong>User:</strong> <code>{ name, email, password (bcrypt hash), role: ['admin', 'manager', 'staff'] }</code>.</li>
    <li><strong>Product:</strong> <code>{ name, sku, category, price, stock, coordinates: { x, y, z }, imageUrl, isFeatured }</code>.</li>
    <li><strong>Sale:</strong> <code>{ transactionId, items: [{ product, quantity, unitPrice }], totalAmount, paymentMethod, cashier }</code>.</li>
    <li><strong>Planogram:</strong> <code>{ version, layoutName, activeFrom, zoneAssignments, status }</code>.</li>
    <li><strong>FloorSwap:</strong> <code>{ activePairId, stationIndex, executedItems: [{ productId, targetRole }], displacedItems: [{ productId, originalSlot }], status: ['active', 'reverted'] }</code>.</li>
    <li><strong>CategoryVelocity:</strong> <code>{ category, unitsSold7D, dailyVelocity, turnoverScore }</code>.</li>
  </ul>

  <!-- CHAPTER 8 -->
  <div class="page-break"></div>
  <h1>8. Role-Based Access Control (RBAC) & Security Policies</h1>

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
        <td>Deploy & Revert</td>
        <td>Create, Edit, Delete</td>
        <td>Create, Promote, Delete</td>
      </tr>
      <tr>
        <td><strong>👔 Manager</strong></td>
        <td>Full Access</td>
        <td>Deploy & Revert</td>
        <td>View & Stock Read</td>
        <td>Hidden / Blocked (403)</td>
      </tr>
      <tr>
        <td><strong>🛒 Cashier / Staff</strong></td>
        <td>View Only</td>
        <td>Read Only (No Deploy)</td>
        <td>View Catalog Only</td>
        <td>Hidden / Blocked (403)</td>
      </tr>
    </tbody>
  </table>

  <!-- CHAPTER 9 -->
  <div class="page-break"></div>
  <h1>9. End-to-End AWS Production Deployment Runbook</h1>

  <p>The entire backend runs on AWS ECS Fargate fronted by an Application Load Balancer and CloudFront CDN:</p>
  <pre><code># 1. Build and Push Docker Image
docker build -t aaronalen/velocity-retail-backend:latest ./backend
docker push aaronalen/velocity-retail-backend:latest

# 2. Register ECS Fargate Task Definition with Environment Variables
aws ecs register-task-definition --cli-input-json file://task-def.json --region ap-south-1

# 3. Create Target Group with /health Check
aws elbv2 create-target-group --name "velocity-retail-tg" --protocol HTTP --port 5000 \
  --vpc-id "vpc-039619cf26628c1dd" --target-type ip --health-check-path "/health" --region ap-south-1

# 4. Create Application Load Balancer across 3 Multi-AZ Subnets
aws elbv2 create-load-balancer --name "velocity-retail-alb" \
  --subnets subnet-011dd38b725d032a8 subnet-0f135b19916678ab9 subnet-0943f394c63efffa2 \
  --security-groups sg-0cb2b29a1dbfc6e87 --scheme internet-facing --region ap-south-1

# 5. Create CloudFront Distribution with HTTPS Redirect & Cookie Forwarding
aws cloudfront create-distribution --distribution-config file://cf-config.json

# 6. Configure Vercel Frontend Rewrites (/api/* -> https://d2r14mddgufil7.cloudfront.net/api/*)</code></pre>

  <!-- CHAPTER 10 -->
  <div class="page-break"></div>
  <h1>10. Technical Viva Defense & Architectural Q&A</h1>

  <h3>Q1: Why did you choose Three.js for a business analytics tool?</h3>
  <p>
    <strong>Answer:</strong> Traditional merchandising tools use 2D tables or static PDFs. Retail fashion is inherently visual and spatial. By constructing an interactive 3D digital twin, managers can intuitively observe spatial flow, visualize sales heatmaps directly on shelves, and preview physical mannequin swaps with accurate physics before deploying them on the shop floor.
  </p>

  <h3>Q2: How does the system handle concurrent users modifying the showroom?</h3>
  <p>
    <strong>Answer:</strong> Through Socket.IO event broadcasting. When any manager triggers a floor swap or reset, the backend commits the atomic MongoDB update and immediately emits a <code>FLOOR_SWAP_EXECUTED</code> event. All open client terminals animate the bilateral flight simultaneously, ensuring zero planogram desynchronization.
  </p>

  <h3>Q3: How do you prove that your backend is running on AWS rather than a PaaS?</h3>
  <p>
    <strong>Answer:</strong> By opening Chrome DevTools Network Tab: every API request connects directly to <code>:authority: d2r14mddgufil7.cloudfront.net</code>, featuring response headers <code>Via: 1.1 ... cloudfront.net</code> and <code>X-Amz-Cf-Pop: BLR50-P4</code>, which routes through our AWS Application Load Balancer to our AWS ECS Fargate tasks.
  </p>

  <div class="doc-footer">
    <span>Velocity Retail — Capstone Technical Documentation</span>
    <span>Author: Aaron Alen | October 2026</span>
  </div>

</body>
</html>
`;

async function generatePDF() {
  console.log('Launching headless Chrome for English PDF...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(getEnglishHTML(), { waitUntil: 'networkidle0' });
  
  const outputPath = path.join(__dirname, '../VELOCITY_RETAIL_DOCUMENTATION_EN.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 8pt; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm; color: #a8a29e;">
        <span>Velocity Retail — Production Engineering Reference</span>
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
  console.log('✅ English PDF Generated Successfully:', outputPath);
}

generatePDF().catch(console.error);
