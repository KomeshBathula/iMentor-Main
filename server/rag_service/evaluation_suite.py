# RAG Service: Automated Evaluation Suite
# Implements Task 2.4.1: Course-specific test sets and metrics measurement

import sys
import json
import argparse

import requests
import time
import os
from ollama_util import call_ollama_sync

def query_ollama(model_tag, prompt):
    try:
        start = time.time()
        response = call_ollama_sync(
            payload={"model": model_tag, "prompt": prompt, "stream": False},
            timeout=120
        )
        response.raise_for_status()
        latency = (time.time() - start) * 1000
        return response.json().get('response', ''), latency
    except Exception as e:
        print(f"[Evaluate] Ollama Error: {str(e)}", file=sys.stderr)
        return "", 0

def llm_judge(question, expected, actual):
    judge_prompt = f"""
    You are an impartial judge. Rate the accuracy of the 'Actual Answer' against the 'Expected Answer' on a scale of 0 to 100.
    Question: {question}
    Expected Answer: {expected}
    Actual Answer: {actual}
    Return ONLY a single integer between 0 and 100.
    """
    try:
        # Use base fast model for judging
        score_str, _ = query_ollama("qwen2.5-1.5b-instruct", judge_prompt)
        # Extract digits
        score = int(''.join(c for c in score_str if c.isdigit()))
        return min(max(score, 0), 100)
    except:
        return 0

def evaluate_model(model_tag, course_id, test_jsonl_path):
    print(f"[EvaluationSuite] Starting regression evaluation for {model_tag}", file=sys.stderr)
    
    test_cases = []
    if os.path.exists(test_jsonl_path):
        with open(test_jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        data = json.loads(line)
                        instruction = data.get("instruction") or data.get("messages", [{}])[1].get("content")
                        output = data.get("output") or data.get("messages", [{}])[2].get("content")
                        if instruction and output:
                            test_cases.append({"q": instruction, "a": output})
                    except:
                        pass
    
    if not test_cases:
        # Fallback to mock test cases if file missing for structural test
        test_cases = [
            {"q": f"What is the main topic of {course_id}?", "a": "Foundational theories."},
            {"q": "Explain a key concept.", "a": "It involves analyzing data structures."}
        ]

    total_score = 0
    total_latency = 0

    for tc in test_cases:
        actual_ans, latency = query_ollama(model_tag, tc["q"])
        score = llm_judge(tc["q"], tc["a"], actual_ans)
        total_score += score
        total_latency += latency

    avg_accuracy = total_score / len(test_cases)
    avg_latency = total_latency / len(test_cases)
    
    metrics = {
        "model": model_tag,
        "metrics": {
            "accuracy": round(avg_accuracy, 1),
            "latencyAvgMs": round(avg_latency)
        },
        "passed": avg_accuracy > 80.0
    }
    
    print(json.dumps(metrics))
    return metrics

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Automated Regression Metrics')
    parser.add_argument('--model', type=str, required=True, help='Ollama model tag to test')
    parser.add_argument('--course', type=str, required=True, help='Course specific intent')
    
    args = parser.parse_args()
    
    try:
        evaluate_model(args.model, args.course, "data/test_set.jsonl")
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
