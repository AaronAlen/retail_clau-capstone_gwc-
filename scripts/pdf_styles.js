const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Reusable styling for high-end professional documentation
const getBaseCSS = () => `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4;
    margin: 18mm 16mm 20mm 16mm;
    @bottom-right {
      content: counter(page);
    }
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1c1917;
    background-color: #ffffff;
    line-height: 1.65;
    font-size: 10.5pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Cover Page */
  .cover-page {
    page-break-after: always;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 30mm 15mm 20mm 15mm;
    border: 1px solid #e7e5e4;
    border-radius: 16px;
    background: linear-gradient(145deg, #ffffff 0%, #faf8f5 60%, #fff7ed 100%);
    position: relative;
    overflow: hidden;
  }

  .cover-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #ea580c;
    color: #ffffff;
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 6px 14px;
    border-radius: 9999px;
    margin-bottom: 24px;
    width: fit-content;
  }

  .cover-title {
    font-size: 32pt;
    font-weight: 800;
    color: #0c0a09;
    line-height: 1.15;
    letter-spacing: -0.5px;
    margin-bottom: 12px;
  }

  .cover-subtitle {
    font-size: 14pt;
    font-weight: 500;
    color: #78716c;
    line-height: 1.4;
    margin-bottom: 30px;
    max-width: 600px;
  }

  .cover-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 40px;
  }

  .cover-tag {
    background: #f5f5f4;
    border: 1px solid #e7e5e4;
    color: #44403c;
    font-size: 8.5pt;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 6px;
  }

  .cover-meta {
    border-top: 2px solid #ea580c;
    padding-top: 20px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    font-size: 9.5pt;
  }

  .cover-meta-item strong {
    display: block;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #a8a29e;
    margin-bottom: 2px;
  }

  .cover-meta-item span {
    font-weight: 700;
    color: #1c1917;
  }

  /* Headings */
  h1 {
    font-size: 20pt;
    font-weight: 800;
    color: #0c0a09;
    letter-spacing: -0.3px;
    border-bottom: 2px solid #fed7aa;
    padding-bottom: 8px;
    margin-top: 36px;
    margin-bottom: 16px;
    page-break-after: avoid;
  }

  .page-break {
    page-break-before: always;
  }

  h2 {
    font-size: 14pt;
    font-weight: 700;
    color: #ea580c;
    margin-top: 24px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }

  h3 {
    font-size: 11.5pt;
    font-weight: 700;
    color: #292524;
    margin-top: 18px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }

  p {
    margin-bottom: 12px;
    color: #292524;
    text-align: justify;
  }

  ul, ol {
    margin-left: 20px;
    margin-bottom: 14px;
  }

  li {
    margin-bottom: 6px;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 9pt;
    page-break-inside: avoid;
  }

  th, td {
    border: 1px solid #e7e5e4;
    padding: 8px 12px;
    text-align: left;
  }

  th {
    background-color: #f5f5f4;
    color: #1c1917;
    font-weight: 700;
  }

  tr:nth-child(even) {
    background-color: #fafaf9;
  }

  /* Callout Boxes */
  .callout {
    border-left: 4px solid #ea580c;
    background: #fff7ed;
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    margin: 16px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }

  .callout.info {
    border-left-color: #0284c7;
    background: #f0f9ff;
  }

  .callout.success {
    border-left-color: #16a34a;
    background: #f0fdf4;
  }

  .callout.warning {
    border-left-color: #eab308;
    background: #fefce8;
  }

  .callout-title {
    font-weight: 700;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Code Blocks */
  code {
    font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
    font-size: 8.5pt;
    background: #f5f5f4;
    padding: 2px 5px;
    border-radius: 4px;
    color: #c2410c;
  }

  pre {
    font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
    font-size: 8pt;
    background: #1c1917;
    color: #f5f5f4;
    padding: 14px;
    border-radius: 8px;
    margin: 14px 0;
    overflow-x: hidden;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.5;
    page-break-inside: avoid;
  }

  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }

  /* Diagram Box */
  .diagram-box {
    background: #fafaf9;
    border: 1px dashed #d6d3d1;
    border-radius: 8px;
    padding: 14px;
    margin: 16px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8pt;
    line-height: 1.4;
    color: #44403c;
    page-break-inside: avoid;
    white-space: pre;
    overflow-x: hidden;
  }

  /* Footer */
  .doc-footer {
    margin-top: 30px;
    padding-top: 12px;
    border-top: 1px solid #e7e5e4;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #a8a29e;
  }
`;

module.exports = { getBaseCSS, CHROME_PATH };
