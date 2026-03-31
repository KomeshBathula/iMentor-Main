# server/rag_service/qa_generator.py
import os
import json
import logging
import requests
import re
import hmac
import hashlib
from google import genai
try:
    from rag_service.file_parser import parse_file, chunk_text
    from rag_service import config
    from rag_service.prompts import FINE_TUNING_QA_GENERATION_PROMPT_TEMPLATE
except ImportError:
    from file_parser import parse_file, chunk_text
    import config
    from prompts import FINE_TUNING_QA_GENERATION_PROMPT_TEMPLATE

# Setup Logging
logger = logging.getLogger(__name__)

# Configure Providers
llm_provider = os.getenv("QA_LLM_PROVIDER", "gemini").lower()
llm_model_name = os.getenv("QA_LLM_MODEL")

def llm_generate(prompt):
    """
    Unified wrapper with automatic fallback: Gemini -> Groq -> Ollama.
    """
    
    # --- 1. Try Gemini first ---
    if config.GEMINI_API_KEY:
        try:
            logger.info("[QA Generator] Attempting Gemini...")
            client = genai.Client(api_key=config.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=config.GEMINI_MODEL_NAME or "gemini-2.0-flash",
                contents=prompt,
            )
            if response and response.text:
                return response.text
        except Exception as e:
            logger.warning(f"[QA Generator] Gemini failed: {e}. Falling back to Groq...")

    # --- 2. Fallback to Groq ---
    if config.GROQ_API_KEY:
        try:
            logger.info("[QA Generator] Attempting Groq...")
            from groq import Groq
            client = Groq(api_key=config.GROQ_API_KEY)
            model = config.GROQ_MODEL_NAME or "llama-3.3-70b-versatile"
            completion = client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model,
                temperature=0.7,
            )
            if completion.choices[0].message.content:
                return completion.choices[0].message.content
        except Exception as e:
            logger.warning(f"[QA Generator] Groq failed: {e}. Falling back to Ollama...")

    # --- 3. Final Fallback to Ollama (Local) ---
    try:
        logger.info("[QA Generator] Attempting Ollama...")
        import requests
        model = os.getenv("QA_LLM_MODEL", "llama3")
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={"model": model, "prompt": prompt, "stream": False},
            timeout=120
        )
        if response.status_code == 200:
            return response.json().get("response", "")
    except Exception as e:
        logger.error(f"[QA Generator] All providers failed. Last error (Ollama): {e}")
    
    return ""



# --- Valid difficulty levels ---
VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}

def infer_difficulty(instruction):
    """
    Heuristic fallback to infer difficulty when the LLM omits the field.
    Based on question complexity keywords.
    """
    q = instruction.lower()
    advanced_signals = ["evaluate", "critique", "design", "hypothesize", "integrate",
                        "synthesize", "compare and contrast", "justify", "defend", "implications"]
    intermediate_signals = ["explain why", "how does", "what happens when", "differentiate",
                            "apply", "analyze", "compare", "classify", "relate"]
    
    if any(kw in q for kw in advanced_signals):
        return "advanced"
    if any(kw in q for kw in intermediate_signals):
        return "intermediate"
    return "beginner"

def infer_subject(text_snippet):
    """
    Heuristic fallback to infer subject from content when the LLM omits it.
    """
    t = text_snippet.lower()
    subject_keywords = {
        "Machine Learning": ["neural network", "gradient", "training data", "model", "regression", "classification", "deep learning"],
        "Data Structures": ["array", "linked list", "tree", "graph", "hash", "queue", "stack", "binary search"],
        "Algorithms": ["sorting", "searching", "dynamic programming", "greedy", "complexity", "big o", "recursion"],
        "Database Systems": ["sql", "query", "normalization", "relational", "schema", "index", "transaction"],
        "Operating Systems": ["process", "thread", "scheduling", "memory management", "deadlock", "virtual memory"],
        "Computer Networks": ["tcp", "udp", "protocol", "router", "dns", "http", "packet", "bandwidth"],
        "Mathematics": ["equation", "theorem", "proof", "integral", "derivative", "matrix", "vector"],
        "Physics": ["force", "velocity", "energy", "momentum", "wave", "quantum", "thermodynamics"],
    }
    for subject, keywords in subject_keywords.items():
        if any(kw in t for kw in keywords):
            return subject
    return "General"

def enrich_qa_pair(pair, chunk_text_snippet=""):
    """
    Ensures each QA pair has difficulty, subject, and topic fields.
    Uses heuristic fallbacks if the LLM didn't provide them.
    """
    # Validate difficulty
    if "difficulty" not in pair or pair["difficulty"] not in VALID_DIFFICULTIES:
        pair["difficulty"] = infer_difficulty(pair.get("instruction", ""))
    
    # Validate subject
    if "subject" not in pair or not pair["subject"]:
        pair["subject"] = infer_subject(pair.get("output", "") + " " + chunk_text_snippet)
    
    # Validate topic
    if "topic" not in pair or not pair["topic"]:
        # Extract a short topic from the instruction
        instruction = pair.get("instruction", "")
        # Use first meaningful phrase as topic fallback
        pair["topic"] = instruction[:80].rstrip("?").strip() if instruction else "General"
    
    return pair

def compute_dataset_stats(qa_pairs):
    """
    Compute difficulty distribution and subject taxonomy coverage stats.
    """
    difficulty_counts = {"beginner": 0, "intermediate": 0, "advanced": 0}
    subject_counts = {}
    topic_set = set()

    for pair in qa_pairs:
        diff = pair.get("difficulty", "beginner")
        difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1

        subject = pair.get("subject", "General")
        subject_counts[subject] = subject_counts.get(subject, 0) + 1

        topic = pair.get("topic", "")
        if topic:
            topic_set.add(topic)

    total = len(qa_pairs)
    return {
        "total_pairs": total,
        "difficulty_distribution": {
            k: {"count": v, "percentage": round(v / total * 100, 1) if total > 0 else 0}
            for k, v in difficulty_counts.items()
        },
        "subject_coverage": {
            k: {"count": v, "percentage": round(v / total * 100, 1) if total > 0 else 0}
            for k, v in sorted(subject_counts.items(), key=lambda x: -x[1])
        },
        "unique_topics": len(topic_set),
        "topics": sorted(list(topic_set)),
    }

def generate_qa_pairs(file_path, user_id, num_pairs_per_chunk=3):
    """
    Parses a file, chunks it, and generates QA pairs for each chunk.
    Each QA pair includes difficulty level and subject/topic taxonomy.
    
    Args:
        file_path (str): Path to the document.
        user_id (str): The ID of the user triggering the generation.
        num_pairs_per_chunk (int): Number of QA pairs to generate per chunk.
        
    Returns:
        list: A list of dicts containing 'instruction', 'output', 'difficulty', 'subject', 'topic'.
    """
    logger.info(f"[QA Generator] Starting QA generation for: {file_path}")
    
    if not os.path.exists(file_path):
        logger.error(f"[QA Generator] File not found: {file_path}")
        return []

    # 1. Parse the file
    text = parse_file(file_path)
    if not text:
        logger.error(f"[QA Generator] Failed to parse content from: {file_path}")
        return []

    # 2. Chunk the text
    file_name = os.path.basename(file_path)
    chunks = chunk_text(text, file_name, user_id)
    
    if not chunks:
        logger.warning(f"[QA Generator] Chunks are empty for file: {file_path}")
        return []

    all_qa_pairs = []
    
    # 3. Generate QA for each chunk
    import time
    for i, chunk in enumerate(chunks):
        try:
            logger.info(f"[QA Generator] Processing chunk {i+1}/{len(chunks)}...")
            
            prompt = FINE_TUNING_QA_GENERATION_PROMPT_TEMPLATE.format(
                num_pairs=num_pairs_per_chunk,
                text=chunk.page_content
            )
            
            response_text = llm_generate(prompt)
            qa_json = parse_llm_json(response_text)
            
            if isinstance(qa_json, list):
                valid_pairs = []
                for p in qa_json:
                    if isinstance(p, dict) and "instruction" in p and "output" in p:
                        # Enrich with difficulty + taxonomy (validate or infer)
                        enriched = enrich_qa_pair(p, chunk.page_content[:500])
                        valid_pairs.append(enriched)
                
                all_qa_pairs.extend(valid_pairs)
                logger.info(f"[QA Generator] Chunk {i+1}: Generated {len(valid_pairs)} enriched pairs.")
            else:
                logger.warning(f"[QA Generator] Chunk {i+1}: LLM did not return a valid list.")
            
            # Add a small delay to avoid rate limits on free tier
            time.sleep(1)
                
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "ResourceExhausted" in error_msg:
                logger.error(f"[QA Generator] Rate limit hit (429). Waiting 60s...")
                time.sleep(60)
            else:
                logger.error(f"[QA Generator] Error in chunk {i+1}: {error_msg}")

    # 4. Log dataset stats
    stats = compute_dataset_stats(all_qa_pairs)
    logger.info(f"[QA Generator] Final result: {stats['total_pairs']} pairs generated.")
    logger.info(f"[QA Generator] Difficulty: {json.dumps(stats['difficulty_distribution'])}")
    logger.info(f"[QA Generator] Subjects: {json.dumps(stats['subject_coverage'])}")
    logger.info(f"[QA Generator] Unique topics: {stats['unique_topics']}")
    
    return all_qa_pairs

def parse_llm_json(text):
    """
    Helper to extract and parse JSON from LLM response safely.
    """
    try:
        # 1. Try standard JSON parse
        return json.loads(text.strip())
    except json.JSONDecodeError:
        try:
            # 2. Try to find the first array in the text using regex
            match = re.search(r'\[\s*\{.*\}\s*\]', text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            
            # 3. Try to clean markdown fences if present
            cleaned = text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            return json.loads(cleaned.strip())
        except Exception:
            logger.error("[QA Generator] Failed to parse LLM response as JSON.")
            return []

def save_training_data(qa_pairs, output_filename=None):
    """
    Saves QA pairs to a JSON file in the designated training_sets directory.
    Also saves a metadata sidecar file with difficulty distribution and taxonomy stats.
    """
    if not output_filename:
        import uuid
        output_filename = f"dataset_{uuid.uuid4().hex[:8]}.json"
        
    base_dir = os.path.dirname(os.path.abspath(__file__))
    target_dir = os.path.join(base_dir, 'data', 'training_sets')
    
    try:
        os.makedirs(target_dir, exist_ok=True)
        target_path = os.path.join(target_dir, output_filename)
        
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(qa_pairs, f, indent=2)
            
        logger.info(f"[QA Generator] Dataset saved to: {target_path}")
        
        # Save metadata sidecar with difficulty + taxonomy stats
        stats = compute_dataset_stats(qa_pairs)
        meta_filename = output_filename.replace('.json', '_meta.json')
        meta_path = os.path.join(target_dir, meta_filename)
        
        from datetime import datetime
        metadata = {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "dataset_file": output_filename,
            **stats,
        }
        
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"[QA Generator] Metadata saved to: {meta_path}")
        return target_path
    except Exception as e:
        logger.error(f"[QA Generator] Failed to save dataset: {str(e)}")
        return None

def report_to_backend(job_id, dataset_size):
    """
    Reports the final count of generated QA pairs to the Node.js backend.
    """
    node_server_url = os.getenv("NODE_SERVER_URL_FOR_CALLBACK", "http://localhost:5001")
    update_url = f"{node_server_url}/api/admin/finetuning/update-size"
    callback_secret = os.getenv("CALLBACK_SECRET", "")
    
    payload = {
        "jobId": job_id,
        "datasetSize": dataset_size
    }

    canonical_payload = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    signature = hmac.new(
        callback_secret.encode("utf-8"),
        canonical_payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    try:
        response = requests.post(
            update_url,
            json=payload,
            headers={"x-signature": signature},
            timeout=5
        )
        if response.status_code == 200:
            logger.info(f"[QA Generator] Successfully reported size ({dataset_size}) to backend.")
            return True
        else:
            logger.warning(f"[QA Generator] Backend returned status {response.status_code} on size update.")
            return False
    except Exception as e:
        logger.error(f"[QA Generator] Failed to report size to Node.js: {str(e)}")
        return False

def run_pipeline(file_path, user_id, job_id=None, output_filename=None):
    """
    Runs the full generation pipeline: parse -> chunk -> generate -> enrich -> save -> report.
    Now includes difficulty tagging and subject taxonomy classification.
    """
    qa_pairs = generate_qa_pairs(file_path, user_id)
    if not qa_pairs:
        return {"status": "error", "message": "No QA pairs generated."}
        
    saved_path = save_training_data(qa_pairs, output_filename)
    stats = compute_dataset_stats(qa_pairs)
    
    if job_id:
        report_to_backend(job_id, len(qa_pairs))
        
    return {
        "status": "success",
        "count": len(qa_pairs),
        "path": saved_path,
        "stats": stats,
    }

if __name__ == "__main__":
    # Example CLI usage: python qa_generator.py sample.pdf admin_user
    import sys
    if len(sys.argv) > 2:
        file_path = sys.argv[1]
        user_id = sys.argv[2]
        
        # Derive a sensible filename based on the input file
        input_base = os.path.basename(file_path).lower()
        # Remove extension
        input_name = os.path.splitext(input_base)[0]
        # Clean up name for slug
        course_slug = re.sub(r'[^a-z0-9]', '_', input_name)
        output_filename = f"dataset_{course_slug}.json"
        
        res = run_pipeline(file_path, user_id, output_filename=output_filename)
        print(json.dumps(res, indent=2))
    else:
        print("Usage: python qa_generator.py <file_path> <user_id>")
