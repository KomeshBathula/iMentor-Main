Deep Research - 
deep-research/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   ├── research/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── history/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── api/
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── ThemeToggle.tsx
│   │   │   │
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Dialog.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Progress.tsx
│   │   │   │   ├── Tabs.tsx
│   │   │   │   ├── Tooltip.tsx
│   │   │   │   └── Skeleton.tsx
│   │   │   │
│   │   │   ├── research/
│   │   │   │   ├── TopicInput.tsx
│   │   │   │   ├── ResearchPlanner.tsx
│   │   │   │   ├── PlannerStep.tsx
│   │   │   │   ├── ResearchTimeline.tsx
│   │   │   │   ├── TimelineStep.tsx
│   │   │   │   ├── LiveLogs.tsx
│   │   │   │   ├── AgentStatus.tsx
│   │   │   │   ├── SearchProgress.tsx
│   │   │   │   ├── SourceCard.tsx
│   │   │   │   ├── SourceList.tsx
│   │   │   │   ├── ReportViewer.tsx
│   │   │   │   ├── MarkdownRenderer.tsx
│   │   │   │   ├── Citation.tsx
│   │   │   │   ├── CitationList.tsx
│   │   │   │   ├── ExportMenu.tsx
│   │   │   │   └── ReportToolbar.tsx
│   │   │   │
│   │   │   ├── charts/
│   │   │   │   ├── SourceChart.tsx
│   │   │   │   ├── TimelineChart.tsx
│   │   │   │   └── ConfidenceChart.tsx
│   │   │   │
│   │   │   ├── history/
│   │   │   │   └── HistoryCard.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── ModelSelector.tsx
│   │   │       ├── ThemeSelector.tsx
│   │   │       └── ApiKeys.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useResearch.ts
│   │   │   ├── usePlanner.ts
│   │   │   ├── useSources.ts
│   │   │   ├── useLogs.ts
│   │   │   ├── useReport.ts
│   │   │   └── useExport.ts
│   │   │
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── lib/
│   │   ├── styles/
│   │   ├── assets/
│   │   └── middleware.ts
│   └── package.json
│
├── server/
│   ├── app.py
│   ├── api/
│   ├── services/
│   ├── models/
│   ├── schemas/
│   ├── database/
│   ├── websocket/
│   ├── utils/
│   ├── config.py
│   └── requirements.txt
│
├── ai-engine/
│   ├── planner/
│   ├── search/
│   ├── analyzer/
│   ├── writer/
│   ├── verifier/
│   ├── gap_detector/
│   ├── prompts/
│   └── orchestrator.py
│
├── crawler/
│   ├── extractor/
│   ├── pdf/
│   └── cache/
│
├── rag/
│   ├── chunking.py
│   ├── retriever.py
│   ├── reranker.py
│   ├── hybrid_search.py
│   ├── context_builder.py
│   └── pipeline.py
│
├── embeddings/
│   ├── embedding_model.py
│   ├── embed_documents.py
│   ├── embed_query.py
│   └── cache.py
│
├── vector-db/
│   ├── qdrant.py
│   ├── chroma.py
│   ├── pinecone.py
│   └── indexing.py
│
├── knowledge-graph/
│   ├── neo4j.py
│   ├── graph_builder.py
│   ├── entity_extractor.py
│   └── relationship_builder.py
│
├── storage/
│   ├── pdfs/
│   ├── reports/
│   ├── markdown/
│   ├── exports/
│   ├── cache/
│   └── screenshots/
│
├── scripts/
│   ├── setup.py
│   ├── seed.py
│   ├── clean.py
│   └── benchmark.py
│
├── docker/
│   ├── Dockerfile.client
│   ├── Dockerfile.server
│   ├── Dockerfile.ai
│   └── Dockerfile.crawler
│
├── nginx/
├── docs/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── docker-compose.yml
├── .env
├── .gitignore
├── README.md
└── LICENSE
```