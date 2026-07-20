document.addEventListener('DOMContentLoaded', () => {

  const natureGroup = document.getElementById('nature-group');
  const depthGroup = document.getElementById('depth-group');
  const sourceCountEl = document.getElementById('source-count');
  const queryInput = document.getElementById('query-input');
  const startBtn = document.getElementById('start-btn');
  const logList = document.getElementById('log-list');
  const signal = document.getElementById('signal');
  const signalLine = document.getElementById('signal-line');
  const micBtn = document.getElementById('mic-btn');
  const topicStorageKey = 'deep-research.topic';
  const historyStorageKey = 'deep-research.history';

  const resultsSectionEl = document.getElementById('research-results');
  const resultsTitleEl = document.getElementById('results-title');
  const resultsMetaEl = document.getElementById('results-meta');
  const resultsSummaryEl = document.getElementById('results-summary');
  const resultsResourcesListEl = document.getElementById('results-resources-list');
  const closeResultsBtn = document.getElementById('close-results-btn');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  let state = {
    natureCount: 50,   // base source count from selected "nature" card
    depthMult: 1       // multiplier from selected "depth" card
  };

  // ---------- Option card selection ----------
  function setupGroup(group, onSelect) {
    if (!group) return;
    group.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        group.querySelectorAll('.option-card').forEach(c => c.classList.remove('is-active'));
        card.classList.add('is-active');
        onSelect(card);
      });
    });
  }

  if (natureGroup) {
    setupGroup(natureGroup, (card) => {
      state.natureCount = parseInt(card.dataset.count, 10);
      updateSourceCount();
    });
  }

  if (depthGroup) {
    setupGroup(depthGroup, (card) => {
      state.depthMult = parseFloat(card.dataset.mult);
      updateSourceCount();
    });
  }

  function updateSourceCount() {
    const target = Math.round(state.natureCount * state.depthMult);
    animateCount(sourceCountEl, parseInt(sourceCountEl.textContent, 10) || 0, target, 400);
  }

  function animateCount(el, from, to, duration) {
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(from + (to - from) * eased);
      el.textContent = value;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------- Signature signal pulse ----------
  const POINTS = 60;
  const WIDTH = 600;
  const HEIGHT = 40;
  let phase = 0;
  let intensity = 0.08; // idle flatline amplitude
  let targetIntensity = 0.08;
  let rafId = null;

  function drawSignal() {
    if (!signalLine) return;
    let pts = '';
    for (let i = 0; i < POINTS; i++) {
      const x = (i / (POINTS - 1)) * WIDTH;
      const t = i / (POINTS - 1);
      const envelope = Math.sin(t * Math.PI); // taper at edges
      const y = HEIGHT / 2 + Math.sin(t * 14 + phase) * intensity * 16 * envelope;
      pts += `${x.toFixed(1)},${y.toFixed(1)} `;
    }
    signalLine.setAttribute('points', pts.trim());

    // ease intensity toward target
    intensity += (targetIntensity - intensity) * 0.08;
    phase += 0.18;

    rafId = requestAnimationFrame(drawSignal);
  }
  if (signalLine) {
    drawSignal();
  }

  function activateSignal(active) {
    if (signal) {
      signal.classList.toggle('active', active);
    }
    targetIntensity = active ? 1 : 0.08;
  }

  if (queryInput) {
    queryInput.addEventListener('focus', () => activateSignal(true));
    queryInput.addEventListener('blur', () => {
      if (!queryInput.value.trim()) activateSignal(false);
    });
    queryInput.addEventListener('input', () => {
      activateSignal(document.activeElement === queryInput);
    });
  }

  // ---------- Mic button (voice recognition dictation) ----------
  if (micBtn && queryInput) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      let isListening = false;

      recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
        queryInput.placeholder = 'Listening... Speak now.';
        queryInput.focus();
      };

      recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('listening');
        queryInput.placeholder = 'What do you want to research?';
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (queryInput.value.trim() === '') {
          queryInput.value = transcript;
        } else {
          queryInput.value += ' ' + transcript;
        }
        queryInput.dispatchEvent(new Event('input'));
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        micBtn.classList.remove('listening');
        queryInput.placeholder = 'What do you want to research?';
      };

      micBtn.addEventListener('click', () => {
        if (isListening) {
          recognition.stop();
        } else {
          recognition.start();
        }
      });
    } else {
      micBtn.addEventListener('click', () => {
        queryInput.focus();
        alert('Speech recognition is not supported in this browser. Please type your query.');
      });
    }
  }

  // ---------- Suggestions generation (at least 10 items) ----------
  function generateTenSuggestions(topic) {
    const lower = topic.toLowerCase();
    const list = [];

    if (/(ai|llm|machine learning|model|transformer|deep learning)/.test(lower)) {
      list.push(
        "Foundation models & architectural details",
        "Training datasets, pre-training corpus & processing",
        "Fine-tuning techniques (LoRA, QLoRA, full parameter)",
        "Inference performance, latency & optimization (Quantization)",
        "Evaluation benchmarks & metric comparison (MMLU, HumanEval)",
        "Alignment techniques (RLHF, RLAIF, DPO)",
        "Safety, hallucination mitigation & jailbreak vectors",
        "Retrieval-Augmented Generation (RAG) & vector databases",
        "Agentic workflows & tool-use integration",
        "Deployment strategies, cost-per-token & hardware requirements"
      );
    } else if (/(market|business|product|strategy|startup|competitor|finance)/.test(lower)) {
      list.push(
        "Market sizing, TAM, SAM & growth projections",
        "Competitor landscape & key feature matrices",
        "Customer demographics & primary persona pain points",
        "Go-to-market (GTM) strategy & channel breakdown",
        "Pricing models, monetization & unit economics",
        "Investment trends, funding rounds & notable VCs in space",
        "Regulatory compliance, barriers to entry & risks",
        "Adoption rates, churn factors & user retention",
        "Technological feasibility & product development roadmap",
        "Partnership opportunities & ecosystem analysis"
      );
    } else if (/(security|vulnerability|cve|risk|attack|threat|network|malware)/.test(lower)) {
      list.push(
        "Threat model & potential attack surfaces",
        "CVE details, vulnerability history & CVSS scores",
        "Exploitation vectors & proof-of-concepts (PoC)",
        "Mitigation guidance, hotfixes & security patches",
        "Hardening best practices & configuration benchmarks",
        "Incident response plans & detection rules (YARA, Sigma)",
        "Impact on business continuity & data privacy",
        "Access control, IAM & privilege escalation risks",
        "Network architecture security & firewall policies",
        "Compliance requirements (GDPR, SOC2, ISO27001)"
      );
    } else if (/(research|study|paper|literature|evidence|academic|science)/.test(lower)) {
      list.push(
        "Historical context & foundational papers",
        "State-of-the-art methodology comparison",
        "Key empirical findings & statistics",
        "Scientific consensus vs. opposing viewpoints",
        "Gaps in current literature & research limitations",
        "Future research directions & emerging theories",
        "Impact on industry & practical applications",
        "Funding sources & academic institutions involved",
        "Data availability, reproducibility & code repositories",
        "Citation analysis & key contributing authors"
      );
    } else if (/(how to|tutorial|implementation|build|integrate|api|code|software|web|development)/.test(lower)) {
      list.push(
        "Architecture design & system component overview",
        "Step-by-step installation & setup instructions",
        "API endpoints, request/response formats & authentication",
        "Code examples & boilerplate implementations",
        "Database schema design & migrations",
        "Error handling, logging & monitoring setup",
        "Scale & performance optimization benchmarks",
        "Testing strategies (Unit, Integration, E2E)",
        "CI/CD pipelines & deployment configurations",
        "Maintenance, documentation & dependency updates"
      );
    } else {
      list.push(
        "Foundational concepts, definitions & history",
        "Key trends & recent developments (past 12 months)",
        "Principal stakeholders, key organizations & influencers",
        "Core debates, controversies & varying perspectives",
        "Technological impact & digital transformations in space",
        "Economic factors, cost structures & market drivers",
        "Legal, regulatory & compliance environments",
        "Best practices, standards & frameworks",
        "Case studies & practical real-world examples",
        "Future outlook, growth projections & predictions"
      );
    }
    return list;
  }

  const mainSuggestionsEl = document.getElementById('main-suggestions');
  const checklistEl = document.getElementById('suggestion-checklist');
  let suggestionsShown = false;

  function renderSuggestionsOnMain(suggestions) {
    if (!checklistEl) return;
    checklistEl.innerHTML = suggestions.map((value, index) => {
      const id = `main-req-${index}`;
      return `
        <label class="checkbox-item is-active" for="${id}">
          <input type="checkbox" id="${id}" value="${value}" checked>
          <span class="checkbox-label-text">${value}</span>
        </label>
      `;
    }).join('');

    // Add toggle background handlers
    checklistEl.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const label = e.target.closest('.checkbox-item');
        if (e.target.checked) {
          label.classList.add('is-active');
        } else {
          label.classList.remove('is-active');
        }
      });
    });
  }

  // Handle input changes (clearing resets, typing updates suggestions if shown)
  if (queryInput) {
    queryInput.addEventListener('input', () => {
      const queryText = queryInput.value.trim();
      if (queryText === '') {
        if (mainSuggestionsEl) mainSuggestionsEl.style.display = 'none';
        suggestionsShown = false;
        if (startBtn) startBtn.innerHTML = 'Next <span class="arrow">&rarr;</span>';
      } else if (suggestionsShown) {
        const suggestions = generateTenSuggestions(queryText);
        renderSuggestionsOnMain(suggestions);
      }
    });
  }

  // ---------- Begin research → session log ----------
  if (startBtn && queryInput && logList && sourceCountEl && mainSuggestionsEl) {
    startBtn.addEventListener('click', () => {
      const queryText = queryInput.value.trim();
      if (!queryText) {
        queryInput.focus();
        queryInput.classList.add('shake');
        setTimeout(() => queryInput.classList.remove('shake'), 300);
        return;
      }

      if (!suggestionsShown) {
        const suggestions = generateTenSuggestions(queryText);
        renderSuggestionsOnMain(suggestions);
        mainSuggestionsEl.style.display = 'block';
        suggestionsShown = true;
        startBtn.innerHTML = 'Start research <span class="arrow">&rarr;</span>';
      } else {
        const checkedBoxes = checklistEl.querySelectorAll('input[type="checkbox"]:checked');
        if (checkedBoxes.length === 0) {
          alert('Please select at least one research focus requirement.');
          return;
        }

        const selectedReqs = Array.from(checkedBoxes).map(cb => cb.value);

        // Save customized plan
        const plan = {
          title: queryText,
          summary: `Research run on "${queryText}" focused on custom requirements.`,
          angles: selectedReqs,
          keywords: [],
          questions: [],
          sources: ['academic', 'docs', 'news', 'community'],
          prompt: `Research topic: ${queryText}\n\nSelected Focus Requirements:\n${selectedReqs.map(r => `- ${r}`).join('\n')}\n\nPlease analyze and write a deep research report.`
        };

        localStorage.setItem(topicStorageKey, queryText);
        localStorage.setItem('deep-research.plan', JSON.stringify(plan));

        // Add to log list
        const emptyMsg = logList.querySelector('.log-empty');
        if (emptyMsg) emptyMsg.remove();

        const item = document.createElement('li');
        item.className = 'log-item';

        const title = document.createElement('span');
        title.className = 'log-item-title';
        title.textContent = queryText;

        const meta = document.createElement('span');
        meta.className = 'log-item-meta';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        meta.textContent = `${time} · ${sourceCountEl.textContent} sources`;

        item.appendChild(title);
        item.appendChild(meta);
        logList.prepend(item);

        // Save to persistent search history
        saveToSearchHistory(queryText, sourceCountEl.textContent);
        addLogItemClickHandlers();

        // Research loading indicator
        startBtn.textContent = 'Scraping & analyzing…';
        startBtn.disabled = true;

        setTimeout(() => {
          mainSuggestionsEl.style.display = 'none';
          queryInput.value = '';
          startBtn.innerHTML = 'Next <span class="arrow">&rarr;</span>';
          startBtn.disabled = false;
          suggestionsShown = false;
          
          // Display the custom scraped summary results
          displayResearchResults(queryText, selectedReqs);
        }, 1500);
      }
    });
  }

  // ---------- Persistent search history handlers ----------
  function saveToSearchHistory(queryText, sourceCountText) {
    try {
      const history = JSON.parse(localStorage.getItem(historyStorageKey) || '[]');
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const newQuery = {
        text: queryText,
        time: time,
        sources: sourceCountText
      };
      
      history.unshift(newQuery);
      const limitedHistory = history.slice(0, 20);
      localStorage.setItem(historyStorageKey, JSON.stringify(limitedHistory));
    } catch (e) {
      console.error('Failed to save search history:', e);
    }
  }

  function loadSearchHistory() {
    if (!logList) return;
    try {
      const history = JSON.parse(localStorage.getItem(historyStorageKey) || '[]');
      if (history.length > 0) {
        const emptyMsg = logList.querySelector('.log-empty');
        if (emptyMsg) emptyMsg.remove();
        
        history.forEach(query => {
          const item = document.createElement('li');
          item.className = 'log-item';

          const title = document.createElement('span');
          title.className = 'log-item-title';
          title.textContent = query.text;

          const meta = document.createElement('span');
          meta.className = 'log-item-meta';
          meta.textContent = `${query.time} · ${query.sources} sources`;

          item.appendChild(title);
          item.appendChild(meta);
          logList.appendChild(item);
        });
        
        addLogItemClickHandlers();
      }
    } catch (e) {
      console.error('Failed to load search history:', e);
    }
  }

  function addLogItemClickHandlers() {
    if (!logList || !queryInput) return;
    logList.querySelectorAll('.log-item').forEach(item => {
      if (item.dataset.hasHandler) return;
      item.dataset.hasHandler = 'true';
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        // Exit reader mode if a search history item is clicked, returning view to search mode
        toggleConsoleReaderMode(false);
        
        const titleText = item.querySelector('.log-item-title').textContent;
        queryInput.value = titleText;
        queryInput.dispatchEvent(new Event('input'));
        queryInput.focus();
      });
    });
  }

  // ---------- Custom structured research reports & scraping simulation ----------
  function toggleConsoleReaderMode(isReaderMode) {
    const consoleEl = document.querySelector('.console');
    const consoleHead = document.querySelector('.console-head');
    const queryPanel = document.querySelector('.query-panel');
    const readout = document.querySelector('.readout');
    
    if (isReaderMode) {
      if (consoleHead) consoleHead.style.display = 'none';
      if (queryPanel) queryPanel.style.display = 'none';
      if (readout) readout.style.display = 'none';
      if (consoleEl) consoleEl.classList.add('reader-active');
      if (resultsSectionEl) {
        resultsSectionEl.style.display = 'block';
        resultsSectionEl.style.marginTop = '0';
      }
    } else {
      if (consoleHead) consoleHead.style.display = 'block';
      if (queryPanel) queryPanel.style.display = 'block';
      if (readout) readout.style.display = 'flex';
      if (consoleEl) consoleEl.classList.remove('reader-active');
      if (resultsSectionEl) {
        resultsSectionEl.style.display = 'none';
        resultsSectionEl.style.marginTop = '40px';
      }
    }
  }

  if (closeResultsBtn) {
    closeResultsBtn.addEventListener('click', () => {
      toggleConsoleReaderMode(false);
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      localStorage.removeItem(historyStorageKey);
      toggleConsoleReaderMode(false);
      if (logList) {
        logList.innerHTML = '<li class="log-empty">No queries yet. Your first run will land here.</li>';
      }
    });
  }

  function generateMockReport(query, selectedReqs) {
    const lower = query.toLowerCase();
    
    // 1. Generate unique resources (citations) based on query topic
    const resources = [];
    if (/(ai|llm|machine learning|model|transformer|deep learning)/.test(lower)) {
      resources.push(
        { title: "Attention Is All You Need (Vaswani et al.)", url: "https://arxiv.org/abs/1706.03762", snippet: "Foundational architecture of modern Transformers, showcasing multi-head self-attention mechanisms." },
        { title: "Direct Preference Optimization: Your Language Model is Secretly a Reward Model", url: "https://arxiv.org/abs/2305.18290", snippet: "Introduction of DPO for model alignment, bypassing reinforcement learning complexity." },
        { title: "LoRA: Low-Rank Adaptation of Large Language Models", url: "https://arxiv.org/abs/2106.09685", snippet: "Parameters adaptation method that reduces trainable weights by 10,000x." },
        { title: "Hugging Face Model Hub - Fine-tuning Collections", url: "https://huggingface.co/models", snippet: "Open-source repositories hosting active fine-tuned checkpoints and evaluation leaderboards." }
      );
    } else if (/(market|business|product|strategy|startup|competitor|finance)/.test(lower)) {
      resources.push(
        { title: "Gartner Hype Cycle for Emerging Technologies", url: "https://www.gartner.com/en/information-technology", snippet: "Market analysis and adoption lifecycle reports for upcoming software categories." },
        { title: "Harvard Business Review: Customer Acquisition Cost Strategies", url: "https://hbr.org", snippet: "Frameworks for GTM optimization, GTM alignment, and monetization architectures." },
        { title: "Crunchbase Venture Capital Capital Flow Report", url: "https://www.crunchbase.com", snippet: "Funding database detailing active investment rounds and seed valuations." },
        { title: "Statista Global Tech Market Growth Insights", url: "https://www.statista.com", snippet: "Data projections for TAM, SAM, and year-over-year revenue growths in technology." }
      );
    } else if (/(security|vulnerability|cve|risk|attack|threat|network|malware)/.test(lower)) {
      resources.push(
        { title: "MITRE CVE Reference Database", url: "https://cve.mitre.org", snippet: "Vulnerability dictionary and common security cataloging repository." },
        { title: "OWASP Top 10 Web Application Risks Guidance", url: "https://owasp.org", snippet: "Consensus documentation detailing the most critical web app vulnerability vectors." },
        { title: "CISA Known Exploited Vulnerabilities Catalog", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", snippet: "Federal register of vulnerabilities verified to be actively exploited in the wild." },
        { title: "NVD - National Vulnerability Database Analysis", url: "https://nvd.nist.gov", snippet: "Enhanced CVSS score logs and code patch reference links." }
      );
    } else if (/(research|study|paper|literature|evidence|academic|science)/.test(lower)) {
      resources.push(
        { title: "Semantic Scholar Open Research Corpus", url: "https://www.semanticscholar.org", snippet: "AI-driven scientific literature search engine with citation graphs." },
        { title: "PubMed Central Library", url: "https://www.ncbi.nlm.nih.gov/pmc/", snippet: "Free full-text archive of biomedical and life sciences journal literature." },
        { title: "Google Scholar Citation Index", url: "https://scholar.google.com", snippet: "Global citation search index for academic papers, patents, and books." }
      );
    } else {
      resources.push(
        { title: "Wikipedia: Deep Empirical Analysis Sources", url: "https://en.wikipedia.org", snippet: "Historical timeline logs, definitions, and consensus references." },
        { title: "W3Schools Web Developer Docs & Standards", url: "https://www.w3.org", snippet: "Official standards documentation and best practice guidelines." },
        { title: "Stack Overflow Developer Ecosystem Survey", url: "https://stackoverflow.com", snippet: "Aggregated global statistics on tech stack popularity and design issues." }
      );
    }

    // 2. Generate a consolidated single-document report HTML
    let summaryHtml = `
      <div class="result-card" style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 24px; color: var(--text);">
        <!-- Document Title & Header -->
        <div style="border-bottom: 1px solid var(--border-soft); padding-bottom: 12px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 6px; font-size: 18px; color: var(--accent); font-weight: 600;">📑 Integrated Research Report</h3>
          <p style="margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5;">
            This single-document synthesis compiles findings from <strong>50 web-scraped sources</strong>, analyzing 
            the custom requirements specified for the topic: <strong>"${query}"</strong>.
          </p>
        </div>

        <!-- Section 1: Executive Summary -->
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: var(--text); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">1. Executive Summary</h4>
          <p style="margin: 0; font-size: 13.5px; line-height: 1.6; color: var(--text-muted);">
            Scraping crawlers completed a literature sweep. The custom analysis shows that prioritizing the selected focus requirements 
            stabilizes deployment velocity, reduces critical errors, and optimizes performance metrics. Across all reviewed papers,
            empirical models corroborate a performance improvement of up to <strong>24%</strong> when these conditions are met.
          </p>
        </div>

        <!-- Section 2: Detailed Focus Analysis -->
        <div style="margin-bottom: 24px;">
          <h4 style="margin: 0 0 10px; font-size: 14px; color: var(--text); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">2. Detailed Requirement Breakdown</h4>
          <div style="display: flex; flex-direction: column; gap: 16px;">
    `;

    selectedReqs.forEach((req, idx) => {
      const citationIdx = (idx % resources.length) + 1;
      const citation = resources[citationIdx - 1];
      summaryHtml += `
            <div style="border-left: 3px solid var(--accent); padding-left: 14px;">
              <h5 style="margin: 0 0 4px; font-size: 14px; color: var(--text); font-weight: 600;">Requirement ${idx + 1}: ${req}</h5>
              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-muted);">
                Our web scrape reveals that focusing on <em>"${req}"</em> directly resolves system bottlenecks. 
                Related developer surveys and research papers indicate a <strong>1.5x efficiency increase</strong>, 
                referenced heavily in standard documentation 
                <a href="${citation.url}" target="_blank" style="color: var(--cyan); text-decoration: none; font-weight: 600;">[${citationIdx}]</a>.
              </p>
            </div>
      `;
    });

    summaryHtml += `
          </div>
        </div>

        <!-- Section 3: Actionable Advice & Recommendations -->
        <div style="border-top: 1px solid var(--border-soft); padding-top: 18px; margin-top: 20px;">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: var(--text); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">3. Action Plan & Next Steps</h4>
          <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; color: var(--text-muted); font-size: 13px; line-height: 1.5;">
            <li>Audit current system specifications to match verified criteria listed in Section 2.</li>
            <li>Incorporate the citation sources linked below to resolve edge-case errors.</li>
            <li>Run benchmarks on local models to verify performance baseline alignment.</li>
          </ul>
        </div>
      </div>
    `;

    return {
      title: query,
      summaryHtml: summaryHtml,
      resources: resources
    };
  }

  function displayResearchResults(query, selectedReqs) {
    if (!resultsSectionEl || !resultsTitleEl || !resultsMetaEl || !resultsSummaryEl || !resultsResourcesListEl) return;
    
    const report = generateMockReport(query, selectedReqs);
    resultsTitleEl.textContent = report.title;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    resultsMetaEl.textContent = `${dateStr} at ${timeStr} · 50 Web-scraped & Analyzed Sources`;
    
    resultsSummaryEl.innerHTML = report.summaryHtml;
    
    resultsResourcesListEl.innerHTML = report.resources.map((res, idx) => {
      return `
        <li style="background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px;">
            <a href="${res.url}" target="_blank" style="color: var(--cyan); text-decoration: none; font-weight: 600; font-size: 13.5px; display: inline-flex; align-items: center; gap: 4px;">
              [${idx + 1}] ${res.title}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
              </svg>
            </a>
            <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-faint); text-transform: uppercase;">Scraped Source</span>
          </div>
          <p style="margin: 0; font-size: 12px; color: var(--text-muted); line-height: 1.5;">${res.snippet}</p>
        </li>
      `;
    }).join('');
    
    toggleConsoleReaderMode(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // initialize source count and load history on load
  if (sourceCountEl) {
    sourceCountEl.textContent = Math.round(state.natureCount * state.depthMult);
  }
  loadSearchHistory();
});
