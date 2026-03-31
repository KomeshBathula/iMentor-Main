# Chatbot AutoResearch (SGLang)

This is a specific setup of the Andrej Karpathy AutoResearch pattern tailored for the `chatbot` repository, utilizing a local SGLang inference server instead of Claude/Codex.

## Files

- **`autoresearch_chatbot.py`** — The automated orchestrator loop. You simply run this Python script, and it continuously queries the local SGLang server, proposes patches based on the codebase dump, runs tests, and commits/reverts changes inside the `chatbot` directory.
- **`code.txt` / `graph.txt`** — The architectural index that is fed to the SGLang model alongside the test failures.

## Setup & Running

1. **Ensure SGLang is running**: The script expects SGLang's OpenAI-compatible server to be running on `http://localhost:8000/v1` (adjust the `SGLANG_BASE_URL` environment variable if your port differs).
2. **Setup Chatbot Python Testing Environment**: Ensure your Python testing environment is activated and `/server/scripts/backend_test_suite.py` can be executed successfully.
3. **Execute the Loop**:
```bash
uv run python autoresearch_chatbot.py
```
*(Or simply `python3 autoresearch_chatbot.py` depending on your setup)* 

## How the Loop Works

1. The script establishes the current Git state of `../chatbot`.
2. SGLang evaluates `graph.txt` and any previously failed test logs.
3. SGLang proposes a `.diff` patch format to improve the application.
4. The patch is applied inside `../chatbot`.
5. The `backend_test_suite.py` is executed.
6. If the metric improves/tests pass, the change is confirmed via `git commit`. 
7. If tests fail, the change is reverted with `git reset --hard` and `git clean -fd`.
8. Results are appended to `results.tsv`.
9. The script sleeps briefly and runs another cycle endlessly.

You can start the loop, go to sleep, and let the SGLang model iterate on your bugs overnight!
