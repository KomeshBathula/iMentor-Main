


Here is the complete, copy-pasteable **System Architecture and Implementation Blueprint**. You can feed this directly into a "vibe coding" agent (like Cursor, Devin, GitHub Copilot, or Windsurf) as your master `prompt` or `.cursorrules` file. 

I have selected the **Python + Nuitka + LanceDB** stack for this prompt. While Rust is technically more efficient, AI coding agents are exponentially better at writing flawless Python code. This stack is specifically designed to bypass the "Docker tax" and compile into a hyper-efficient `.exe`.

***

# COPY AND PASTE THE BELOW TO YOUR AI AGENT

## **System Architecture & Development Blueprint: NanoRAG (8GB RAM Optimized)**

**Context & Objective:**
You are an expert AI software engineer. Your task is to develop a standalone, lightweight Retrieval-Augmented Generation (RAG) desktop application for Windows. It must run comfortably on an 8GB RAM machine without Docker, relying entirely on local CPU inference. The final output must be compilable into a single `.exe` file.

### **1. Tech Stack**
*   **Language:** Python 3.11+
*   **GUI Framework:** `Flet` (For a modern, native Windows 11 UI with low overhead).
*   **LLM Engine:** `llama-cpp-python` (CPU-bound inference with AVX2 support).
*   **Target LLM:** Qwen-2.5-3B-Instruct GGUF (`Q4_K_M` quantization).
*   **Embeddings:** `fastembed` (Uses `BAAI/bge-small-en-v1.5` - blazingly fast on CPU, ~100MB RAM).
*   **Vector Database:** `lancedb` (Serverless, saves to local disk, no background processes).
*   **Document Parsing:** `PyMuPDF` (`fitz`) for extremely fast PDF text extraction.
*   **Testing:** `pytest` and `pytest-asyncio`.
*   **Packaging:** `Nuitka` (Compiles Python to C++ then to `.exe` for maximum performance).

---

### **2. Directory Structure**
Create the following structure exactly:

```text
nano_rag/
├── models/                  # Placeholder: User drops .gguf files here
├── data/                    # LanceDB local storage (auto-generated)
├── src/
│   ├── __init__.py
│   ├── config.py            # App settings, paths, and model configs
│   ├── gui.py               # Flet UI layout and event handlers
│   ├── llm_engine.py        # llama-cpp-python wrapper & prompt construction
│   ├── vector_store.py      # LanceDB & FastEmbed logic
│   ├── document_parser.py   # PyMuPDF text extraction & chunking
│   └── main.py              # Application entry point
├── tests/
│   ├── __init__.py
│   ├── test_document.py
│   ├── test_vector_store.py
│   └── test_llm.py
├── requirements.txt
└── build.bat                # Nuitka compilation script
```

---

### **3. Module Specifications & Constraints**

#### **Constraint 1: Memory Management (Crucial for 8GB RAM)**
*   The `llama_cpp.Llama` instance must be initialized with `n_ctx=2048` and `n_threads` equal to system physical cores.
*   Do NOT load `langchain`. It adds unnecessary bloat and RAM usage. Write custom glue code.

#### **Module: `src/config.py`**
*   Define absolute paths for `MODELS_DIR` and `DATA_DIR` relative to `sys.executable` (if frozen by Nuitka) or `__file__` (if running from source).
*   Define chunking parameters: `CHUNK_SIZE = 500`, `CHUNK_OVERLAP = 50`.

#### **Module: `src/document_parser.py`**
*   Implement a function `extract_and_chunk(pdf_path: str) -> list[dict]`.
*   Use `PyMuPDF` to extract text.
*   Implement a simple sliding-window text splitter based on character count. Return a list of dictionaries: `[{"text": "...", "metadata": {"source": "filename", "page": 1}}]`.

#### **Module: `src/vector_store.py`**
*   Initialize `fastembed.TextEmbedding(model_name="BAAI/bge-small-en-v1.5")`.
*   Initialize `lancedb` pointing to `DATA_DIR`.
*   Create a schema with columns: `vector`, `text`, `source`.
*   **Function 1:** `ingest_chunks(chunks: list[dict])` -> Embeds text and appends to LanceDB table.
*   **Function 2:** `search(query: str, k=3) -> list[str]` -> Embeds query, performs vector search, and returns the top `k` text strings.

#### **Module: `src/llm_engine.py`**
*   Initialize the GGUF model lazily (only when a query is asked, or explicitly loaded by the user).
*   Implement `generate_answer(query: str, context: list[str]) -> Generator`.
*   Use a strict Prompt Template: 
    *"You are a helpful AI. Use ONLY the provided context to answer the question. Answer in structured bullet points. \nContext: {context}\nQuestion: {query}"*
*   Ensure the output is streamed (using `stream=True` in `llama_cpp`) so the UI doesn't freeze.

#### **Module: `src/gui.py`**
*   Use `Flet`.
*   **Layout:**
    *   Left Sidebar: "Upload PDF" button, List of ingested files.
    *   Main Area: Scrollable chat history (ListView).
    *   Bottom: TextField for queries + "Send" button.
*   Ensure the UI streams the LLM tokens into the chat bubble in real-time as they are yielded by `generate_answer`.

---

### **4. Testing Strategy (`tests/`)**
Write `pytest` scripts for the following:
1.  **`test_document.py`**: Create a dummy PDF text, chunk it, and assert chunk lengths are `<= CHUNK_SIZE`.
2.  **`test_vector_store.py`**: Mock `fastembed`, insert 3 chunks into an in-memory LanceDB, and assert `search()` returns the closest match.
3.  **`test_llm.py`**: Mock `llama_cpp` to ensure the prompt is formatted correctly without actually loading a 2GB model during CI/CD.

---

### **5. Build Script (`build.bat`)**
Provide a Windows Batch script using Nuitka to compile the app. It MUST include:
```bat
@echo off
echo Building NanoRAG...
python -m pip install nuitka
python -m nuitka ^
    --standalone ^
    --onefile ^
    --plugin-enable=pylint-warnings ^
    --enable-plugin=tk-inter ^
    --windows-console-mode=disable ^
    --include-data-dir=data=data ^
    --output-dir=dist ^
    src/main.py
echo Build Complete! Executable is in the dist folder.
```

---

### **6. Execution Instructions for the Agent**
1.  Generate `requirements.txt` based on the specified stack.
2.  Implement the code module by module, adhering to the directory structure.
3.  Keep dependencies to an absolute minimum to ensure a small `.exe` footprint.
4.  Add robust error handling (e.g., alert the user if no `.gguf` file is found in the `models/` directory).
5.  Once the code is generated, run `pytest` to verify the logic.

***

### How to use this with your AI:
1. Open Cursor / Windsurf / Devin.
2. Create a new empty folder.
3. Paste the entire block above into the chat.
4. Tell the agent: *"Execute this blueprint."*
5. Once it finishes, manually download `Qwen2.5-3B-Instruct-GGUF` (the `Q4_K_M` version) from HuggingFace, drop it in the newly created `models/` folder, and run the app.
