# Catalyzers (Shop With Confidence)

**Catalyzers** (formerly known as FitGenius) is an advanced, AI-powered Chrome Extension designed to eliminate the guesswork from online clothing shopping. Developed for the Amazon Sustainability Hackathon, it seamlessly injects an intelligent sizing assistant directly into Amazon product pages.

By leveraging a Dual-Tier Recommendation Engine, Catalyzers combines instantaneous mathematical baseline matching with high-accuracy Gemini 2.5 AI heuristics (analyzing material stretch, user body geometry, and thousands of real reviews) to deliver absolute confidence in online purchasing, reducing returns and increasing sustainability.

## ✨ Features

- **Dual-Tier Sizing Architecture:** 
  - *Tier 1:* Instant mathematical sizing recommendations based on user profiles (<0.1s latency).
  - *Tier 2:* Asynchronous background AI-verification via Google Gemini 2.5 Flash, dynamically injecting complex fit logic (fabric stretch, cut, target drape).
- **Amazon-Native UI Design:** Flawlessly styled to match the dark `#000000`, `#232F3E` (Blue), and `#FF9900` (Orange) Amazon corporate aesthetic to look like an official integration.
- **Deep Sentiment Analysis:** Uses AI to read and aggregate sizing complaints and compliments from product reviews.
- **Wardrobe Calibration:** Users can input reference items they already own to establish a personalized "True Size" baseline.
- **Strict Content Validation:** Employs precise Regex boundary checks to only activate on valid clothing listings, preventing hallucinated popup interruptions on non-apparel items.

## 🚀 Installation & Setup

### Prerequisites
- Google Chrome or Chromium-based browser
- Google Gemini API Key

### Deployment Steps
1. Clone this repository directly to your machine.
   \`\`\`bash
   git clone https://github.com/your-username/Catalyzers.git
   cd Catalyzers
   \`\`\`
2. Grab your Gemini API key from [Google AI Studio](https://aistudio.google.com/).
3. Open Google Chrome and navigate to \`chrome://extensions/\`.
4. Toggle on **Developer mode** in the top right corner.
5. Click **Load unpacked** and select the \`Catalyzers\` (or \`fitgenius\`) directory.

## 🔑 Configuration (.env)

API keys are designed to be ingested via the user interface. However, for seamless local development without manually injecting keys during runtime:
1. Copy the \`.env.template\` file to a \`.env\` or inject directly into \`engine/gemini.js\` for strictly local/offline compilation.
2. The deployed extension automatically requests user injection if the key is missing.

## 🛠️ Tech Stack & Architecture

- **Vanilla JavaScript:** Zero-dependency implementation for ultra-low memory footprint.
- **Chrome Extensions API V3:** Leverages Service Workers for background AI requests.
- **Google Gemini 2.5 Flash:** High-performance generative model routing for semantic reasoning.
- **CSS / Shadow DOM:** Uses encapsulated Shadow DOM for the page widget to prevent Amazon's core styles from interfering with the widget. 

## ⚖️ Hackathon Implementation Notes

This application was architected to target **Return Rate Reduction**. The environmental and logistical impact of returns via "bracketing" (buying multiple sizes to return the ones that don't fit) is devastating for shipping emissions. Catalyzers aims to solve this by providing absolute consumer confidence precisely at the point of purchase.
