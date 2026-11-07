# 🎬 Utah Fit — 2-Minute Demo Script

This script walks judges through a complete 2-minute demonstration of **Utah Fit**, highlighting the live multi-factor scoring engine, real-time map integration, and authentic public data citations.

---

### **0:00 – 0:20 | Introduction & The Problem**
* **Action**: Open [http://localhost:5173](http://localhost:5173) displaying the landing view and the interactive Leaflet map of Utah.
* **Speaker**:
  > *"When people consider moving to Utah, they quickly discover that Utah isn't one monolithic place. Living in Park City is radically different from Lehi, Moab, or Logan. But today, people are stuck juggling 20 tabs of Zillow, Wikipedia, Ski Utah, and municipal PDFs to figure out where they belong.*
  > 
  > *We built **Utah Fit** — an interactive platform that scores and ranks 42 fixed Utah towns against verified, cited public data based on each user's unique priorities."*

---

### **0:20 – 0:50 | Persona 1: The Powder Chaser (Skier)**
* **Action**: Click the **"Skier / Outdoor Enthusiast"** persona preset button (or drag the **Ski Resort Access** and **Trails** sliders to maximum weight).
* **Visual**: Watch the map and ranked cards update reactively.
* **Speaker**:
  > *"First, let's look at someone moving here for world-class skiing and outdoor access. We click the **Skier** persona.*
  > 
  > *Immediately, the reactive scoring engine re-normalizes every metric. **Park City** and **Cottonwood Heights** surge to the top of the leaderboard.*
  > 
  > *Notice the dynamic highlight tag: 'Top 3 for ski access'. Clicking into Cottonwood Heights reveals why: an 18-minute drive to Alta and Snowbird, 340 hiking trails within 20 kilometers, and dedicated ski bus connectivity via UTA Route 972."*

---

### **0:50 – 1:20 | Persona 2: The Young Family**
* **Action**: Switch preset to **"Young Family"** (or increase weights on **Safety / Crime Rate**, **Parks**, and adjust the **Max Home Value** filter).
* **Visual**: Show the towns re-sorting; high-cost mountain towns drop; family-friendly communities like **Pleasant Grove**, **Kaysville**, and **Saratoga Springs** rise.
* **Speaker**:
  > *"Now let's switch to a young family prioritizing safety, neighborhood parks, and housing affordability.*
  > 
  > *Notice how the top recommendations shift instantly to places like Kaysville, Pleasant Grove, and South Jordan. If the family sets a strict housing budget filter, the rankings automatically respect their cap while highlighting local park proximity and school access.*
  > 
  > *Every single score has complete explainability — no black boxes."*

---

### **1:20 – 1:45 | Persona 3: The Remote Tech Worker**
* **Action**: Switch preset to **"Remote Tech Worker"** (weights balanced across transit departures, dining/culture, and high-speed infrastructure along Silicon Slopes).
* **Visual**: **Lehi**, **Draper**, and **Salt Lake City Downtown** rise to the top. Show the interactive town detail card comparing the town's metrics against the Utah state median.
* **Speaker**:
  > *"For a remote tech worker wanting fast access to Silicon Slopes tech hubs and downtown amenities, selecting the **Remote Worker** persona elevates Lehi, Draper, and Salt Lake City.*
  > 
  > *In the town detail drawer, every metric is benchmarked directly against the Utah state median, complete with a direct outbound link to the official public source."*

---

### **1:45 – 2:00 | Conclusion & Architecture**
* **Speaker**:
  > *"Under the hood, Utah Fit runs on a clean full-stack TypeScript architecture: Vite, React, and Tailwind on the frontend, with a real-time reactive Convex backend and pure multi-factor ranking algorithms.*
  > 
  > *Every data point comes from authoritative public sources: Ski Utah, the National Park Service, OpenStreetMap Overpass, the EPA, and the Utah Transit Authority.*
  > 
  > *Utah Fit makes moving to Utah transparent, personalized, and effortless."*
