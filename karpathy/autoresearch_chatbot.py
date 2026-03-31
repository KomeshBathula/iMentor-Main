import os
import subprocess
import time
import re
from openai import OpenAI
from pathlib import Path

# Configuration
SGLANG_BASE_URL = os.environ.get("SGLANG_BASE_URL", "http://localhost:8000/v1")
MODEL_NAME = os.environ.get("MODEL_NAME", "default")
CHATBOT_REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "chatbot"))
RESULTS_FILE = "results.tsv"

client = OpenAI(
    base_url=SGLANG_BASE_URL,
    api_key="EMPTY"  # SGLang local server doesn't require an API key
)

def get_current_git_commit():
    """Returns the current short git commit hash of the chatbot repo."""
    try:
        res = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], 
            cwd=CHATBOT_REPO_DIR, text=True
        )
        return res.strip()
    except Exception as e:
        print(f"Error getting git commit: {e}")
        return "unknown"

def run_tests():
    """
    Executes the backend test suite inside the chatbot repo.
    Returns: (bool passed, str stdout_stderr_log)
    """
    print("Running backend_test_suite.py...")
    result = subprocess.run(
        ["python3", "server/scripts/backend_test_suite.py"],
        cwd=CHATBOT_REPO_DIR,
        capture_output=True,
        text=True
    )
    passed = (result.returncode == 0)
    full_output = result.stdout + "\n" + result.stderr
    return passed, full_output

def apply_patch(diff_text):
    """
    Writes the diff to proposal.patch and applies it to the chatbot repo.
    Returns boolean indicating success.
    """
    patch_path = os.path.abspath("proposal.patch")
    with open(patch_path, "w") as f:
        f.write(diff_text)
    
    # Try applying via git apply inside the chatbot repo
    print("Applying proposed git patch...")
    res = subprocess.run(
        ["git", "apply", "--recount", patch_path], 
        cwd=CHATBOT_REPO_DIR, 
        capture_output=True, 
        text=True
    )
    if res.returncode == 0:
        return True
    
    # Alternatively try patch -p1 if git apply fails
    print(f"git apply failed: {res.stderr}\nFallback to patch -p1...")
    res2 = subprocess.run(
        ["patch", "-p1", "-i", patch_path],
        cwd=CHATBOT_REPO_DIR,
        capture_output=True,
        text=True
    )
    if res2.returncode == 0:
        return True
    
    print(f"Patch failed completely: {res2.stderr}")
    return False

def reset_repository(commit_hash):
    """Resets the repository back to a clean state at the given commit."""
    print(f"Reverting changes... resetting to {commit_hash}")
    subprocess.run(["git", "reset", "--hard", commit_hash], cwd=CHATBOT_REPO_DIR, capture_output=True)
    subprocess.run(["git", "clean", "-fd"], cwd=CHATBOT_REPO_DIR, capture_output=True)

def record_result(commit_hash, status, description):
    """Appends the experiment result to results.tsv."""
    if not os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, "w") as f:
            f.write("commit\\tstatus\\tdescription\\n")
    
    with open(RESULTS_FILE, "a") as f:
        f.write(f"{commit_hash}\\t{status}\\t{description}\\n")

def query_sglang_for_fix(graph_context, previous_errors=""):
    """
    Prompts the SGLang model for a code modification.
    """
    system_prompt = (
        "You are an autonomous AI software engineer working on an Express/React 'chatbot' application. "
        "Your task is to fix bugs, optimize performance, or add robust tests. "
        "Generate a concrete, unified Git patch (.diff format) that makes exactly one set of related fixes. "
        "Return ONLY the patch inside ```diff\\n ... \\n``` code blocks and no other text."
    )
    
    user_prompt = f"Here is the architecture dependency graph and partial contents for context:\\n{graph_context[:100000]}\\n\\n"
    if previous_errors:
        user_prompt += f"The latest test run FAILED with the following errors:\\n{previous_errors}\\n\\n"
    else:
        user_prompt += "Propose an improvement or test addition for the codebase.\\n"
        
    user_prompt += "Please provide the exact git patch diff.\\n"
    
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4096
        )
        content = response.choices[0].message.content
        
        # Extract patch from markdown code block
        match = re.search(r'```(?:diff)?\\n(.*?)\\n```', content, re.DOTALL)
        if match:
            return match.group(1).strip()
        return content.strip()
    except Exception as e:
        print(f"Error querying SGLang: {e}")
        return ""

def load_context():
    """Loads graph.txt as context if it exists."""
    if os.path.exists("graph.txt"):
        with open("graph.txt", "r") as f:
            return f.read()
    return "No architecture documentation found."

def main():
    print("Starting SGLang AutoResearch Loop for the Chatbot repo...")
    print(f"Targeting: {CHATBOT_REPO_DIR}")
    print(f"API Base: {SGLANG_BASE_URL} | Model: {MODEL_NAME}\\n")
    
    if not os.path.exists(CHATBOT_REPO_DIR):
        print(f"Error: Chatbot repository not found at {CHATBOT_REPO_DIR}!")
        return

    graph_context = load_context()
    run_log = ""
    iteration = 1
    
    while True:
        print(f"\\n{'='*50}\\nIteration {iteration}\\n{'='*50}")
        commit_before = get_current_git_commit()
        
        print("1. Querying SGLang for a patch idea...")
        patch_text = query_sglang_for_fix(graph_context, run_log)
        
        if not patch_text or patch_text.startswith("Error"):
            print("Failed to generate a valid patch. Giving LLM a 10s break...")
            time.sleep(10)
            iteration += 1
            run_log = "" # Clear error to try fresh
            continue
            
        print("2. Applying patch...")
        success = apply_patch(patch_text)
        
        if not success:
            print("Patch failed to apply cleanly. Resetting and providing feedback...")
            reset_repository(commit_before)
            run_log = "The provided git patch failed to apply. Ensure the file paths and context lines perfectly match the current codebase."
            record_result(commit_before, "crash", "patch application failed")
            iteration += 1
            continue
            
        print("3. Running test suite...")
        tests_passed, test_output = run_tests()
        
        if tests_passed:
            print(f"\\nSUCCESS! Tests passed. Committing the changes.")
            subprocess.run(["git", "add", "."], cwd=CHATBOT_REPO_DIR)
            subprocess.run(["git", "commit", "-m", "AutoResearch: Auto-generated fix by SGLang\\n\\nTests passed."], cwd=CHATBOT_REPO_DIR)
            new_commit = get_current_git_commit()
            record_result(new_commit, "keep", "tests passed smoothly")
            run_log = "" # Clear errors for next run
        else:
            print("\\nFAILURE. Tests failed. Reverting repository changes.")
            reset_repository(commit_before)
            record_result(commit_before, "discard", "tests failed")
            # Tail the last 30 lines of error for feedback
            error_feedback = "\\n".join(test_output.split("\\n")[-30:]) 
            run_log = f"Tests failed after applying the patch. Here is the last part of the output:\\n{error_feedback}"
        
        iteration += 1
        print("Taking a 5-second breather before the next iteration...")
        time.sleep(5)

if __name__ == "__main__":
    main()
